import { prepareNewWallet } from "./core.mjs";
import { composeTransfer, requestQrDataUrl } from "./receive.mjs";
import { publicBridgeAvailable, receiveStatus } from "./balance.mjs";

const el = (id) => document.getElementById(id);
const show = (id, visible) => {
  el(id).hidden = !visible;
};
const suite = (id) => (id === 1 ? "ML-DSA-65" : "SLH-DSA-SHA2-192s");
const option = (value, text) => new Option(text, value);

export function installReceiveUI({
  balance,
  adopt,
  isRemembered,
  review,
  resetPayment,
}) {
  let wallet,
    stage,
    creating = false,
    ticket = 0,
    keyUrl,
    publicUrl,
    publicText;
  const signedInputs = new Set(),
    spendable = new Map();
  const tell = (text) => {
    el("receive-status").textContent = text;
  };
  function clearStage() {
    ticket++;
    creating = false;
    stage?.cancel();
    stage = null;
    if (keyUrl) URL.revokeObjectURL(keyUrl);
    keyUrl = null;
    el("kit-download").removeAttribute("href");
    el("check-kit").reset();
    el("kit-remember").checked = false;
    el("new-wallet-code").textContent = "";
    el("show-new-code").textContent = "Show recovery code";
    el("show-new-code").setAttribute("aria-expanded", "false");
    show("new-wallet-code", false);
    show("receive-kit", false);
    show("receive-start", true);
    el("create-receive").disabled = false;
  }
  function clearPublic() {
    if (publicUrl) URL.revokeObjectURL(publicUrl);
    publicUrl = null;
    publicText = null;
    el("download-receive").removeAttribute("href");
    el("receive-text").value = "";
    el("request-qr").removeAttribute("src");
    el("receive-qr").open = false;
    show("request-public-data", false);
  }
  function chooseUnit() {
    el("payer-manual").hidden = !!el("payer-source").value;
    el("payer-unit").required = !el("payer-source").value;
    resetPayment();
  }
  function observe() {
    const { report, stale, busy } = balance.current();
    el("receive-sync").disabled = busy || !publicBridgeAvailable() || !wallet;
    if (!wallet) {
      el("receive-observation").textContent = "";
      return;
    }
    const account = wallet.accounts[Number(el("receive-account").value)];
    if (!account) return;
    const result = receiveStatus(report, account);
    const words = {
      received: "Payment received and unspent",
      spent: "Payment received, then spent",
      awaiting: "No payment recorded",
      unknown: "Receipt status unavailable",
    };
    const height =
      result.height === null || result.height === undefined
        ? ""
        : " at height " + result.height;
    const history = [];
    if (result.receivedHeight !== undefined)
      history.push("Received at height " + result.receivedHeight + ".");
    if (result.spentHeight !== undefined)
      history.push("Spent at height " + result.spentHeight + ".");
    el("receive-observation").textContent =
      (stale
        ? "Last known report. "
        : !result.verified && report
          ? "Imported snapshot. "
          : "") +
      words[result.state] +
      height +
      ". " +
      (history.length ? history.join(" ") + " " : "") +
      (stale
        ? "The latest check failed. A later payment may have arrived."
        : !report
          ? "Sync with the validator to check this request."
          : !result.verified
            ? "An imported file does not authenticate receipt."
            : "Later activity requires another sync.");
    const used =
      result.verified &&
      (result.state === "received" || result.state === "spent");
    if (used) clearPublic();
    else {
      const text = wallet.paymentRequest(account.commitment);
      if (text !== publicText) {
        clearPublic();
        publicText = text;
        el("receive-text").value = text;
        publicUrl = URL.createObjectURL(
          new Blob([text], { type: "application/json" }),
        );
        el("download-receive").href = publicUrl;
      }
      show("request-public-data", true);
    }
    const select = el("payer-source"),
      previous = select.value,
      oldKeys = [...spendable.keys()].join(",");
    spendable.clear();
    if (!stale)
      for (const entry of wallet.accounts) {
        const state = receiveStatus(report, entry);
        if (
          state.verified &&
          state.state === "received" &&
          state.unit &&
          !signedInputs.has(state.unit.id)
        )
          spendable.set(state.unit.id, state.unit);
      }
    if (oldKeys !== [...spendable.keys()].join(",")) {
      select.replaceChildren(
        ...[...spendable.values()].map((u) =>
          option(
            u.id,
            "1 P2PARTY · " + u.id.slice(0, 9) + "…" + u.id.slice(-6),
          ),
        ),
        option("", "Enter unit details"),
      );
      if (spendable.has(previous)) select.value = previous;
      chooseUnit();
    }
  }
  function display(walletSession) {
    if (wallet?.walletId !== walletSession.walletId) signedInputs.clear();
    clearStage();
    clearPublic();
    wallet = walletSession;
    el("create-receive").textContent = "Create a receive request";
    show("receive-restore", false);
    el("receive-account").replaceChildren(
      ...wallet.accounts.map((a, index) =>
        option(
          String(index),
          "Request " +
            (index + 1) +
            " · " +
            suite(a.suite) +
            " · " +
            a.readHandle.slice(-8),
        ),
      ),
    );
    el("receive-account").value = String(wallet.accounts.length - 1);
    show("receive-offline-help", !publicBridgeAvailable());
    show("receive-public", true);
    observe();
  }
  function reset() {
    clearStage();
    clearPublic();
    wallet = null;
    spendable.clear();
    signedInputs.clear();
    el("create-receive").textContent = "Create a wallet";
    show("receive-restore", true);
    show("receive-public", false);
    el("receive-account").replaceChildren();
    el("receive-observation").textContent = "";
    el("compose-form").reset();
    el("payer-source").replaceChildren(option("", "Enter unit details"));
    chooseUnit();
    tell("");
  }
  el("create-receive").addEventListener("click", async () => {
    if (creating || stage) return;
    const run = ++ticket;
    creating = true;
    el("create-receive").disabled = true;
    tell("Preparing an encrypted backup…");
    try {
      const id = Number(el("receive-suite").value);
      const pending = await (wallet
        ? wallet.prepareReceive(id)
        : prepareNewWallet(id));
      if (run !== ticket) {
        pending.cancel();
        return;
      }
      stage = pending;
      keyUrl = URL.createObjectURL(
        new Blob([pending.archive], { type: "application/octet-stream" }),
      );
      el("kit-download").href = keyUrl;
      el("kit-download").download = pending.filename;
      el("kit-remember").checked = Boolean(wallet && isRemembered());
      el("kit-help").textContent = wallet
        ? "This file includes your new request and the keys from the backup you opened. Take this updated file to your other browser and use your original recovery code."
        : "These two items let you open this wallet on another browser. Save both before sharing a payment request.";
      el("kit-check-step").textContent =
        (wallet ? "2" : "3") + ". Check that you can reopen the file";
      show("new-code-area", !wallet);
      show("receive-public", false);
      show("receive-start", false);
      show("receive-kit", true);
      tell("");
      el("receive-kit-heading").focus();
    } catch (error) {
      if (run === ticket) tell(error.message);
    } finally {
      if (run === ticket) {
        creating = false;
        el("create-receive").disabled = false;
      }
    }
  });
  el("cancel-kit").addEventListener("click", () => {
    clearStage();
    show("receive-public", Boolean(wallet));
    tell("Backup preparation cancelled.");
    el("create-receive").focus();
  });
  el("show-new-code").addEventListener("click", () => {
    if (!stage || wallet) return;
    const reveal = el("new-wallet-code").hidden;
    el("new-wallet-code").textContent = reveal ? stage.getRecoveryCode() : "";
    show("new-wallet-code", reveal);
    el("show-new-code").textContent = reveal
      ? "Hide recovery code"
      : "Show recovery code";
    el("show-new-code").setAttribute("aria-expanded", String(reveal));
  });
  el("kit-code").addEventListener("focus", () => {
    if (!el("new-wallet-code").hidden) el("show-new-code").click();
  });
  el("check-kit").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!stage || creating) return;
    creating = true;
    const current = stage,
      run = ticket,
      code = el("kit-code").value.trim(),
      file = el("kit-file").files[0],
      remember = el("kit-remember").checked;
    el("kit-code").value = "";
    try {
      if (!file || !file.size || file.size > 2 * 1024 * 1024)
        throw Error("Choose the exact encrypted backup you downloaded.");
      const archive = await file.text();
      if (run !== ticket) return;
      const next = await current.confirm(archive, code);
      if (run !== ticket) {
        next.lock();
        return;
      }
      adopt(next, archive, remember);
      tell("Backup checked. The public request is ready to share.");
      el("receive-heading").focus();
    } catch (error) {
      if (run === ticket) tell(error.message);
    } finally {
      if (run === ticket) creating = false;
    }
  });
  el("receive-account").addEventListener("change", () => {
    tell("");
    observe();
  });
  el("copy-receive").addEventListener("click", async () => {
    if (!publicText) return;
    try {
      await navigator.clipboard.writeText(publicText);
      tell("Public request copied.");
    } catch {
      el("receive-text").focus();
      el("receive-text").select();
      tell("The public request is selected. Use your device’s Copy command.");
    }
  });
  el("receive-qr").addEventListener("toggle", async () => {
    if (!el("receive-qr").open || !publicText) return;
    const text = publicText;
    try {
      const qr = await requestQrDataUrl(text);
      if (publicText === text && el("receive-qr").open)
        el("request-qr").src = qr;
    } catch {
      if (publicText === text)
        tell(
          "The QR could not be generated. You can copy or download the public request.",
        );
    }
  });
  el("receive-sync").addEventListener("click", () => balance.refresh());
  el("payer-source").addEventListener("change", chooseUnit);
  el("compose-form").addEventListener("input", resetPayment);
  el("compose-form").addEventListener("submit", (event) => {
    event.preventDefault();
    resetPayment();
    try {
      const raw = el("payer-expiry").value.trim();
      if (
        !/^(?:0|[1-9][0-9]{0,19})$/.test(raw) ||
        BigInt(raw) > 0xffffffffffffffffn
      )
        throw Error("Enter a finite decimal expiry height.");
      let input = spendable.get(el("payer-source").value);
      if (!input) {
        try {
          input = JSON.parse(el("payer-unit").value);
        } catch {
          throw Error(
            "Choose a verified unit or paste the complete unspent unit JSON.",
          );
        }
      }
      if (signedInputs.has(input?.id))
        throw Error("This unit already has a signed payment in this session.");
      review(
        composeTransfer(
          input,
          el("payer-request").value,
          "0x" + BigInt(raw).toString(16),
        ),
      );
    } catch (error) {
      el("status").textContent = error.message;
    }
  });
  return {
    reset,
    setWallet: display,
    observe,
    markSigned(id) {
      signedInputs.add(id);
      observe();
    },
  };
}
