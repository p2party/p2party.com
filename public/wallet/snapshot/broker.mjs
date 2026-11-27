// Every wallet reads the same public ledger range. RPC requests contain only
// the network, anchor and consecutive heights.
export const endpoint = "https://signaling.p2party.com/rpc";
const chain =
  "0x09a0ffa8e6af6aeb11d26671c6c76648965d60509cc3b7a1a4b454b6ec73c760";
const genesis =
  "0x6bd2366c1034c93827cb1a79118f3cd18d403a35865e4baed5f2d3b3f6adab21";
const baseHash =
  "22044ffc5c6d133249b0e2e7c2ae626cbc9f586e8b5d61fb96c9df861b8c1397";
const lastReceipt =
  "0x5f50f7ceb77dc372a5a5ea15c934b3a89dd4d56f9f0fe8753a7e7df4a1a3974811712b948d6487fa37c9959246a46120ab4d095d34089929108fa855bef3a59b";
const hex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const quantity = (n) => "0x" + n.toString(16);
async function readBytes(response, max) {
  if (!response.ok || !response.body)
    throw Error("The public ledger data is unavailable.");
  const chunks = [],
    reader = response.body.getReader();
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > max) {
        await reader.cancel();
        throw Error("Public ledger reply exceeds the read limit.");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}
async function rpc(calls, signal, fetcher) {
  const requested = calls.map(([method, params], id) => ({
    jsonrpc: "2.0",
    id,
    method,
    params,
  }));
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requested),
    signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
  });
  const result = JSON.parse(
    new TextDecoder().decode(await readBytes(response, 256 * 1024)),
  );
  if (!Array.isArray(result) || result.length !== calls.length)
    throw Error("Incomplete public RPC response.");
  const map = new Map();
  for (const item of result) {
    if (
      !item ||
      item.jsonrpc !== "2.0" ||
      !Number.isInteger(item.id) ||
      item.id < 0 ||
      item.id >= calls.length ||
      map.has(item.id) ||
      !Object.hasOwn(item, "result")
    )
      throw Error("The public RPC did not return a requested receipt.");
    map.set(item.id, item.result);
  }
  return requested.map((_, id) => map.get(id));
}
async function tagged(tag, bytes) {
  const name = new TextEncoder().encode(tag),
    data = new Uint8Array(1 + name.length + bytes.length);
  data[0] = name.length;
  data.set(name, 1);
  data.set(bytes, 1 + name.length);
  return new Uint8Array(await crypto.subtle.digest("SHA-512", data));
}
async function checkReceipt(r, height) {
  if (
    !r ||
    r.height !== quantity(height) ||
    typeof r.wire !== "string" ||
    ![11012, 33034].includes(r.wire.length) ||
    !/^0x[0-9a-f]+$/.test(r.wire)
  )
    throw Error("Unexpected native receipt.");
  const wire = Uint8Array.from(r.wire.slice(2).match(/../g), (h) =>
    parseInt(h, 16),
  );
  const move = await tagged("move/id", wire),
    prior = new Uint8Array(68);
  prior.set(move);
  if (
    wire[0] !== 1 ||
    wire[1] !== 1 ||
    "0x" + hex(wire.subarray(2, 34)) !== chain ||
    "0x" + hex(wire.subarray(34, 98)) !== r.inputId ||
    "0x" + hex(move) !== r.id ||
    "0x" + hex(await tagged("unit/id", prior)) !== r.outputId ||
    ![1, 2].includes(wire[115]) ||
    wire.length !== { 1: 5505, 2: 16516 }[wire[114]]
  )
    throw Error("Receipt and signed bytes disagree.");
  return wire;
}
async function trustedStart(fetcher, signal) {
  const response = await fetcher(
    new URL("./checkpoint.json", import.meta.url),
    {
      signal,
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    },
  );
  const data = await readBytes(response, 180000);
  if (
    hex(new Uint8Array(await crypto.subtle.digest("SHA-256", data))) !==
    baseHash
  )
    throw Error("Starting checkpoint checksum mismatch.");
  const { snapshot, spent } = JSON.parse(new TextDecoder().decode(data));
  const from = BigInt(snapshot.height);
  const [head, network, anchor] = await rpc(
    [
      ["demos_getHead", []],
      ["eth_chainId", []],
      ["demos_getTransferByHeight", [snapshot.height]],
    ],
    signal,
    fetcher,
  );
  await checkReceipt(anchor, from);
  if (
    anchor.id !== lastReceipt ||
    network !== "0x50325054" ||
    head?.chainId !== chain ||
    typeof head.height !== "string" ||
    !/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/.test(head.height)
  )
    throw Error("Unexpected testnet history.");
  if (BigInt(head.height) < from)
    throw Error("The validator is behind the trusted checkpoint.");
  return { snapshot, spent, headHeight: head.height, anchorId: anchor.id };
}

function checkSignal(signal) {
  signal.throwIfAborted();
}

async function completeSnapshot(start, { fetcher, signal, deliverPage }) {
  const { snapshot, spent, headHeight } = start;
  const target = BigInt(headHeight);
  const utxos = new Map(snapshot.units.map((unit) => [unit.id, unit]));
  const all = [...spent, ...snapshot.units];
  const ids = new Set(all.map((unit) => unit.id)),
    owners = new Set(all.map((unit) => unit.commitment));
  let current = BigInt(snapshot.height);
  while (current < target) {
    const afterHeight = quantity(current);
    const receipts = [];
    // Four maximum-size replies fit one bounded RPC body. Never hold more
    // than 32 wires while waiting for the signer to verify this page.
    while (receipts.length < 32 && current < target) {
      checkSignal(signal);
      const heights = [];
      while (heights.length < 4 && current < target) heights.push(++current);
      const batch = await rpc(
        heights.map((h) => ["demos_getTransferByHeight", [quantity(h)]]),
        signal,
        fetcher,
      );
      for (const [i, receipt] of batch.entries()) {
        const wire = await checkReceipt(receipt, heights[i]),
          source = utxos.get(receipt.inputId);
        const expiry = new DataView(wire.buffer).getBigUint64(106);
        const dest = "0x" + hex(wire.subarray(116, 180));
        if (
          !source ||
          source.suite !== wire[114] ||
          BigInt(source.weight) !==
            new DataView(wire.buffer).getBigUint64(98) ||
          (expiry !== 0n && heights[i] > expiry) ||
          ids.has(receipt.outputId) ||
          owners.has(dest)
        )
          throw Error("Inconsistent public output set.");
        ids.add(receipt.outputId);
        owners.add(dest);
        utxos.delete(receipt.inputId);
        utxos.set(receipt.outputId, {
          id: receipt.outputId,
          weight: source.weight,
          suite: wire[115],
          commitment: dest,
        });
        receipts.push(receipt.wire);
        if (
          start.headMoveId &&
          heights[i] === target &&
          receipt.id !== start.headMoveId
        )
          throw Error("The pinned public head changed during replay.");
      }
    }
    checkSignal(signal);
    await deliverPage(afterHeight, receipts, quantity(current));
  }
  checkSignal(signal);
  return {
    ...snapshot,
    height: headHeight,
    units: [...utxos.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
  };
}

export async function readPublicSnapshot({
  fetcher = fetch,
  signal = AbortSignal.timeout(30000),
} = {}) {
  const start = await trustedStart(fetcher, signal);
  if (BigInt(start.headHeight) - BigInt(start.snapshot.height) > 256n)
    throw Error("This release needs a newer verified starting checkpoint.");
  const receipts = [];
  let wireBytes = 0;
  const snapshot = await completeSnapshot(start, {
    fetcher,
    signal,
    deliverPage: (_after, page) => {
      for (const wire of page) {
        wireBytes += wire.length;
        if (wireBytes > 8 * 1024 * 1024)
          throw Error("Public history exceeds this release's refresh limit.");
        receipts.push(wire);
      }
    },
  });
  return {
    type: "p2party.wallet.snapshot.v1",
    chainId: chain,
    genesisHash: genesis,
    fromHeight: start.snapshot.height,
    headHeight: start.headHeight,
    receipts,
    snapshot,
  };
}

// The start snapshot comes from the release-pinned file and the RPC checkpoint
// check above. The signer independently verifies every native signature.
export async function streamPinnedHistory(
  start,
  { fetcher, signal, nonce, sendAndWait },
) {
  const { snapshot, headHeight, anchorId } = start;
  const target = BigInt(headHeight);
  let headMoveId = anchorId;
  if (headHeight !== snapshot.height) {
    const [tip] = await rpc(
      [["demos_getTransferByHeight", [headHeight]]],
      signal,
      fetcher,
    );
    await checkReceipt(tip, target);
    headMoveId = tip.id;
  }
  const fromHeight = snapshot.height;
  checkSignal(signal);
  await sendAndWait(
    {
      type: "p2party.wallet.catchup.start.v1",
      nonce,
      chainId: chain,
      genesisHash: genesis,
      fromHeight,
      headHeight,
      headMoveId,
    },
    fromHeight,
  );
  const result = await completeSnapshot(
    { ...start, headMoveId },
    {
      fetcher,
      signal,
      deliverPage: async (afterHeight, receipts, height) => {
        await sendAndWait(
          {
            type: "p2party.wallet.catchup.page.v1",
            nonce,
            afterHeight,
            receipts,
          },
          height,
        );
      },
    },
  );
  // Fresh additions after the original head are for a later sync. Re-check
  // both ends of the selected range before releasing its completed snapshot.
  const calls = [
    ["demos_getHead", []],
    ["eth_chainId", []],
    ["demos_getTransferByHeight", [fromHeight]],
  ];
  if (headHeight !== fromHeight)
    calls.push(["demos_getTransferByHeight", [headHeight]]);
  const [head, network, anchor, last] = await rpc(calls, signal, fetcher);
  await checkReceipt(anchor, BigInt(fromHeight));
  if (headHeight !== fromHeight) await checkReceipt(last, target);
  if (
    network !== "0x50325054" ||
    head?.chainId !== chain ||
    typeof head.height !== "string" ||
    !/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/.test(head.height) ||
    BigInt(head.height) < target ||
    anchor.id !== anchorId ||
    (last ?? anchor).id !== headMoveId
  )
    throw Error("The pinned public history changed during replay.");
  checkSignal(signal);
  return { type: "p2party.wallet.catchup.done.v1", nonce, snapshot: result };
}

export async function readPublicCatchup({
  fetcher = fetch,
  signal,
  nonce,
  sendAndWait,
}) {
  const start = await trustedStart(fetcher, signal);
  return streamPinnedHistory(start, { fetcher, signal, nonce, sendAndWait });
}

// The wallet creates a fresh dedicated worker for each refresh. Only this
// wallet can talk to it; the nonce and verified height bind each ACK to a page.
export function servePublicHistory(channel, readHistory = readPublicCatchup) {
  async function start({ data }) {
    if (data?.type !== "sync" || Object.keys(data).length !== 1) return;
    channel.removeEventListener("message", start);
    const nonce = hex(crypto.getRandomValues(new Uint8Array(32)));
    const controller = new AbortController();
    try {
      const result = await readHistory({
        nonce,
        signal: controller.signal,
        sendAndWait: (message, height) =>
          new Promise((resolve, reject) => {
            function stopWaiting() {
              channel.removeEventListener("message", acknowledge);
              clearTimeout(timer);
            }
            function acknowledge(event) {
              const ack = event.data;
              if (
                ack?.type !== "p2party.wallet.catchup.ack.v1" ||
                Object.keys(ack).length !== 3 ||
                ack.nonce !== nonce ||
                ack.height !== height
              )
                return;
              stopWaiting();
              resolve();
            }
            const timer = setTimeout(() => {
              stopWaiting();
              reject(Error("The wallet did not confirm the public history."));
            }, 45000);
            channel.addEventListener("message", acknowledge);
            try {
              channel.postMessage(message);
            } catch (error) {
              stopWaiting();
              reject(error);
            }
          }),
      });
      channel.postMessage(result);
    } catch {
      channel.postMessage({ type: "error" });
    } finally {
      controller.abort();
      channel.close();
    }
  }
  channel.addEventListener("message", start);
}
