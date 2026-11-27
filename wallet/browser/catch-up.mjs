import { CHAIN, WalletError, exactFields } from "../format.mjs";
import { CANONICAL_GENESIS } from "../snapshot.mjs";
import { createReplay } from "./public-ledger.mjs";

const kind = "p2party.wallet.catchup.";
const isNonce = (value) =>
  typeof value === "string" &&
  value.length === 64 &&
  /^[0-9a-f]{64}$/.test(value);
export function catchUpSession(checkpoint) {
  let nonce,
    stream,
    busy = false,
    closed = false;
  function cancel() {
    closed = true;
    stream?.cancel();
  }
  const error = () =>
    new WalletError(
      "The complete validator history was not verified. Your last observation is preserved.",
    );
  return {
    cancel,
    async accept(message, signal) {
      if (closed || busy || !isNonce(message?.nonce)) {
        cancel();
        throw error();
      }
      busy = true;
      try {
        signal?.throwIfAborted();
        if (!stream && message.type === kind + "start.v1") {
          if (
            !exactFields(message, [
              "type",
              "nonce",
              "chainId",
              "genesisHash",
              "fromHeight",
              "headHeight",
              "headMoveId",
            ]) ||
            message.chainId !== CHAIN ||
            message.genesisHash !== CANONICAL_GENESIS ||
            message.fromHeight !== checkpoint.snapshot.height ||
            typeof message.headMoveId !== "string"
          )
            throw error();
          nonce = message.nonce;
          stream = createReplay(
            checkpoint,
            message.headHeight,
            message.headMoveId,
          );
        } else {
          if (!stream || message.nonce !== nonce) throw error();
          if (
            message.type === kind + "page.v1" &&
            exactFields(message, ["type", "nonce", "afterHeight", "receipts"])
          ) {
            await stream.append(message.afterHeight, message.receipts, signal);
          } else if (
            message.type === kind + "done.v1" &&
            exactFields(message, ["type", "nonce", "snapshot"])
          ) {
            const evidence = stream.finish(message.snapshot);
            closed = true;
            return { evidence };
          } else throw error();
        }
        signal?.throwIfAborted();
        if (closed) throw error();
        return { ack: { type: kind + "ack.v1", nonce, height: stream.height } };
      } catch (e) {
        cancel();
        if (signal?.aborted || e instanceof WalletError) throw e;
        throw error();
      } finally {
        busy = false;
      }
    },
  };
}
