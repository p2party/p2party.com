import { useEffect, useRef, useState } from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
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

export function AccountMenu({
  inRoom = false,
  current = false,
}: {
  inRoom?: boolean;
  current?: boolean;
}) {
  const balance = useSharedWalletBalance();
  const [error, setError] = useState("");
  const newTab = inRoom ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <Popover className='account-nav'>
      {({ close }) => (
        <>
          <PopoverButton className='account-button'>
            Account <span aria-hidden='true'>▾</span>
          </PopoverButton>
          <PopoverPanel
            anchor='bottom end'
            className='account-panel'
            aria-label='Account options'
          >
            <h2>Testnet wallet</h2>
            {balance ? (
              <div className='account-balance'>
                <p>Last shared balance</p>
                <strong>{balance.amount} P2PARTY</strong>
                <p>At ledger height {balance.height} · This tab only</p>
              </div>
            ) : null}
            <Link
              className='account-action'
              href='/wallet/'
              aria-current={current ? "page" : undefined}
              {...newTab}
              onClick={() => close()}
            >
              Open wallet
              {inRoom && <span className='sr-only'> in a new tab</span>}
            </Link>
            <a
              href={WALLET_RECEIVE_URL}
              {...newTab}
              referrerPolicy='no-referrer'
              onClick={() => close()}
            >
              Receive P2PARTY
              {inRoom && <span className='sr-only'> in a new tab</span>}
            </a>
            {balance && (
              <button
                type='button'
                onClick={() => {
                  if (saveSharedWalletBalance(null)) close();
                  else
                    setError(
                      "This browser could not forget the saved balance.",
                    );
                }}
              >
                Hide and forget balance
              </button>
            )}
            <div className='account-room'>
              <h2>Room identity</h2>
              <Link
                href='/rooms/#restore-room-identity'
                {...newTab}
                onClick={() => close()}
              >
                Restore chat identity
              </Link>
            </div>
            {error && <p role='status'>{error}</p>}
          </PopoverPanel>
        </>
      )}
    </Popover>
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
      <h2 className='text-xl font-bold'>Share with this tab</h2>
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
              Show this amount and ledger height under Account in this tab? You
              can remove them anytime.
            </p>
            <div className='mt-3 flex flex-wrap gap-3'>
              <button
                type='button'
                className='ex-button'
                onClick={() => choose.current?.(true)}
              >
                Show in Account
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
