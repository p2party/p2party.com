import { readPublicSnapshot, signerOrigin } from "./broker.mjs";
const status = document.getElementById("status"),
  retry = document.getElementById("retry"),
  download = document.getElementById("download");
async function refresh() {
  retry.hidden = true;
  download.hidden = true;
  status.textContent = "Reading Testnet 1…";
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
      "Public ledger read at height " +
      BigInt(message.headHeight).toString() +
      ". Your wallet can now check its local balance.";
  } catch {
    status.textContent =
      "Could not verify a current Testnet 1 snapshot. Your wallet can keep its previously checked balance.";
    retry.hidden = false;
    if (window.opener)
      window.opener.postMessage(
        { type: "p2party.wallet.snapshot.error.v1" },
        signerOrigin,
      );
  }
}
retry.addEventListener("click", refresh);
refresh();
