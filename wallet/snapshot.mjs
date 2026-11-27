import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { CHAIN, WalletError, exactFields } from "./format.mjs";

// The server's canonical decoded-genesis fingerprint differs from the downloadable file's byte checksum.
export const CANONICAL_GENESIS =
  "0x6bd2366c1034c93827cb1a79118f3cd18d403a35865e4baed5f2d3b3f6adab21";
export function reportedBalance(snapshot, accounts) {
  if (
    !exactFields(snapshot, [
      "version",
      "chainId",
      "genesisHash",
      "height",
      "units",
    ]) ||
    snapshot.version !== 1 ||
    snapshot.chainId !== CHAIN ||
    snapshot.genesisHash !== CANONICAL_GENESIS ||
    typeof snapshot.height !== "string" ||
    !/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/.test(snapshot.height) ||
    snapshot.height !== "0x" + BigInt(snapshot.height).toString(16) ||
    BigInt(snapshot.height) > 0x7fff_ffff_ffff_ffffn ||
    !Array.isArray(snapshot.units) ||
    snapshot.units.length !== 128
  )
    throw new WalletError(
      "Choose a complete Testnet 1 snapshot from a trusted synchronized replica.",
    );
  const owned = new Map(
    accounts.map((account) => [account.commitment, account.suite]),
  );
  const isId = (x) =>
    typeof x === "string" && x.length === 130 && /^0x[0-9a-f]{128}$/.test(x);
  const ids = new Set(),
    commitments = new Set();
  let matched = 0;
  for (const unit of snapshot.units) {
    if (
      !exactFields(unit, ["id", "suite", "commitment", "weight"]) ||
      !isId(unit.id) ||
      !isId(unit.commitment) ||
      ![1, 2].includes(unit.suite) ||
      unit.weight !== "0x1" ||
      ids.has(unit.id) ||
      commitments.has(unit.commitment)
    )
      throw new WalletError(
        "The snapshot contains a duplicate or invalid Testnet 1 unit.",
      );
    ids.add(unit.id);
    commitments.add(unit.commitment);
    if (owned.has(unit.commitment)) {
      if (owned.get(unit.commitment) !== unit.suite)
        throw new WalletError(
          "A reported unit's suite differs from the wallet commitment.",
        );
      matched++;
    }
  }
  // Testnet 1 has 128 indivisible units of weight one. This is an observation of the supplied file.
  return {
    amount: String(matched),
    height: BigInt(snapshot.height).toString(),
  };
}

// Hash canonical rows independent of SQL/JSON ordering. This is a comparison fingerprint,
// not a signed checkpoint or a proof that the operator published its newest state.
export function snapshotFingerprint(snapshot) {
  const rows = snapshot.units.map(({ id, suite, commitment, weight }) => [
    id,
    suite,
    commitment,
    weight,
  ]);
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return bytesToHex(
    sha256(
      utf8ToBytes(
        JSON.stringify([
          snapshot.version,
          snapshot.chainId,
          snapshot.genesisHash,
          snapshot.height,
          rows,
        ]),
      ),
    ),
  );
}
