import { encodeQR } from "qr";
import {
  CHAIN,
  GENESIS,
  WalletError,
  checkSuite,
  exactFields,
} from "../format.mjs";

const wrongRequest = () =>
  new WalletError(
    "Choose a public one-unit payment request for P2Party Testnet 1.",
  );
function publicOwner(value) {
  if (
    !exactFields(value, ["suite", "commitment"]) ||
    typeof value.commitment !== "string" ||
    value.commitment.length !== 130 ||
    !/^0x[0-9a-f]{128}$/.test(value.commitment)
  )
    throw wrongRequest();
  checkSuite(value.suite);
  return { suite: value.suite, commitment: value.commitment };
}
export function serializePaymentRequest(owner) {
  return JSON.stringify({
    type: "p2party.payment-request",
    version: 1,
    chainId: CHAIN,
    genesis: GENESIS,
    weight: "0x1",
    recipient: publicOwner(owner),
  });
}
export function parsePaymentRequest(text) {
  try {
    if (typeof text !== "string" || text.length > 2048) throw wrongRequest();
    const data = JSON.parse(text);
    // The public schema uses eight different property names. Refuse duplicate destinations.
    const names = [...text.matchAll(/("(?:[^"\\]|\\.)*")\s*:/g)].map((match) =>
      JSON.parse(match[1]),
    );
    if (names.length !== 8 || new Set(names).size !== 8) throw wrongRequest();
    if (
      !exactFields(data, [
        "type",
        "version",
        "chainId",
        "genesis",
        "weight",
        "recipient",
      ]) ||
      data.type !== "p2party.payment-request" ||
      data.version !== 1 ||
      data.chainId !== CHAIN ||
      data.genesis !== GENESIS ||
      data.weight !== "0x1"
    )
      throw wrongRequest();
    const recipient = publicOwner(data.recipient);
    return {
      type: data.type,
      version: 1,
      chainId: CHAIN,
      genesis: GENESIS,
      weight: "0x1",
      recipient,
    };
  } catch {
    throw wrongRequest();
  }
}
export function composeTransfer(input, requestText, expiryHeight) {
  const { recipient, weight } = parsePaymentRequest(requestText);
  if (!input || input.weight !== weight)
    throw new WalletError(
      "Choose one unspent Testnet 1 unit for this payment request.",
    );
  return { chainId: CHAIN, genesis: GENESIS, input, recipient, expiryHeight };
}

export function requestQrDataUrl(text) {
  const canonical = serializePaymentRequest(
    parsePaymentRequest(text).recipient,
  );
  return encodeQR(canonical, "data-url", {
    ecc: "medium",
    border: 4,
    scale: 4,
  });
}
