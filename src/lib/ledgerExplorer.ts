export const TESTNET_RPC = "https://signaling.p2party.com/rpc";
export const TESTNET_CHAIN_ID =
  "0x09a0ffa8e6af6aeb11d26671c6c76648965d60509cc3b7a1a4b454b6ec73c760";
const RPC_CHAIN_ID = 0x50325054n;
const MAX_HEIGHT = (1n << 63n) - 1n;
const MOVE_ID = /^0x[0-9a-f]{128}$/u;
const SUITES = new Map([
  [1, { name: "ML-DSA-65", bytes: 5505 }],
  [2, { name: "SLH-DSA-SHA2-192s", bytes: 16516 }],
]);

export interface ExplorerReceipt {
  height: bigint;
  id: string;
  inputId: string;
  outputId: string;
  wire: string;
  weight: bigint;
  expiryHeight: bigint;
  spendSuite: string;
  receiveSuite: string;
  wireBytes: number;
}

export interface ExplorerOverview {
  height: bigint;
  chainId: string;
  rpcChainId: bigint;
  receipts: ExplorerReceipt[];
  olderThan: bigint | null;
}

type Method =
  | "eth_getBalance"
  | "demos_getHead"
  | "eth_chainId"
  | "demos_getTransfer"
  | "demos_getTransferByHeight";
type Call = readonly [method: Method, params: string[]];

const invalidResponse = () =>
  new Error("The testnet RPC returned an inconsistent or malformed response.");
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalidResponse();
  return value as Record<string, unknown>;
}

function quantity(value: unknown, maximum = MAX_HEIGHT): bigint {
  if (
    typeof value !== "string" ||
    !/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/u.test(value)
  )
    throw invalidResponse();
  const n = BigInt(value);
  if (n > maximum) throw invalidResponse();
  return n;
}

// The server accepts up to eight calls per batch. Reorder by ID because a
// conforming JSON-RPC server can return them in any order.
async function read(calls: Call[], signal?: AbortSignal): Promise<unknown[]> {
  const timeout = AbortSignal.timeout(12_000);
  const response = await fetch(TESTNET_RPC, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    body: JSON.stringify(
      calls.map(([method, params], id) => ({
        jsonrpc: "2.0",
        id,
        method,
        params,
      })),
    ),
  });
  if (!response.ok)
    throw new Error(`Testnet RPC request failed (HTTP ${response.status}).`);
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    if (signal?.aborted || timeout.aborted) throw error;
    throw invalidResponse();
  }
  if (!Array.isArray(data) || data.length !== calls.length)
    throw invalidResponse();
  const results = new Map<number, unknown>();
  for (const entry of data) {
    const item = record(entry);
    const id = item.id;
    if (
      item.jsonrpc !== "2.0" ||
      typeof id !== "number" ||
      !Number.isInteger(id) ||
      id < 0 ||
      id >= calls.length ||
      results.has(id)
    )
      throw invalidResponse();
    if ("error" in item)
      throw new Error(`The testnet RPC could not complete ${calls[id][0]}.`);
    if (!("result" in item)) throw invalidResponse();
    results.set(id, item.result);
  }
  return calls.map((_, i) => results.get(i));
}

const hex = (bytes: Uint8Array) =>
  "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const heightHex = (height: bigint) => "0x" + height.toString(16);

// This is the native wallet's length-prefixed SHA-512 domain encoding.
async function tagged(tag: string, bytes: Uint8Array): Promise<Uint8Array> {
  const domain = new TextEncoder().encode(tag);
  const input = new Uint8Array(1 + domain.length + bytes.length);
  input[0] = domain.length;
  input.set(domain, 1);
  input.set(bytes, 1 + domain.length);
  return new Uint8Array(await crypto.subtle.digest("SHA-512", input));
}

async function receipt(
  value: unknown,
  expected: bigint | string,
): Promise<ExplorerReceipt> {
  const item = record(value);
  const { wire, id, inputId, outputId } = item;
  const height = quantity(item.height);
  if (
    height === 0n ||
    typeof wire !== "string" ||
    !(wire.length === 2 + 2 * 5505 || wire.length === 2 + 2 * 16516) ||
    !/^0x[0-9a-f]+$/u.test(wire) ||
    typeof id !== "string" ||
    !MOVE_ID.test(id) ||
    typeof inputId !== "string" ||
    !MOVE_ID.test(inputId) ||
    typeof outputId !== "string" ||
    !MOVE_ID.test(outputId) ||
    (typeof expected === "bigint" ? height !== expected : id !== expected)
  )
    throw invalidResponse();
  const bytes = new Uint8Array((wire.length - 2) / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = Number.parseInt(wire.slice(2 + 2 * i, 4 + 2 * i), 16);
  const spend = SUITES.get(bytes[114]);
  const receive = SUITES.get(bytes[115]);
  if (
    !spend ||
    !receive ||
    bytes.length !== spend.bytes ||
    bytes[0] !== 1 ||
    bytes[1] !== 1 ||
    hex(bytes.subarray(2, 34)) !== TESTNET_CHAIN_ID ||
    hex(bytes.subarray(34, 98)) !== inputId
  )
    throw invalidResponse();
  const move = await tagged("move/id", bytes);
  const outputPreimage = new Uint8Array(68);
  outputPreimage.set(move);
  if (
    hex(move) !== id ||
    hex(await tagged("unit/id", outputPreimage)) !== outputId
  )
    throw invalidResponse();
  const view = new DataView(bytes.buffer);
  return {
    height,
    id,
    inputId,
    outputId,
    wire,
    weight: view.getBigUint64(98),
    expiryHeight: view.getBigUint64(106),
    spendSuite: spend.name,
    receiveSuite: receive.name,
    wireBytes: bytes.length,
  };
}

const identityCalls: Call[] = [
  ["demos_getHead", []],
  ["eth_chainId", []],
];

function checkedHead(value: unknown, network: unknown) {
  const current = record(value);
  if (
    current.chainId !== TESTNET_CHAIN_ID ||
    quantity(network) !== RPC_CHAIN_ID
  )
    throw new Error(
      "The RPC returned a different network from P2Party Testnet 1.",
    );
  return quantity(current.height);
}

export async function lookupTestnetBalance(
  handle: string,
  signal?: AbortSignal,
) {
  const address = handle.trim();
  if (!/^0x[0-9a-fA-F]{40}$/u.test(address)) {
    throw new Error(
      "Enter a public read handle beginning with 0x followed by 40 hexadecimal digits.",
    );
  }
  const [tip, network] = await read(identityCalls, signal);
  const height = checkedHead(tip, network);
  const [value] = await read(
    [["eth_getBalance", [address.toLowerCase(), heightHex(height)]]],
    signal,
  );
  return { balance: quantity(value, (1n << 64n) - 1n), height };
}

export async function loadExplorerOverview(
  signal?: AbortSignal,
  startHeight?: bigint,
): Promise<ExplorerOverview> {
  if (
    startHeight !== undefined &&
    (startHeight < 0n || startHeight > MAX_HEIGHT)
  )
    throw new Error("Invalid page height.");
  const [tip, network] = await read(identityCalls, signal);
  const height = checkedHead(tip, network);
  const start = startHeight ?? height;
  if (start > height)
    throw new Error("The requested page is above the current testnet height.");
  const heights = Array.from(
    { length: Number(start < 6n ? start : 6n) },
    (_, i) => start - BigInt(i),
  );
  const values = heights.length
    ? await read(
        heights.map((h) => ["demos_getTransferByHeight", [heightHex(h)]]),
        signal,
      )
    : [];
  const receipts = await Promise.all(
    values.map((value, i) => receipt(value, heights[i])),
  );
  return {
    height,
    chainId: TESTNET_CHAIN_ID,
    rpcChainId: RPC_CHAIN_ID,
    receipts,
    olderThan: start > 6n ? start - 6n : null,
  };
}

export async function lookupExplorerReceipt(
  query: string,
  signal?: AbortSignal,
): Promise<ExplorerReceipt | "genesis" | null> {
  const text = query.trim().toLowerCase();
  const byId = MOVE_ID.test(text);
  if (/^0x[0-9a-f]{64}$/u.test(text))
    throw new Error(
      "This testnet uses 64-byte native move IDs. A 32-byte Ethereum transaction hash cannot be looked up here.",
    );
  if (!byId && !/^(?:[0-9]{1,19}|0x[0-9a-f]{1,16})$/u.test(text))
    throw new Error(
      "Enter a decimal or hexadecimal height, or a 64-byte native move ID beginning with 0x.",
    );
  const key = byId ? text : BigInt(text);
  if (typeof key === "bigint" && key > MAX_HEIGHT)
    throw new Error("That height exceeds the testnet range.");
  if (key === 0n) return "genesis";
  const method = byId ? "demos_getTransfer" : "demos_getTransferByHeight";
  const [tip, network, value] = await read(
    [
      ...identityCalls,
      [method, [typeof key === "bigint" ? heightHex(key) : key]],
    ],
    signal,
  );
  const height = checkedHead(tip, network);
  if (value === null) {
    if (typeof key === "bigint" && key <= height) throw invalidResponse();
    return null;
  }
  return receipt(value, key);
}
