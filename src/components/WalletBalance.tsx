import { useEffect, useRef, useState } from "react";
import { lookupTestnetBalance } from "../lib/ledgerExplorer";

// Derived from the first public Testnet 1 genesis receive descriptor.
const genesisExample = "0x5ea5736cc5cd0e175c415c4dd31f67f71b34e872";

export function WalletBalance() {
  const [handle, setHandle] = useState("");
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
      <p id='handle-help'>
        Enter the public 20-byte read handle for one receive commitment. Looking
        it up shares that handle with the public validator.
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
      <output aria-live='polite' className='mt-2 block font-bold'>
        {status}
      </output>
    </form>
  );
}
