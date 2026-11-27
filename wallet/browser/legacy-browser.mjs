import { base64url } from "jose";
import { receiveOwner } from "@p2party/ledger-client";
import { CHAIN, GENESIS, packArchive } from "../format.mjs";
import { importSigner } from "./keys.mjs";

// A legacy receive folder represents one unit. Compare its independently
// saved public commitment before issuing the replacement recovery materials.
export async function convertLegacy(privateDer, nonce, expected) {
  if (
    !(privateDer instanceof Uint8Array) ||
    privateDer.length > 12 * 1024 ||
    !(nonce instanceof Uint8Array) ||
    nonce.length !== 32 ||
    typeof expected !== "string" ||
    !/^0x[0-9a-f]{128}$/.test(expected)
  )
    throw Error(
      "Choose the original key.pk8, 32-byte nonce and full receive commitment.",
    );
  let signer;
  for (const suite of [1, 2]) {
    try {
      signer = importSigner(privateDer, suite);
      break;
    } catch {
      /* Try the other Testnet 1 suite. */
    }
  }
  if (!signer)
    throw Error("This file is not a supported Testnet 1 spending key.");
  const key = crypto.getRandomValues(new Uint8Array(32));
  try {
    const { commitment, suite } = receiveOwner(signer, nonce);
    if (commitment !== expected)
      throw Error("These files do not open that receive commitment.");
    const walletId = crypto.randomUUID();
    const archive = await packArchive(
      {
        version: 1,
        chainId: CHAIN,
        genesis: GENESIS,
        walletId,
        revision: 1,
        receives: [
          {
            suite,
            commitment,
            key: base64url.encode(privateDer),
            nonce: base64url.encode(nonce),
          },
        ],
      },
      key,
    );
    return {
      archive,
      code: "P2W1-" + base64url.encode(key),
      filename: "p2party-testnet1-" + walletId + "-r1.jwe",
    };
  } finally {
    signer.lock();
    key.fill(0);
  }
}

export function installLegacyImport() {
  const el = (id) => document.getElementById(id);
  const form = el("legacy-form"),
    result = el("legacy-result"),
    message = el("legacy-status");
  let material,
    objectUrl,
    generation = 0;
  const clear = () => {
    generation++;
    material = null;
    result.hidden = true;
    el("legacy-code").textContent = "";
    el("legacy-download").removeAttribute("href");
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    message.textContent = "";
    form.reset();
  };
  const panel = el("legacy-panel");
  panel.addEventListener("toggle", () => {
    if (!panel.open) clear();
  });
  window.addEventListener("pagehide", clear);
  el("restore-form").addEventListener("submit", () => {
    clear();
    panel.open = false;
  });
  form.addEventListener("input", () => {
    generation++;
    material = null;
    result.hidden = true;
    el("legacy-code").textContent = "";
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    el("legacy-download").removeAttribute("href");
    message.textContent = "";
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = ++generation;
    let der, nonce;
    el("legacy-convert").disabled = true;
    try {
      const a = el("legacy-key").files[0],
        b = el("legacy-nonce").files[0];
      const expected = el("legacy-commitment").value.trim();
      if (!a || !b || !a.size || a.size > 12 * 1024 || b.size !== 32)
        throw Error("Choose the original key.pk8 and 32-byte nonce files.");
      der = new Uint8Array(await a.arrayBuffer());
      nonce = new Uint8Array(await b.arrayBuffer());
      const kit = await convertLegacy(der, nonce, expected);
      if (token !== generation) return;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      form.reset();
      material = kit;
      el("legacy-code").textContent = "";
      objectUrl = URL.createObjectURL(
        new Blob([kit.archive], { type: "application/octet-stream" }),
      );
      el("legacy-download").href = objectUrl;
      el("legacy-download").download = kit.filename;
      result.hidden = false;
      message.textContent =
        "Commitment verified. Download the encrypted file and keep its new recovery code separately.";
    } catch (e) {
      if (token === generation) message.textContent = e.message;
    } finally {
      der?.fill(0);
      nonce?.fill(0);
      el("legacy-convert").disabled = false;
    }
  });
  el("legacy-show-code").addEventListener("click", () => {
    if (material) el("legacy-code").textContent = material.code;
  });
}
