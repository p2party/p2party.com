import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  awaitVerifiedPage,
  endpoint,
  readPublicCatchup,
  signerOrigin,
  streamPinnedHistory,
} from "../public/wallet/snapshot/broker.mjs";

const chain =
  "0x09a0ffa8e6af6aeb11d26671c6c76648965d60509cc3b7a1a4b454b6ec73c760";
const genesis =
  "0x6bd2366c1034c93827cb1a79118f3cd18d403a35865e4baed5f2d3b3f6adab21";
const nonce = "a4".repeat(32);
const hex = (bytes) => "0x" + bytes.toString("hex");
const q = (value) => "0x" + value.toString(16);
const bytes = (id) => createHash("sha512").update(id).digest();
function tag(domain, body) {
  return createHash("sha512")
    .update(Buffer.from([domain.length]))
    .update(domain)
    .update(body)
    .digest();
}

// The broker checks native layout, hashes, ordering and output conservation.
// The standalone signer separately checks real post-quantum signatures.
function receipt(height, inputId, variant = "") {
  const native = Buffer.alloc(5505);
  native.set([1, 1]);
  native.set(Buffer.from(chain.slice(2), "hex"), 2);
  native.set(Buffer.from(inputId.slice(2), "hex"), 34);
  native.writeBigUInt64BE(1n, 98);
  native[114] = 1;
  native[115] = 1;
  const commitment = bytes("owner " + height + variant);
  native.set(commitment, 116);
  const move = tag("move/id", native);
  return {
    height: q(height),
    inputId,
    id: hex(move),
    outputId: hex(tag("unit/id", Buffer.concat([move, Buffer.alloc(4)]))),
    wire: hex(native),
  };
}
function fixture(length = 1, change = () => undefined) {
  const base = 3,
    head = base + length;
  const records = new Map();
  let inputId = hex(bytes("before base"));
  for (let i = base; i <= head; i++) {
    const r = receipt(i, inputId);
    records.set(i, r);
    inputId = r.outputId;
  }
  const anchor = records.get(base);
  const start = {
    headHeight: q(head),
    anchorId: anchor.id,
    spent: [],
    snapshot: {
      version: 1,
      chainId: chain,
      genesisHash: genesis,
      height: q(base),
      units: [
        {
          id: anchor.outputId,
          weight: "0x1",
          suite: 1,
          commitment: hex(bytes("owner 3")),
        },
      ],
    },
  };
  const queries = [];
  const fetcher = async (url, options) => {
    expect(url).toBe(endpoint);
    expect(options.credentials).toBe("omit");
    const calls = JSON.parse(options.body);
    return Response.json(
      calls
        .map(({ id, method, params }) => {
          const height =
            method === "demos_getTransferByHeight"
              ? Number(BigInt(params[0]))
              : null;
          queries.push({ method, height });
          const result =
            change(method, height, queries, records) ??
            (method === "demos_getHead"
              ? { chainId: chain, height: q(head) }
              : method === "eth_chainId"
                ? "0x50325054"
                : method === "demos_getTransferByHeight"
                  ? records.get(height)
                  : undefined);
          if (result === undefined) throw Error("Unexpected fixture query");
          return { jsonrpc: "2.0", id, result };
        })
        .reverse(),
    );
  };
  return { start, head, fetcher, queries, records };
}
const controller = () => new AbortController();
function run(f, sendAndWait = async () => {}, signal = controller().signal) {
  return streamPinnedHistory(f.start, {
    fetcher: f.fetcher,
    signal,
    nonce,
    sendAndWait,
  });
}
describe("windowed public wallet history", () => {
  test("streams a 267-move gap with verification backpressure, keeps the captured head when the live chain advances", async () => {
    const f = fixture(267, (method) =>
      method === "demos_getHead"
        ? { chainId: chain, height: q(271) }
        : undefined,
    );
    const reached = Promise.withResolvers(),
      resume = Promise.withResolvers();
    const lengths = [];
    let acknowledged = 3;
    const sync = run(f, async (message, height) => {
      expect(message.nonce).toBe(nonce);
      if (message.type === "p2party.wallet.catchup.start.v1") {
        expect(height).toBe("0x3");
        expect(message.headMoveId).toBe(f.records.get(270).id);
        return;
      }
      expect(message.type).toBe("p2party.wallet.catchup.page.v1");
      expect(message.afterHeight).toBe(q(acknowledged));
      lengths.push(message.receipts.length);
      expect(message.receipts).toEqual(
        Array.from(
          { length: message.receipts.length },
          (_, i) => f.records.get(acknowledged + 1 + i).wire,
        ),
      );
      acknowledged += message.receipts.length;
      expect(height).toBe(q(acknowledged));
      if (lengths.length === 1) {
        reached.resolve();
        await resume.promise;
      }
    });
    await reached.promise;
    // The last receipt is fetched once to capture the head before paging.
    expect(f.queries.map((x) => x.height)).toEqual([
      270,
      ...Array.from({ length: 32 }, (_, i) => 4 + i),
    ]);
    resume.resolve();
    const result = await sync;
    expect(lengths).toEqual([32, 32, 32, 32, 32, 32, 32, 32, 11]);
    expect(result.type).toBe("p2party.wallet.catchup.done.v1");
    expect(result.snapshot.height).toBe(q(270));
    expect(result.snapshot.units[0].id).toBe(f.records.get(270).outputId);
    expect(new Set(f.queries.map((x) => x.method))).toEqual(
      new Set(["demos_getHead", "eth_chainId", "demos_getTransferByHeight"]),
    );
  });
  test("zero-length range acknowledges the checkpoint and confirms the same public tip", async () => {
    const f = fixture(0),
      types = [];
    const result = await run(f, async (message, height) => {
      types.push(message.type);
      expect(height).toBe("0x3");
    });
    expect(types).toEqual(["p2party.wallet.catchup.start.v1"]);
    expect(result.snapshot).toEqual(f.start.snapshot);
  });
  test("rejects a changed checkpoint, a changed captured head during or after replay, or a regressed public head", async () => {
    for (const [at, observation] of [
      [3, 1],
      [7, 2],
      [7, 3],
    ]) {
      const f = fixture(4, (method, h, queries, records) => {
        if (
          method === "demos_getTransferByHeight" &&
          h === at &&
          queries.filter((x) => x.height === h).length === observation
        )
          return receipt(h, records.get(h).inputId, "different");
      });
      await expect(run(f)).rejects.toThrow("changed");
    }
    await expect(
      run(
        fixture(3, (m) =>
          m === "demos_getHead" ? { chainId: chain, height: "0x5" } : undefined,
        ),
      ),
    ).rejects.toThrow("changed");
  });
  test("release entrypoint rejects an RPC anchor inconsistent with the pinned checkpoint file", async () => {
    const f = fixture(1);
    const actual = await readFile(
      new URL("../public/wallet/snapshot/checkpoint.json", import.meta.url),
    );
    const fetcher = (url, options) =>
      url instanceof URL ? new Response(actual) : f.fetcher(url, options);
    await expect(
      readPublicCatchup({
        nonce,
        signal: controller().signal,
        fetcher,
        sendAndWait: async () => {
          throw Error("unexpected send");
        },
      }),
    ).rejects.toThrow("Unexpected testnet history");
  });
  test("cancelling after the first acknowledged page prevents another RPC batch or completion", async () => {
    const f = fixture(80),
      stop = controller();
    await expect(
      run(
        f,
        async (message) => {
          if (message.type === "p2party.wallet.catchup.page.v1") stop.abort();
        },
        stop.signal,
      ),
    ).rejects.toThrow();
    expect(f.queries.at(-1).height).toBe(35);
  });
  test("only the expected window, exact signer origin, nonce and verified height advance the public page", async () => {
    const events = new EventTarget(),
      stop = controller();
    const message = {
      type: "p2party.wallet.catchup.page.v1",
      nonce,
      afterHeight: "0x3",
      receipts: ["wire"],
    };
    let sent = 0,
      completed = false;
    const peer = {
      postMessage(value, origin) {
        expect(value).toBe(message);
        expect(origin).toBe(signerOrigin);
        sent++;
      },
    };
    const ack = { type: "p2party.wallet.catchup.ack.v1", nonce, height: "0x4" };
    const dispatch = (data, origin = signerOrigin, source = peer) => {
      const event = new Event("message");
      Object.assign(event, { data, origin, source });
      events.dispatchEvent(event);
    };
    const waiting = awaitVerifiedPage(
      peer,
      message,
      "0x4",
      stop.signal,
      events,
    ).then(() => {
      completed = true;
    });
    dispatch(ack, "https://example.invalid");
    dispatch(ack, signerOrigin, {});
    dispatch({ ...ack, nonce: "wrong" });
    dispatch({ ...ack, height: "0x3" });
    dispatch({ ...ack, handle: "extra" });
    await Promise.resolve();
    expect(completed).toBe(false);
    expect(sent).toBe(1);
    dispatch(ack);
    await waiting;
    const canceled = awaitVerifiedPage(
      peer,
      message,
      "0x4",
      stop.signal,
      events,
    );
    stop.abort();
    await expect(canceled).rejects.toThrow();
  });
});
