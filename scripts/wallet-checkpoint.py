"""Replay the published Testnet 1 prefix with a local libdemos native verifier."""
import argparse
import datetime
import hashlib
import json
import subprocess
import urllib.request
from pathlib import Path

GENESIS_FILE_HASH = "38d42d50a5a6d5ceb43fd6f63235e542716b1df5ccff59161c5fd7810aed17c6"
CANONICAL_GENESIS = "0x6bd2366c1034c93827cb1a79118f3cd18d403a35865e4baed5f2d3b3f6adab21"
RPC = "https://signaling.p2party.com/rpc"


def rpc(method, params):
    call = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    request = urllib.request.Request(
        RPC, data=json.dumps(call).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)["result"]


def raw(value):
    return bytes.fromhex(value.removeprefix("0x"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--native-verifier", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    genesis = (root / "public/downloads/testnet-1/genesis.json").read_bytes()
    if hashlib.sha256(genesis).hexdigest() != GENESIS_FILE_HASH:
        raise ValueError("Genesis checksum mismatch")
    manifest = json.loads(genesis)
    chain_id = manifest["chainId"]
    head = rpc("demos_getHead", [])
    if head["chainId"] != chain_id or rpc("eth_chainId", []) != hex(manifest["rpcChainId"]):
        raise ValueError("Unexpected public network")
    unspent = {u["id"]: u for u in manifest["units"]}
    owners = {u["commitment"] for u in unspent.values()}
    ids = set(unspent)
    spent = []
    for height in range(1, int(head["height"], 16) + 1):
        receipt = rpc("demos_getTransferByHeight", [hex(height)])
        wire = raw(receipt["wire"])
        source = unspent.pop(receipt["inputId"])
        if receipt["height"] != hex(height) or wire[34:98] != raw(source["id"]):
            raise ValueError("Receipt and source disagree")
        # DLV1 takes the spend/receive policy masks, execution height, and
        # independently known input before the candidate signed bytes.
        prefix = b"".join([
            b"DLV1", raw(chain_id), bytes([3, 3]), height.to_bytes(8, "big"),
            raw(source["id"]), int(source["weight"], 16).to_bytes(8, "big"),
            bytes([source["suite"]]), raw(source["commitment"]),
        ])
        out = subprocess.run(
            [args.native_verifier.resolve()], input=prefix + wire,
            capture_output=True, check=True, timeout=15,
        ).stdout
        if (
            len(out) != 193
            or out[:64] != raw(receipt["id"])
            or out[64:128] != raw(receipt["outputId"])
        ):
            raise ValueError("Native verifier and public receipt disagree")
        dest = {
            "id": receipt["outputId"], "suite": out[128],
            "commitment": "0x" + out[129:].hex(), "weight": source["weight"],
        }
        if dest["id"] in ids or dest["commitment"] in owners:
            raise ValueError("Output or commitment reused")
        spent.append({k: source[k] for k in ("id", "suite", "commitment")})
        ids.add(dest["id"])
        owners.add(dest["commitment"])
        unspent[dest["id"]] = dest
    snapshot = {
        "version": 1, "chainId": chain_id, "genesisHash": CANONICAL_GENESIS,
        "height": head["height"], "units": sorted(unspent.values(), key=lambda u: u["id"]),
    }
    if len(snapshot["units"]) != 128 or any(u["weight"] != "0x1" for u in unspent.values()):
        raise ValueError("Supply mismatch")
    now = datetime.datetime.now(datetime.timezone.utc)
    timestamp = now.isoformat(timespec="seconds").replace("+00:00", "Z")
    result = {"observedAt": timestamp, "snapshot": snapshot, "spent": spent}
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print("Verified", len(spent), "public receipts and", len(unspent), "unspent units at", head["height"])


if __name__ == "__main__":
    main()
