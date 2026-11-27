// This page reads the same public history for every visitor. It accepts no
// wallet, address, or query parameters from the calling window.
export const endpoint = "https://signaling.p2party.com/rpc";
export const signerOrigin = "https://p2party.github.io";
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
    signal,
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
export async function readPublicSnapshot({
  fetcher = fetch,
  signal = AbortSignal.timeout(30000),
} = {}) {
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
  const target = BigInt(head.height);
  if (target < from || target - from > 256n)
    throw Error("This release needs a newer verified starting checkpoint.");
  const utxos = new Map(snapshot.units.map((u) => [u.id, u]));
  const all = [...spent, ...snapshot.units],
    ids = new Set(all.map((u) => u.id)),
    owners = new Set(all.map((u) => u.commitment));
  const receipts = [];
  let wireBytes = 0;
  for (let next = from + 1n; next <= target;) {
    const heights = [];
    while (heights.length < 4 && next <= target) heights.push(next++);
    const batch = await rpc(
      heights.map((h) => ["demos_getTransferByHeight", [quantity(h)]]),
      signal,
      fetcher,
    );
    for (const [i, r] of batch.entries()) {
      const wire = await checkReceipt(r, heights[i]),
        source = utxos.get(r.inputId);
      wireBytes += r.wire.length;
      if (wireBytes > 8 * 1024 * 1024)
        throw Error("Public history exceeds this release's refresh limit.");
      const view = new DataView(wire.buffer),
        dest = "0x" + hex(wire.subarray(116, 180));
      if (
        !source ||
        source.suite !== wire[114] ||
        BigInt(source.weight) !== view.getBigUint64(98) ||
        ids.has(r.outputId) ||
        owners.has(dest)
      )
        throw Error("Inconsistent public output set.");
      ids.add(r.outputId);
      owners.add(dest);
      utxos.delete(r.inputId);
      utxos.set(r.outputId, {
        id: r.outputId,
        weight: source.weight,
        suite: wire[115],
        commitment: dest,
      });
      receipts.push(r.wire);
    }
  }
  return {
    type: "p2party.wallet.snapshot.v1",
    chainId: chain,
    genesisHash: genesis,
    fromHeight: snapshot.height,
    headHeight: head.height,
    receipts,
    snapshot: {
      ...snapshot,
      height: head.height,
      units: [...utxos.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
    },
  };
}
