import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
export function verifyNative(payment, owner, chainId, height = 1n) {
  const prefix = Buffer.alloc(183);
  prefix.write("DLV1");
  Buffer.from(chainId.slice(2), "hex").copy(prefix, 4);
  prefix[36] = prefix[37] = 3;
  prefix.writeBigUInt64BE(height, 38);
  Buffer.from(payment.inputId.slice(2), "hex").copy(prefix, 46);
  prefix.writeBigUInt64BE(1n, 110);
  prefix[118] = owner.suite;
  Buffer.from(owner.commitment.slice(2), "hex").copy(prefix, 119);
  return spawnSync(process.env.P2PARTY_WALLET_VERIFIER, [], {
    input: Buffer.concat([prefix, Buffer.from(payment.wire.slice(2), "hex")]),
    env: {},
    timeout: 12000,
  });
}
export function assertVerified(payment, owner, height = 1n) {
  const result = verifyNative(payment, owner, payment.chainId, height);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.length, 193);
  assert.equal(
    "0x" + result.stdout.subarray(0, 64).toString("hex"),
    payment.moveId,
  );
  assert.equal(
    "0x" + result.stdout.subarray(64, 128).toString("hex"),
    payment.outputId,
  );
  assert.equal(result.stdout[128], payment.recipient.suite);
  assert.equal(
    "0x" + result.stdout.subarray(129).toString("hex"),
    payment.recipient.commitment,
  );
}
