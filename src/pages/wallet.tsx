import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router";
import ReactMarkdown from "react-markdown";
import { BalanceShareRequest } from "../components/SharedWalletBalance";
import { WalletBalance } from "../components/WalletBalance";
import {
  WALLET_BALANCE_URL,
  WALLET_CREATE_URL,
  WALLET_RECEIVE_URL,
  WALLET_RESTORE_URL,
} from "../lib/walletRestore";
import help from "../content/wallet.md?raw";

function WalletAction({ to, children }: { to: string; children: string }) {
  return (
    <a className='ex-button' href={to} referrerPolicy='no-referrer'>
      {children}
      <span aria-hidden='true'> →</span>
    </a>
  );
}

const noHydrationEvents = () => () => {};

export function WalletGuide() {
  const location = useLocation();
  const hydrated = useSyncExternalStore(
    noHydrationEvents,
    () => true,
    () => false,
  );
  const hash = hydrated ? location.hash : "";
  const state = hydrated ? location.state : null;
  // The server cannot see URL fragments. Reveal a deep-linked task after hydration.
  useEffect(() => {
    if (!hash || hash.startsWith("#watch=") || hash === "#show-balance") return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    const disclosure = target.closest("details");
    if (disclosure) disclosure.open = true;
    target.scrollIntoView();
  }, [hash]);

  if (hash === "#show-balance")
    return (
      <main className='site-reading wallet-guide'>
        <h1 className='site-title'>Show your balance</h1>
        <BalanceShareRequest />
      </main>
    );
  if (hash.startsWith("#watch="))
    return (
      <main className='site-reading wallet-guide'>
        <h1 className='site-title'>Watch a payment</h1>
        <p>A watch link lets you look up one public receive request.</p>
        <WalletBalance />
        <a className='ex-text-button' href='/wallet/'>
          Back to your wallet
        </a>
      </main>
    );

  return (
    <main className='site-reading wallet-guide'>
      <header className='site-reading-header wallet-heading'>
        <p className='wallet-network'>Testnet 1 · No monetary value</p>
        <h1 className='site-title'>P2PARTY wallet</h1>
        <p>Rooms work without a wallet.</p>
      </header>
      {state?.sharedBalance === "saved" && (
        <p role='status'>
          Your balance is visible in this tab. Open Account to hide and forget
          it.
        </p>
      )}
      {state?.sharedBalance === "declined" && (
        <p role='status'>This balance was not saved.</p>
      )}
      <div className='wallet-entry'>
        <section id='move-spending-access'>
          <h2>Already have a wallet?</h2>
          <p>
            On the next screen, choose your latest backup file (.jwe) or paste
            its contents. Enter its recovery code to restore.
          </p>
          <WalletAction to={WALLET_RESTORE_URL}>Restore a wallet</WalletAction>
        </section>
        <section>
          <h2>New to P2PARTY?</h2>
          <p>
            Save the backup file and recovery code separately. You’ll need both
            on another device.
          </p>
          <WalletAction to={WALLET_CREATE_URL}>Create a wallet</WalletAction>
        </section>
      </div>
      <p className='wallet-origin'>
        P2Party opens the wallet on <strong>p2party.github.io</strong>. Enter
        your backup and recovery code only in the wallet.
      </p>
      <section className='wallet-tasks' aria-labelledby='using-wallet'>
        <h2 id='using-wallet'>Using your wallet</h2>
        <details id='receive-a-payment'>
          <summary>Receive a payment</summary>
          <p>
            Open Receive and make a request for one test P2PARTY. Save and
            confirm the updated backup, then give the payer the public request
            or its QR code. Keep your backup and recovery code private.
          </p>
          <a
            className='ex-text-button'
            href={WALLET_RECEIVE_URL}
            referrerPolicy='no-referrer'
          >
            Receive P2PARTY
          </a>
        </details>
        <details id='check-a-payment'>
          <summary>Check a payment sent while you were offline</summary>
          <p>
            Open the backup that contains the request you gave the payer. Sync
            with the validator to see whether the payment arrived and how much
            you can spend. A first check shows your available amount, including
            zero, and the ledger height it covers. A locked or unsynced wallet
            has no checked total yet.
          </p>
          <a
            className='ex-text-button'
            href={WALLET_BALANCE_URL}
            referrerPolicy='no-referrer'
          >
            Check my balance
          </a>
        </details>
        <details id='navigation-balance'>
          <summary>Show my balance in Account</summary>
          <p>
            Check your balance in the wallet and choose to show it on
            p2party.com. Confirm in the new tab. Only the amount and its ledger
            height are shared. You can hide and forget them from Account.
          </p>
          <a
            className='ex-text-button'
            href={WALLET_BALANCE_URL}
            referrerPolicy='no-referrer'
          >
            Open wallet balance
          </a>
        </details>
        <details>
          <summary>Look up one public receive request</summary>
          <WalletBalance />
        </details>
        <details>
          <summary>Backup help and advanced options</summary>
          <article className='blog-prose'>
            <ReactMarkdown
              components={{
                h2: ({ children }) => (
                  <h3
                    id={String(children)
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/-$/, "")}
                  >
                    {children}
                  </h3>
                ),
              }}
            >
              {help}
            </ReactMarkdown>
          </article>
        </details>
      </section>
    </main>
  );
}
