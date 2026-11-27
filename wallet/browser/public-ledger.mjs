import prefix from "./checkpoint-history.json" with { type: "json" };
import { transferIds } from "@p2party/ledger-client";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { slh_dsa_sha2_192s } from "@noble/post-quantum/slh-dsa.js";
import { sha512 } from "@noble/hashes/sha2.js";
import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  utf8ToBytes,
} from "@noble/hashes/utils.js";
import { CHAIN, WalletError, exactFields } from "../format.mjs";
import {
  CANONICAL_GENESIS,
  reportedBalance,
  snapshotFingerprint,
} from "../snapshot.mjs";

const SUITES = new Map([
  [1, ml_dsa65],
  [2, slh_dsa_sha2_192s],
]);
const wireHexLengths = new Set(
  Array.from(
    SUITES.values(),
    (suite) =>
      2 + 2 * (244 + suite.lengths.publicKey + suite.lengths.signature),
  ),
);
const LIMIT_BYTES = 8 * 1024 * 1024;
const MAX_MOVES = 256;
const hex = (data) => "0x" + bytesToHex(data);
function tag(name, ...data) {
  return sha512(
    concatBytes(Uint8Array.of(name.length), utf8ToBytes(name), ...data),
  );
}
function invalid() {
  throw new WalletError(
    "The public receipt history does not verify against the pinned Testnet 1 checkpoint.",
  );
}
function checkPointState(checkpoint) {
  const snapshot = checkpoint.snapshot;
  reportedBalance(snapshot, []);
  if (
    !Array.isArray(checkpoint.spent) ||
    BigInt(checkpoint.spent.length) !== BigInt(snapshot.height)
  )
    invalid();
  const unspent = new Map(snapshot.units.map((unit) => [unit.id, unit]));
  const ids = new Set(unspent.keys());
  const commitments = new Set(snapshot.units.map((unit) => unit.commitment));
  for (const entry of checkpoint.spent) {
    if (
      !exactFields(entry, ["id", "suite", "commitment"]) ||
      !SUITES.has(entry.suite) ||
      typeof entry.id !== "string" ||
      entry.id.length !== 130 ||
      !/^0x[0-9a-f]{128}$/.test(entry.id) ||
      typeof entry.commitment !== "string" ||
      entry.commitment.length !== 130 ||
      !/^0x[0-9a-f]{128}$/.test(entry.commitment) ||
      ids.has(entry.id) ||
      commitments.has(entry.commitment)
    )
      invalid();
    ids.add(entry.id);
    commitments.add(entry.commitment);
  }
  const created = new Map(prefix.map((item) => [item.outputId, item.height]));
  const spentAt = new Map(prefix.map((item) => [item.inputId, item.height]));
  const spent = new Map(
    checkpoint.spent.map((item) => [
      item.commitment,
      {
        ...item,
        createdHeight: created.get(item.id) ?? "0x0",
        spentHeight: spentAt.get(item.id),
      },
    ]),
  );
  return { unspent, ids, commitments, created, spent };
}
function applyWire(state, wire, height) {
  if (
    typeof wire !== "string" ||
    !wireHexLengths.has(wire.length) ||
    !/^0x[0-9a-f]+$/.test(wire)
  )
    invalid();
  const raw = hexToBytes(wire.slice(2));
  const { id: moveId, inputId, outputId } = transferIds(wire, CHAIN);
  const input = state.unspent.get(inputId);
  const suite = SUITES.get(raw[114]);
  if (!input || !suite || input.suite !== raw[114] || !SUITES.has(raw[115]))
    invalid();
  const bodyLength = 244 + suite.lengths.publicKey;
  const publicKey = raw.subarray(244, bodyLength);
  const source = hex(
    tag(
      "unit/owner",
      Uint8Array.of(raw[114]),
      raw.subarray(180, 244),
      sha512(publicKey),
    ),
  );
  const destination = hex(raw.subarray(116, 180));
  const header = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const weight = header.getBigUint64(98),
    expiry = header.getBigUint64(106);
  if (
    source !== input.commitment ||
    weight !== BigInt(input.weight) ||
    (expiry !== 0n && height > expiry) ||
    state.ids.has(outputId) ||
    state.commitments.has(destination) ||
    !suite.verify(
      raw.subarray(bodyLength),
      tag("move/body", raw.subarray(0, bodyLength)),
      publicKey,
    )
  )
    invalid();
  state.spent.set(input.commitment, {
    ...input,
    createdHeight: state.created.get(input.id) ?? "0x0",
    spentHeight: hexHeight(height),
  });
  state.created.set(outputId, "0x" + height.toString(16));
  state.unspent.delete(inputId);
  state.unspent.set(outputId, {
    id: outputId,
    suite: raw[115],
    commitment: destination,
    weight: input.weight,
  });
  state.ids.add(outputId);
  state.commitments.add(destination);
  return moveId;
}

const hexHeight = (h) => "0x" + h.toString(16);
function isHeight(h) {
  return (
    typeof h === "string" &&
    h.length <= 18 &&
    /^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(h) &&
    h === hexHeight(BigInt(h)) &&
    BigInt(h) <= 0x7fff_ffff_ffff_ffffn
  );
}
export function createReplay(checkpoint, headHeight, headMoveId) {
  if (
    !isHeight(headHeight) ||
    BigInt(headHeight) < BigInt(checkpoint.snapshot.height) ||
    (headMoveId !== null &&
      (typeof headMoveId !== "string" ||
        headMoveId.length !== 130 ||
        !/^0x[0-9a-f]{128}$/.test(headMoveId)))
  )
    invalid();
  let state = checkPointState(checkpoint),
    height = BigInt(checkpoint.snapshot.height),
    last = prefix.at(-1).id,
    busy = false;
  const target = BigInt(headHeight);
  return {
    get height() {
      return hexHeight(height);
    },
    async append(after, wires, signal) {
      if (
        !state ||
        busy ||
        after !== hexHeight(height) ||
        !Array.isArray(wires) ||
        !wires.length ||
        wires.length > 32 ||
        height + BigInt(wires.length) > target
      )
        invalid();
      busy = true;
      try {
        for (const wire of wires) {
          signal?.throwIfAborted();
          last = applyWire(state, wire, ++height);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        signal?.throwIfAborted();
      } catch (error) {
        state = null;
        if (signal?.aborted || error instanceof WalletError) throw error;
        invalid();
      } finally {
        busy = false;
      }
    },
    finish(snapshot) {
      if (
        !state ||
        busy ||
        height !== target ||
        snapshot?.height !== headHeight ||
        (headMoveId !== null && last !== headMoveId)
      )
        invalid();
      reportedBalance(snapshot, []);
      const verified = {
        ...checkpoint.snapshot,
        height: headHeight,
        units: [...state.unspent.values()],
      };
      if (snapshotFingerprint(verified) !== snapshotFingerprint(snapshot))
        invalid();
      const evidence = {
        snapshot: verified,
        created: state.created,
        spent: state.spent,
      };
      state = null;
      return evidence;
    },
    cancel() {
      state = null;
    },
  };
}
// Retain the old single-response validator for version-one clients and regression vectors.
export async function verifyPublicHistory(checkpoint, response, signal) {
  try {
    if (
      !exactFields(response, [
        "type",
        "chainId",
        "genesisHash",
        "fromHeight",
        "headHeight",
        "receipts",
        "snapshot",
      ]) ||
      response.type !== "p2party.wallet.snapshot.v1" ||
      response.chainId !== CHAIN ||
      response.genesisHash !== CANONICAL_GENESIS ||
      response.fromHeight !== checkpoint.snapshot.height ||
      !Array.isArray(response.receipts)
    )
      invalid();
    if (response.receipts.length > MAX_MOVES)
      throw new WalletError("This history exceeds the legacy refresh limit.");
    const stream = createReplay(checkpoint, response.headHeight, null);
    let size = 0;
    for (let i = 0; i < response.receipts.length; i += 32) {
      const wires = response.receipts.slice(i, i + 32);
      for (const wire of wires) {
        if (typeof wire !== "string") invalid();
        size += wire.length;
        if (size > LIMIT_BYTES)
          throw new WalletError(
            "This history exceeds the legacy refresh limit.",
          );
      }
      await stream.append(stream.height, wires, signal);
    }
    signal?.throwIfAborted();
    return stream.finish(response.snapshot).snapshot;
  } catch (error) {
    if (error instanceof WalletError || signal?.aborted) throw error;
    invalid();
  }
}
