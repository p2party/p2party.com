import {
  awaitVerifiedPage,
  readPublicCatchup,
  readPublicSnapshot,
  signerOrigin,
} from "./broker.mjs";
const status = document.getElementById("status"),
  retry = document.getElementById("retry"),
  download = document.getElementById("download");
const catchup = location.hash === "#catch-up";

async function catchUp() {
  const peer = window.opener;
  if (!peer || peer.closed) {
    status.textContent = "Open Sync with validator inside your wallet.";
    return;
  }
  const controller = new AbortController();
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const cancel = () => controller.abort();
  window.addEventListener("pagehide", cancel, { once: true });
  const poll = setInterval(() => {
    if (peer.closed) cancel();
  }, 500);
  try {
    const done = await readPublicCatchup({
      signal: controller.signal,
      nonce,
      sendAndWait: async (message, height) => {
        status.textContent =
          "Checking public history at height " + BigInt(height) + ".";
        await awaitVerifiedPage(peer, message, height, controller.signal);
      },
    });
    peer.postMessage(done, signerOrigin);
    status.textContent =
      "Public history sent through height " +
      BigInt(done.snapshot.height) +
      ".";
  } catch {
    if (!controller.signal.aborted) {
      status.textContent =
        "The public history could not be checked. Return to your wallet and try again.";
      try {
        peer.postMessage(
          { type: "p2party.wallet.catchup.error.v1", nonce },
          signerOrigin,
        );
      } catch {}
    }
  } finally {
    clearInterval(poll);
    window.removeEventListener("pagehide", cancel);
    controller.abort();
  }
}
async function refresh() {
  retry.hidden = true;
  download.hidden = true;
  status.textContent = "Checking Testnet 1…";
  try {
    const message = await readPublicSnapshot();
    if (window.opener) {
      window.opener.postMessage(message, signerOrigin);
    }
    if (download.href) URL.revokeObjectURL(download.href);
    download.href = URL.createObjectURL(
      new Blob([JSON.stringify(message.snapshot)], {
        type: "application/json",
      }),
    );
    download.hidden = false;
    status.textContent =
      "Checked public history through height " +
      BigInt(message.headHeight).toString() +
      ". Return to your wallet to see the result, or download this history for an offline check.";
  } catch {
    status.textContent =
      "Could not check the latest history. Try again when you have a connection. Your last checked wallet balance is still available.";
    retry.hidden = false;
    if (window.opener)
      window.opener.postMessage(
        { type: "p2party.wallet.snapshot.error.v1" },
        signerOrigin,
      );
  }
}
retry.addEventListener("click", refresh);
if (catchup) void catchUp();
else void refresh();
