import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  loadExplorerOverview,
  lookupExplorerReceipt,
  TESTNET_CHAIN_ID,
  TESTNET_RPC,
} from "../src/lib/ledgerExplorer";

function tag(domain: string, bytes: Buffer): Buffer {
  return createHash("sha512")
    .update(Buffer.from([domain.length]))
    .update(domain)
    .update(bytes)
    .digest();
}

// Synthetic signed-byte layouts exercise receipt identifiers. The explorer
// checks the byte commitment and does not verify the post-quantum signature.
function fixture(height: number, suite = 1) {
  const body = Buffer.alloc(suite === 1 ? 5505 : 16516);
  body[0] = 1;
  body[1] = 1;
  body.set(Buffer.from(TESTNET_CHAIN_ID.slice(2), "hex"), 2);
  body.fill(height, 34, 98);
  body.writeBigUInt64BE(1n, 98);
  body[114] = suite;
  body[115] = 3 - suite;
  const id = tag("move/id", body);
  return {
    height: "0x" + height.toString(16),
    id: "0x" + id.toString("hex"),
    inputId: "0x" + body.subarray(34, 98).toString("hex"),
    outputId:
      "0x" +
      tag("unit/id", Buffer.concat([id, Buffer.alloc(4)])).toString("hex"),
    wire: "0x" + body.toString("hex"),
  };
}

type Requested = {
  jsonrpc: string;
  id: number;
  method: string;
  params: string[];
};
const fixtures = Array.from({ length: 10 }, (_, i) =>
  fixture(i + 1, (i % 2) + 1),
);
let tip = 9;
const normal = (call: Requested) => {
  if (call.method === "eth_chainId") return "0x50325054";
  if (call.method === "demos_getHead")
    return { chainId: TESTNET_CHAIN_ID, height: "0x" + tip.toString(16) };
  if (call.method === "demos_getTransferByHeight")
    return fixtures.find((r) => r.height === call.params[0]) ?? null;
  if (call.method === "demos_getTransfer")
    return fixtures.find((r) => r.id === call.params[0]) ?? null;
  throw new Error("Unexpected RPC method");
};
const mockRpc = (handler: (request: Requested) => unknown = normal) =>
  spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    expect(input).toBe(TESTNET_RPC);
    expect(init?.credentials).toBe("omit");
    const batch = JSON.parse(String(init?.body)) as Requested[];
    expect(batch.length).toBeLessThanOrEqual(8);
    return Response.json(
      batch
        .map((call) => ({ jsonrpc: "2.0", id: call.id, result: handler(call) }))
        .reverse(),
    );
  });
afterEach(() => {
  tip = 9;
  if ("mockRestore" in globalThis.fetch)
    (globalThis.fetch as unknown as { mockRestore: () => void }).mockRestore();
});

describe("public testnet explorer reads", () => {
  test("pages use an inclusive cursor, independent of new transfers and JSON-RPC response order", async () => {
    mockRpc();
    const page = await loadExplorerOverview();
    expect(page.receipts.map((r) => r.height)).toEqual([
      9n,
      8n,
      7n,
      6n,
      5n,
      4n,
    ]);
    expect(page.olderThan).toBe(3n);
    tip = 10;
    const older = await loadExplorerOverview(undefined, page.olderThan!);
    expect(older.receipts.map((r) => r.height)).toEqual([3n, 2n, 1n]);
    expect(older.olderThan).toBeNull();
    expect(older.receipts[1]).toMatchObject({
      spendSuite: "SLH-DSA-SHA2-192s",
      receiveSuite: "ML-DSA-65",
      weight: 1n,
      expiryHeight: 0n,
      wireBytes: 16516,
    });
  });
  test("matches native ID, decimal and hexadecimal height, and returns null for missing transfers", async () => {
    mockRpc();
    const byId = await lookupExplorerReceipt(fixtures[0].id.toUpperCase());
    expect(byId).toEqual(await lookupExplorerReceipt("1"));
    expect(byId).toEqual(await lookupExplorerReceipt("0x1"));
    expect(await lookupExplorerReceipt("11")).toBeNull();
    expect(await lookupExplorerReceipt("0x" + "0".repeat(128))).toBeNull();
  });
  test("genesis has zero transfers and malformed searches make no requests", async () => {
    tip = 0;
    const fetches = mockRpc();
    expect(await lookupExplorerReceipt("0")).toBe("genesis");
    for (const bad of [
      "",
      "-1",
      "1.2",
      "123456789012345678901",
      "0x" + "b".repeat(64),
    ])
      await expect(lookupExplorerReceipt(bad)).rejects.toThrow();
    expect(fetches).not.toHaveBeenCalled();
    expect(await loadExplorerOverview()).toMatchObject({
      height: 0n,
      receipts: [],
      olderThan: null,
    });
    expect(fetches).toHaveBeenCalledTimes(1);
  });
  test("rejects changed signed bytes, mismatched output and incorrect network", async () => {
    let mode = "wire";
    mockRpc((call) => {
      const r = normal(call);
      if (mode === "network" && call.method === "eth_chainId") return "0x1";
      if (call.method !== "demos_getTransferByHeight") return r;
      if (mode === "gap") return null;
      return mode === "wire"
        ? { ...fixtures[0], wire: fixtures[0].wire.slice(0, -2) + "ff" }
        : { ...fixtures[0], outputId: fixtures[1].outputId };
    });
    for (mode of ["wire", "output", "network", "gap"])
      await expect(lookupExplorerReceipt("1")).rejects.toThrow();
  });
  test("rejects malformed envelopes, server errors and failed transport", async () => {
    let mode = 0;
    spyOn(globalThis, "fetch").mockImplementation(async () => {
      if (mode === 0)
        return Response.json([
          { jsonrpc: "2.0", id: 0, result: {} },
          { jsonrpc: "2.0", id: 0, result: {} },
        ]);
      if (mode === 1)
        return Response.json([
          { jsonrpc: "2.0", id: 0, error: { code: -1 } },
          { jsonrpc: "2.0", id: 1, result: "0x0" },
        ]);
      if (mode === 2) return new Response("", { status: 503 });
      if (mode === 3) return new Response("bad json");
      throw new TypeError("Network unreachable");
    });
    for (mode = 0; mode < 5; mode++)
      await expect(loadExplorerOverview()).rejects.toThrow();
  });
});
