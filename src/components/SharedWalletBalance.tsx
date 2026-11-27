import { useEffect, useId, useRef, useState } from "react";
import { EyeSlashIcon, WalletIcon } from "@heroicons/react/20/solid";
import { useNavigate } from "react-router";
import { Link } from "./link";
import { WALLET_RECEIVE_URL, WALLET_RESTORE_URL } from "../lib/walletRestore";
import {
  type PublicWalletTotal,
  readBalanceOffer,
  saveSharedWalletBalance,
  signerOrigin,
  useSharedWalletBalance,
} from "../lib/sharedWalletBalance";

export function WalletNav({ current }: { current: boolean }) {
  const balance = useSharedWalletBalance();
  const descriptionId = useId();
  const [error, setError] = useState("");
  return (
    <div className='site-nav-wallet'>
      <Link
        className='site-wallet-link'
        href='/wallet'
        aria-label='Wallet'
        aria-describedby={descriptionId}
        aria-current={current ? "page" : undefined}
      >
        <span>Wallet</span>
        <small id={descriptionId}>
          {balance ? balance.amount + " P2PARTY" : "Balance hidden"}
        </small>
        {balance && (
          <small
            className='site-wallet-height'
            title={"As of height " + balance.height}
          >
            At height {balance.height}
          </small>
        )}
      </Link>
      <details className='site-balance-details'>
        <summary aria-label={balance ? "Balance details" : "Wallet actions"}>
          <span aria-hidden='true'>▾</span>
        </summary>
        <div className='site-balance-menu'>
          <a
            className='ex-text-button block'
            href={WALLET_RECEIVE_URL}
            referrerPolicy='no-referrer'
          >
            Receive P2PARTY
          </a>
          {balance && (
            <>
              <strong className='mt-1 block'>
                {balance.amount} test P2PARTY
              </strong>
              <p>Testnet 1 · As of height {balance.height}</p>
              <button
                className='ex-text-button'
                type='button'
                onClick={() => {
                  if (!saveSharedWalletBalance(null))
                    setError(
                      "This browser could not clear the saved balance. Close this tab.",
                    );
                }}
              >
                Hide and forget balance
              </button>
              {error && <p role='status'>{error}</p>}
            </>
          )}
        </div>
      </details>
    </div>
  );
}

// Keep the room connection and invite in their current tab when opening the guide.
export function RoomWalletNav({ compact = false }: { compact?: boolean }) {
  const balance = useSharedWalletBalance();
  const descriptionId = useId();
  const [storageError, setStorageError] = useState(false);
  return (
    <div className='flex shrink-0 items-center gap-1'>
      <a
        href='/wallet/'
        target='_blank'
        rel='noopener noreferrer'
        aria-label='Open wallet in a new tab'
        aria-describedby={descriptionId}
        className='flex min-h-10 items-center gap-2 px-1 text-sm font-semibold hover:underline'
      >
        <WalletIcon aria-hidden='true' className='size-5 shrink-0' />
        <span>
          <span className='block'>Wallet</span>
          <small
            id={descriptionId}
            className={
              compact && !balance
                ? "sr-only"
                : "block max-w-36 truncate text-xs font-normal"
            }
          >
            {balance
              ? balance.amount + " P2PARTY · height " + balance.height
              : "Balance hidden"}
          </small>
        </span>
      </a>
      {!compact && (
        <a
          href={WALLET_RECEIVE_URL}
          target='_blank'
          rel='noopener noreferrer'
          className='ml-auto px-1 text-sm font-semibold underline underline-offset-2'
          aria-label='Receive P2PARTY in a new tab'
        >
          Receive
        </a>
      )}
      {balance && (
        <button
          className='p-2'
          type='button'
          aria-label='Hide and forget balance'
          title='Hide and forget balance'
          onClick={() => setStorageError(!saveSharedWalletBalance(null))}
        >
          <EyeSlashIcon aria-hidden='true' className='size-4' />
        </button>
      )}
      {storageError && (
        <small role='status'>Close this tab to clear its saved balance.</small>
      )}
    </div>
  );
}

type ShareState =
  | {
      step: "waiting" | "unavailable" | "expired" | "storage-error";
    }
  | { step: "offer"; balance: PublicWalletTotal };

export function BalanceShareRequest() {
  const navigate = useNavigate();
  const [state, setState] = useState<ShareState>({ step: "waiting" });
  const choose = useRef<((accept: boolean) => void) | null>(null);
  useEffect(() => {
    let endSession = () => {};
    // Defer the handshake until the mounted receiver owns its message listener.
    // Strict-mode replay then cancels the unused first challenge.
    const start = window.setTimeout(() => {
      const sender: Window | null = window.opener;
      if (
        location.origin !== "https://p2party.com" ||
        !sender ||
        sender === window ||
        sender.closed
      ) {
        setState({ step: "unavailable" });
        return;
      }
      const nonce = Array.from(
        crypto.getRandomValues(new Uint8Array(32)),
        (n) => n.toString(16).padStart(2, "0"),
      ).join("");
      const expiresAt = Date.now() + 90_000;
      let proposal: PublicWalletTotal | null = null;
      let finished = false;
      const receive = (event: MessageEvent<unknown>) => {
        if (
          finished ||
          Date.now() >= expiresAt ||
          proposal ||
          event.origin !== signerOrigin ||
          event.source !== sender
        )
          return;
        const offered = readBalanceOffer(event.data, nonce);
        if (!offered) return;
        proposal = offered;
        setState({ step: "offer", balance: offered });
      };
      const timeout = window.setTimeout(() => {
        endSession();
        setState({ step: "expired" });
      }, 90_000);
      endSession = () => {
        finished = true;
        proposal = null;
        choose.current = null;
        window.clearTimeout(timeout);
        window.removeEventListener("message", receive);
        window.removeEventListener("pagehide", endSession);
        window.opener = null;
      };
      choose.current = (accept) => {
        if (!proposal || finished) return;
        if (Date.now() >= expiresAt) {
          endSession();
          setState({ step: "expired" });
          return;
        }
        const saved = accept && saveSharedWalletBalance(proposal);
        endSession();
        try {
          sender.postMessage(
            {
              type: saved
                ? "p2party.balance.accepted.v1"
                : "p2party.balance.declined.v1",
              nonce,
            },
            signerOrigin,
          );
        } catch {
          /* The wallet may have closed while the user was deciding. */
        }
        if (accept && !saved) {
          setState({ step: "storage-error" });
        } else {
          void navigate("/wallet/", {
            replace: true,
            state: { sharedBalance: saved ? "saved" : "declined" },
          });
        }
      };
      window.addEventListener("pagehide", endSession, { once: true });
      window.addEventListener("message", receive);
      try {
        sender.postMessage(
          { type: "p2party.balance.request.v1", nonce },
          signerOrigin,
        );
      } catch {
        endSession();
        setState({ step: "unavailable" });
      }
    }, 0);
    return () => {
      window.clearTimeout(start);
      endSession();
    };
  }, [navigate]);
  return (
    <section className='site-paper mb-5' aria-label='Show wallet balance'>
      <h2 className='text-xl font-bold'>Show a balance in this tab</h2>
      <div aria-live='polite'>
        {state.step === "waiting" && (
          <p>Waiting for the wallet that opened this tab…</p>
        )}
        {state.step === "offer" && (
          <>
            <p className='my-2'>
              <strong>{state.balance.amount} test P2PARTY</strong> on Testnet 1
              at height {state.balance.height}.
            </p>
            <p>
              The wallet shared this total and height with p2party.com. Keep
              them in this tab’s navigation until you hide them or close the
              tab?
            </p>
            <div className='mt-3 flex flex-wrap gap-3'>
              <button
                type='button'
                className='ex-button'
                onClick={() => choose.current?.(true)}
              >
                Show in navbar
              </button>
              <button
                type='button'
                className='ex-text-button'
                onClick={() => choose.current?.(false)}
              >
                Cancel
              </button>
            </div>
          </>
        )}
        {state.step === "storage-error" && (
          <p>
            Your browser blocked storage for this tab. You can view the total in
            your wallet.
          </p>
        )}
        {(state.step === "unavailable" || state.step === "expired") && (
          <p>
            {state.step === "expired"
              ? "This request expired."
              : "This tab did not receive a connection from your wallet."}{" "}
            <a
              className='ex-text-button'
              href={WALLET_RESTORE_URL}
              referrerPolicy='no-referrer'
            >
              Open your wallet
            </a>
            , check its balance and choose to share it with p2party.com.
          </p>
        )}
      </div>
    </section>
  );
}
