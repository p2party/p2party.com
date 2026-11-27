import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router";
import { lookupTestnetBalance, publicReadHandle } from "../lib/ledgerExplorer";

// Derived from the first public Testnet 1 genesis receive descriptor.
const genesisExample = "0x5ea5736cc5cd0e175c415c4dd31f67f71b34e872";

const noEvents = () => () => {};

export function WalletBalance() {
  const { hash } = useLocation();
  // The static host cannot see a URL fragment. Apply it after hydration.
  const hydrated = useSyncExternalStore(
    noEvents,
    () => true,
    () => false,
  );
  const initial =
    hydrated && hash.startsWith("#watch=")
      ? (publicReadHandle(hash.slice(7)) ?? "")
      : "";
  return <BalanceForm key={initial} initial={initial} />;
}

function BalanceForm({ initial }: { initial: string }) {
  const [handle, setHandle] = useState(initial);
  const address = publicReadHandle(handle);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (initial) form.current?.scrollIntoView();
  }, [initial]);
  const [status, setStatus] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const change = (value: string) => {
    request.current?.abort();
    setHandle(value);
    setStatus("");
  };
  return (
    <form
      ref={form}
      id='check-a-public-balance'
      className='ex-search'
      aria-label='Testnet balance lookup'
      onSubmit={async (event) => {
        event.preventDefault();
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        setStatus("Checking Testnet 1…");
        try {
          const result = await lookupTestnetBalance(handle, controller.signal);
          if (!controller.signal.aborted)
            setStatus(
              result.balance.toLocaleString("en-US") +
                " test P2PARTY at height " +
                result.height.toLocaleString("en-US") +
                ".",
            );
        } catch (err) {
          if (!controller.signal.aborted)
            setStatus(
              err instanceof Error
                ? err.message
                : "The balance could not be read.",
            );
        }
      }}
    >
      <label htmlFor='read-handle'>Check a Testnet 1 balance</label>
      {initial && (
        <p className='font-bold'>
          You opened a watch-only link. Check the balance when you’re ready.
        </p>
      )}
      <p id='handle-help'>
        Paste the public balance handle (0x followed by 40 hexadecimal digits)
        for one receive request. Looking it up shares that handle with the
        public validator. The result covers only this receive request.
      </p>
      <div>
        <input
          id='read-handle'
          value={handle}
          onChange={(e) => change(e.target.value)}
          autoComplete='off'
          spellCheck={false}
          autoCapitalize='none'
          placeholder='0x…'
          aria-describedby='handle-help'
          required
        />
        <button className='ex-button' type='submit'>
          Check balance
        </button>
      </div>
      <button
        type='button'
        className='ex-text-button'
        onClick={() => change(genesisExample)}
      >
        Use a public genesis example
      </button>
      {address && <WatchLink key={address} address={address} />}
      <output aria-live='polite' className='mt-2 block font-bold'>
        {status}
      </output>
    </form>
  );
}

function WatchLink({ address }: { address: string }) {
  const url = "https://p2party.com/wallet/help/#watch=" + address;
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || qr) return;
    let active = true;
    void import("qrcode")
      .then((module) => module.toDataURL(url, { width: 196, margin: 4 }))
      .then((data) => {
        if (active) setQr(data);
      })
      .catch(() => {
        if (active) setMessage("Use the link below to open this balance.");
      });
    return () => {
      active = false;
    };
  }, [open, qr, url]);
  return (
    <details
      className='mt-4'
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className='cursor-pointer font-bold'>
        Watch in another browser
      </summary>
      <p className='my-2'>
        Scan this QR code or open the link on your other device. Anyone with the
        link can look up this request’s balance.
      </p>
      {qr && (
        <img
          alt='Watch-only link for this public handle'
          width={196}
          height={196}
          src={qr}
        />
      )}
      <a className='ex-text-button block break-all' href={url}>
        {url}
      </a>
      <button
        className='ex-text-button mt-2'
        type='button'
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setMessage("Watch link copied.");
          } catch {
            setMessage("Select the link and copy it using your browser.");
          }
        }}
      >
        Copy watch link
      </button>
      <span aria-live='polite' className='block'>
        {message}
      </span>
    </details>
  );
}
