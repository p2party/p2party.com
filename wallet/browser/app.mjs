import { installReceiveUI } from "./receive-ui.mjs";
import { installWalletBalance } from "./balance-navbar.mjs";
import { installLegacyImport } from "./legacy-browser.mjs";
import { restoreWallet } from "./core.mjs";
import { archiveFilename } from "./receive-kit.mjs";

const oldIntents = new Map([
  ["#move-spending-access", "#restore"],
  ["#receive-a-payment", "#receive"],
  ["#check-a-payment", "#balance"],
  ["#navigation-balance", "#balance"],
  ["#show-balance", "#balance"],
]);

function checkLocation() {
  if (
    location.protocol !== "file:" &&
    (/^#watch=0x[0-9a-f]{40}$/i.test(location.hash) ||
      location.hash === "#check-a-public-balance")
  ) {
    location.replace("/wallet/help/" + location.hash);
    return false;
  }
  const intent = oldIntents.get(location.hash);
  if (intent) history.replaceState(null, "", intent);
  return true;
}

if (
  window.top !== window.self ||
  !window.isSecureContext ||
  !window.crypto?.subtle ||
  window.opener ||
  (location.protocol !== "file:" &&
    location.hostname !== "p2party.com" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname))
) {
  const notice = document.createElement("p");
  const link = document.createElement("a");
  link.href = "https://p2party.com/wallet/";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open the secure P2PARTY wallet";
  notice.append(link);
  document.body.replaceChildren(notice);
} else if (checkLocation()) {
  startWalletPage();
}
function startWalletPage() {
  installLegacyImport();
  let receive,
    currentArchive,
    moveUrl,
    restoreForReceive = false;
  const balance = installWalletBalance(() => receive?.observe());
  const el = (id) => document.getElementById(id);
  const show = (id, yes) => {
    el(id).hidden = !yes;
  };
  const status = (message) => {
    el("status").textContent = message;
  };
  const suiteName = (id) => ({ 1: "ML-DSA-65", 2: "SLH-DSA-SHA2-192s" })[id];
  const storedKey = "p2party.testnet1.encrypted-wallet.v1";
  const maxArchive = 2 * 1024 * 1024;
  let wallet,
    selection,
    reviewed,
    signed,
    busy = false,
    generation = 0;
  const downloads = new Set();

  // A fragment carries only a public task name. Wallet material stays in this tab.
  function route(focus = false) {
    el("account-menu").open = false;
    const intent = location.hash.slice(1);
    const restore = !wallet && (intent === "restore" || intent === "balance");
    const receiveTask = intent === "create" || intent === "receive";
    const welcome = !wallet && !restore && !receiveTask;
    if (!wallet && !receiveTask) receive?.reset();
    if (!restore) {
      restoreForReceive = false;
      el("code").value = "";
      el("code").type = "password";
      el("show-code").textContent = "Show code";
      el("show-code").setAttribute("aria-pressed", "false");
    }
    show("welcome", welcome);
    show("restore", restore);
    show("receive", Boolean(wallet) || receiveTask);
    show("back-home", !wallet && !welcome);
    show("dashboard", Boolean(wallet));
    show("overview", Boolean(wallet));
    show("payment", Boolean(wallet));
    if (restore) el("restore-form").after(el("status"));
    else el("save-tool").before(el("status"));
    savedControls();
    const [title, intro] = wallet
      ? [
          "Your wallet",
          "Check payments, share a receive request, or move your backup to another browser.",
        ]
      : restore
        ? [
            intent === "balance" ? "Check your balance" : "Restore your wallet",
            "Open your latest encrypted .jwe file and enter its separate recovery code. You can also paste the file’s contents.",
          ]
        : receiveTask
          ? [
              intent === "create" ? "Create a wallet" : "Receive a payment",
              "Start with a new wallet or open an existing one. Your private keys stay in this browser while you use them.",
            ]
          : [
              "P2PARTY wallet",
              "Create a wallet to receive your first test payment, or open one you already have.",
            ];
    el("title").textContent = title;
    el("intro").textContent = intro;
    el("receive-heading").textContent = wallet
      ? "Receive P2PARTY"
      : intent === "create"
        ? "Your first payment request"
        : "Get a receive request";
    if (focus && intent !== "main") {
      const target =
        wallet && intent === "receive"
          ? "receive-heading"
          : wallet && intent === "balance"
            ? "summary-heading"
            : "title";
      el(target).focus({ preventScroll: true });
      if (target === "title") window.scrollTo(0, 0);
      else el(target).scrollIntoView();
    }
  }
  function normalizedArchive(text) {
    if (typeof text !== "string" || !text.length || text.length > maxArchive)
      throw Error("Choose an encrypted backup up to 2 MiB.");
    let value = text.trim();
    if (value.startsWith("{") || value.startsWith('"')) {
      try {
        const parsed = JSON.parse(value);
        if (parsed?.type === "p2party.payment-request")
          throw Error(
            "This is a public payment request. Open your private .jwe wallet backup to restore.",
          );
        value = typeof parsed === "string" ? parsed : parsed?.archive;
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        throw Error("The pasted JSON does not contain an encrypted backup.");
      }
    }
    if (
      typeof value !== "string" ||
      !/^[A-Za-z0-9_-]+\.\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(
        value,
      )
    )
      throw Error(
        "Choose the backup file itself or paste its encrypted contents. A filename alone cannot open a wallet.",
      );
    return value;
  }
  function loadSaved() {
    try {
      return localStorage.getItem(storedKey);
    } catch {
      return null;
    }
  }
  function savedControls() {
    const saved = Boolean(loadSaved());
    show("saved-area", saved && !el("restore").hidden);
    show("use-saved", saved && !wallet && selection?.kind !== "saved");
  }
  function choose(source) {
    selection = source;
    el("chosen").textContent =
      source?.kind === "file"
        ? "Selected file · " + source.file.name
        : source?.kind === "text"
          ? "Encrypted contents selected."
          : source?.kind === "saved"
            ? "The saved backup is selected. Enter its recovery code."
            : "";
    savedControls();
  }
  function selectFile(file) {
    if (!file || file.size === 0 || file.size > maxArchive) {
      choose(null);
      throw Error("Choose one encrypted backup file up to 2 MiB.");
    }
    el("archive-text").value = "";
    choose({ kind: "file", file });
  }
  function pickText(text) {
    const archive = normalizedArchive(text);
    el("archive").value = "";
    el("archive-text").value = "";
    choose({ kind: "text", archive });
  }
  function resetPayment() {
    reviewed = signed = null;
    el("review-details").replaceChildren();
    show("review-panel", false);
    show("signed-panel", false);
  }
  function lock(message, focus) {
    generation++;
    busy = false;
    wallet?.lock();
    wallet = null;
    currentArchive = null;
    if (moveUrl) URL.revokeObjectURL(moveUrl);
    moveUrl = null;
    el("move-download").removeAttribute("href");
    el("move-download").removeAttribute("download");
    el("move-wallet").open = false;
    receive?.reset();
    balance.lock();
    for (const url of downloads) URL.revokeObjectURL(url);
    downloads.clear();
    resetPayment();
    el("accounts").replaceChildren();
    el("accounts-count").textContent = "";
    el("restore-form").reset();
    el("review-form").reset();
    el("paste-panel").open = false;
    el("payment-panel").open = false;
    el("remember").checked = false;
    el("code").type = "password";
    el("show-code").textContent = "Show code";
    el("show-code").setAttribute("aria-pressed", "false");
    choose(loadSaved() ? { kind: "saved" } : null);
    status(message);
    route(focus);
  }
  function run(action) {
    return async (event) => {
      event.preventDefault();
      if (busy) return;
      busy = true;
      const token = generation;
      const button = event.submitter ?? event.currentTarget;
      if (button instanceof HTMLButtonElement) button.disabled = true;
      try {
        await action(token);
      } catch (err) {
        if (generation === token)
          status(
            err instanceof Error
              ? err.message
              : "The wallet could not complete this action.",
          );
      } finally {
        if (generation === token) busy = false;
        if (button instanceof HTMLButtonElement) button.disabled = false;
      }
    };
  }
  function detailsRow(list, term, value) {
    const dt = document.createElement("dt"),
      dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = value;
    list.append(dt, dd);
  }
  function displayWallet() {
    receive?.setWallet(wallet);
    balance.unlock(wallet);
    if (moveUrl) URL.revokeObjectURL(moveUrl);
    moveUrl = URL.createObjectURL(
      new Blob([currentArchive], { type: "application/octet-stream" }),
    );
    el("move-download").href = moveUrl;
    el("move-download").download = archiveFilename(
      wallet.walletId,
      wallet.revision,
    );
    el("accounts-count").textContent =
      wallet.accounts.length +
      " restored receive " +
      (wallet.accounts.length === 1 ? "request" : "requests") +
      " · Backup revision " +
      wallet.revision;
    const accounts = el("accounts");
    accounts.replaceChildren();
    for (const account of wallet.accounts) {
      const item = document.createElement("details"),
        summary = document.createElement("summary"),
        list = document.createElement("dl"),
        button = document.createElement("button");
      summary.textContent =
        suiteName(account.suite) +
        " · " +
        account.readHandle.slice(0, 8) +
        "…" +
        account.readHandle.slice(-6);
      detailsRow(list, "Full receive commitment", account.commitment);
      detailsRow(list, "Public balance handle", account.readHandle);
      button.type = "button";
      button.className = "secondary";
      button.textContent = "Verify spending access";
      button.addEventListener(
        "click",
        run(async (token) => {
          status("Checking this account’s signing key offline…");
          await wallet.prove(account.commitment);
          if (token === generation)
            status("Spending access verified for " + summary.textContent + ".");
        }),
      );
      item.append(summary, list, button);
      accounts.append(item);
    }
    route(true);
  }
  el("archive").addEventListener("change", () => {
    try {
      selectFile(el("archive").files[0]);
      status("");
    } catch (err) {
      status(err.message);
    }
  });
  el("archive-text").addEventListener("input", () => {
    el("archive").value = "";
    choose(el("archive-text").value ? { kind: "entry" } : null);
  });
  document.addEventListener("dragover", (event) => {
    if (!el("restore").hidden) {
      event.preventDefault();
      el("drop").classList.add("is-over");
    }
  });
  document.addEventListener("dragleave", () =>
    el("drop").classList.remove("is-over"),
  );
  document.addEventListener("drop", (event) => {
    if (el("restore").hidden || event.target.closest?.("#legacy-panel")) return;
    event.preventDefault();
    el("drop").classList.remove("is-over");
    if (wallet || busy) return;
    try {
      if (event.dataTransfer.files.length > 1)
        throw Error("Choose one encrypted wallet file.");
      if (event.dataTransfer.files.length)
        selectFile(event.dataTransfer.files[0]);
      else pickText(event.dataTransfer.getData("text/plain"));
      status("");
      el("code").focus();
    } catch (err) {
      choose(null);
      status(err.message);
    }
  });
  document.addEventListener("paste", (event) => {
    if (
      wallet ||
      busy ||
      el("restore").hidden ||
      event.target === el("code") ||
      event.target.closest?.("#receive, #legacy-panel")
    )
      return;
    const data = event.clipboardData;
    if (!data) return;
    event.preventDefault();
    try {
      const files = data.files;
      if (files.length > 1) throw Error("Paste one encrypted wallet file.");
      if (files.length) selectFile(files[0]);
      else pickText(data.getData("text/plain"));
      status("");
      el("code").focus();
    } catch (err) {
      choose(null);
      el("archive-text").value = "";
      el("archive").value = "";
      status(err.message);
    }
  });
  el("show-code").addEventListener("click", () => {
    const reveal = el("code").type === "password";
    el("code").type = reveal ? "text" : "password";
    el("show-code").textContent = reveal ? "Hide code" : "Show code";
    el("show-code").setAttribute("aria-pressed", String(reveal));
  });
  el("use-saved").addEventListener("click", () => {
    el("archive").value = "";
    el("archive-text").value = "";
    choose({ kind: "saved" });
    el("code").focus();
  });
  el("forget").addEventListener("click", () => {
    try {
      localStorage.removeItem(storedKey);
    } catch {
      status(
        "This browser could not remove the saved backup. You can clear this site’s browser data.",
      );
      return;
    }
    if (selection?.kind === "saved") choose(null);
    else savedControls();
    status("The saved encrypted backup was removed from this browser.");
  });
  el("restore-form").addEventListener(
    "submit",
    run(async (token) => {
      const source = selection;
      const remember = el("remember").checked;
      const code = el("code").value.trim();
      el("code").value = "";
      el("code").type = "password";
      el("show-code").textContent = "Show code";
      el("show-code").setAttribute("aria-pressed", "false");
      if (!source) throw Error("Select your encrypted backup first.");
      const text =
        source.kind === "file"
          ? await source.file.text()
          : source.kind === "saved"
            ? loadSaved()
            : source.kind === "text"
              ? source.archive
              : el("archive-text").value;
      const archive = normalizedArchive(text);
      if (token !== generation) return;
      status("Opening the encrypted backup…");
      const restored = await restoreWallet(archive, code, (done, total) => {
        if (token === generation)
          status("Checking receive requests · " + done + " of " + total);
      });
      if (token !== generation) {
        restored.lock();
        return;
      }
      let message = "Wallet restored on this browser.";
      if (remember) {
        try {
          localStorage.setItem(storedKey, archive);
          message =
            "Wallet restored. Its encrypted backup is saved on this device.";
        } catch {
          message =
            "Wallet restored for this session. This browser could not save the encrypted backup.";
        }
      }
      receive?.reset();
      currentArchive = archive;
      wallet = restored;
      selection = null;
      el("restore-form").reset();
      el("remember").checked = false;
      el("chosen").textContent = "";
      if (restoreForReceive) history.replaceState(null, "", "#receive");
      displayWallet();
      status(message);
    }),
  );
  el("lock").addEventListener("click", () => {
    history.replaceState(null, "", "#restore");
    lock("Wallet locked.", true);
  });
  el("receive-restore").addEventListener("click", () => {
    restoreForReceive = true;
  });
  function renderSharedBalance() {
    let saved;
    try {
      saved = JSON.parse(
        sessionStorage.getItem("p2party.testnet1.shared-balance.v1"),
      );
      if (
        !saved ||
        Object.keys(saved).length !== 2 ||
        typeof saved.amount !== "string" ||
        !/^(?:0|[1-9][0-9]{0,2})$/.test(saved.amount) ||
        Number(saved.amount) > 128 ||
        typeof saved.height !== "string" ||
        !/^(?:0|[1-9][0-9]{0,19})$/.test(saved.height) ||
        BigInt(saved.height) >= 1n << 64n
      )
        saved = null;
    } catch {
      saved = null;
    }
    show("shared-total", Boolean(saved));
    show("forget-total", Boolean(saved));
    el("shared-amount").textContent = saved ? saved.amount + " P2PARTY" : "";
    el("shared-height").textContent = saved
      ? "At ledger height " + saved.height + " · This tab only"
      : "";
  }
  renderSharedBalance();
  window.addEventListener("p2party-shared-balance", renderSharedBalance);
  window.addEventListener("pageshow", renderSharedBalance);
  el("forget-total").addEventListener("click", () => {
    try {
      sessionStorage.removeItem("p2party.testnet1.shared-balance.v1");
      renderSharedBalance();
      el("account-toggle").focus();
    } catch {
      status("This browser could not forget this tab’s balance.");
    }
  });
  const accountMenu = el("account-menu");
  document.addEventListener("click", (event) => {
    if (
      !accountMenu.contains(event.target) ||
      event.target.closest(".account-panel a")
    )
      accountMenu.open = false;
  });
  accountMenu.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && accountMenu.open) {
      event.preventDefault();
      accountMenu.open = false;
      el("account-toggle").focus();
    }
  });
  window.addEventListener("hashchange", () => {
    if (checkLocation()) route(true);
  });
  if (location.hash)
    window.addEventListener("load", () => route(true), { once: true });
  el("request").addEventListener("change", () => {
    resetPayment();
    status("");
  });
  function showReview(request) {
    resetPayment();
    el("payment-panel").open = true;
    const info = wallet.reviewTransfer(request);
    reviewed = request;
    const list = el("review-details");
    for (const [label, value] of [
      ["Amount", info.weight + " P2PARTY"],
      ["Recipient commitment", info.recipient.commitment],
      ["Recipient suite", suiteName(info.recipient.suite)],
      ["Recipient read handle", info.readHandle],
      ["Source commitment", info.source],
      ["Source suite", suiteName(info.sourceSuite)],
      ["Input unit", info.inputId],
      ["Inclusive expiry height", info.expiry],
      ["Chain ID", info.chainId],
      ["Genesis fingerprint", info.genesis],
    ])
      detailsRow(list, label, value);
    show("review-panel", true);
    el("review-heading").focus();
    status("");
  }
  el("review-form").addEventListener(
    "submit",
    run(async (token) => {
      resetPayment();
      const file = el("request").files[0];
      if (!file || file.size === 0 || file.size > 8192)
        throw Error("Choose an unsigned payment request up to 8 KiB.");
      let request;
      try {
        request = JSON.parse(await file.text());
      } catch {
        throw Error("Choose a valid JSON payment request.");
      }
      if (token !== generation || el("request").files[0] !== file) return;
      showReview(request);
    }),
  );
  el("cancel").addEventListener("click", () => {
    el("review-form").reset();
    resetPayment();
    el("request").focus();
    status("Payment review cancelled.");
  });
  el("sign").addEventListener(
    "click",
    run(async (token) => {
      const request = reviewed;
      if (!request) return;
      status("Signing the reviewed payment offline…");
      const result = await wallet.signPayment(request);
      if (token !== generation || reviewed !== request) return;
      const { chainId, inputId, moveId, outputId, recipient, wire } = result;
      receive?.markSigned(inputId);
      signed = { chainId, inputId, moveId, outputId, recipient, wire };
      reviewed = null;
      show("review-panel", false);
      show("signed-panel", true);
      el("signed-heading").focus();
      status("");
    }),
  );
  el("download").addEventListener("click", () => {
    if (!signed) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(signed) + "\n"], { type: "application/json" }),
    );
    downloads.add(url);
    const link = document.createElement("a");
    link.href = url;
    link.download = "signed-" + signed.inputId.slice(2) + ".json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      downloads.delete(url);
    }, 10000);
    status("Signed payment download started.");
  });
  receive = installReceiveUI({
    balance,
    review: showReview,
    resetPayment,
    isRemembered: () =>
      Boolean(currentArchive && currentArchive === loadSaved()),
    adopt(next, archive, remember) {
      generation++;
      busy = false;
      const previousRemembered =
        currentArchive && currentArchive === loadSaved();
      let message = "Backup verified. Your public request is ready.";
      try {
        if (remember) localStorage.setItem(storedKey, archive);
        else if (previousRemembered) localStorage.removeItem(storedKey);
      } catch {
        message += " This browser could not update its saved encrypted backup.";
      }
      history.replaceState(null, "", "#receive");
      wallet = next;
      currentArchive = archive;
      selection = null;
      el("restore-form").reset();
      el("chosen").textContent = "";
      el("review-form").reset();
      resetPayment();
      displayWallet();
      status(message);
    },
  });
  window.addEventListener("pagehide", () => lock("", false));
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) lock("Wallet locked.", false);
  });
  show(
    "save-tool",
    location.protocol === "https:" || location.protocol === "http:",
  );
  lock("", false);
}
