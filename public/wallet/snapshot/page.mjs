import { readPublicSnapshot } from "./broker.mjs?v=2";

const status = document.getElementById("status");
const retry = document.getElementById("retry");
const download = document.getElementById("download");
const account = document.getElementById("account");

account.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && account.open) {
    account.open = false;
    account.querySelector("summary").focus();
  }
});
document.addEventListener("click", (event) => {
  if (!account.contains(event.target)) account.open = false;
});

async function refresh() {
  retry.hidden = true;
  download.hidden = true;
  status.textContent = "Checking Testnet 1…";
  try {
    const message = await readPublicSnapshot();
    if (download.hasAttribute("href")) URL.revokeObjectURL(download.href);
    download.href = URL.createObjectURL(
      new Blob([JSON.stringify(message.snapshot)], {
        type: "application/json",
      }),
    );
    download.hidden = false;
    status.textContent =
      "Public history checked through block " +
      BigInt(message.headHeight) +
      ".";
  } catch {
    status.textContent =
      "Public history is unavailable. Check your connection and try again.";
    retry.hidden = false;
  }
}
retry.addEventListener("click", refresh);
void refresh();
