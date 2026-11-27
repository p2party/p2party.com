import { useState } from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { Link } from "./link";
import { WALLET_RECEIVE_URL } from "../lib/walletRestore";
import {
  forgetSharedWalletBalance,
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
                  if (forgetSharedWalletBalance()) close();
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
