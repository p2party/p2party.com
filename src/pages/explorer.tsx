import { useEffect, useState, useSyncExternalStore } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { BlogChrome } from "../components/blog/BlogChrome";
import { Link } from "../components/link";
import networks from "../content/explorer.json";
import {
  loadExplorerOverview,
  lookupExplorerReceipt,
  TESTNET_CHAIN_ID,
  TESTNET_RPC,
} from "../lib/ledgerExplorer";
import type { ExplorerOverview, ExplorerReceipt } from "../lib/ledgerExplorer";

type Page = keyof typeof networks;
type Pending<T> =
  | { state: "loading" }
  | { state: "loaded"; data: T }
  | { state: "error"; message: string };
const noopSubscribe = () => () => {};
const format = (n: bigint | number) => n.toLocaleString("en-US");
const short = (id: string) => `${id.slice(0, 10)}…${id.slice(-8)}`;
const receiptPath = (query: string) =>
  `/explorer/testnet/?receipt=${encodeURIComponent(query)}`;
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The validator could not be reached.";

function Coin() {
  return (
    <div className='ex-coin-field' aria-hidden='true'>
      <div className='ex-coin'>
        <img src='/logo-cat.svg' alt='' />
      </div>
    </div>
  );
}

function NetworkDirectory() {
  return (
    <section className='ex-networks' aria-label='Explore a network'>
      <Link className='ex-network' href='/explorer/testnet'>
        <span className='ex-network-status'>
          <i className='ex-dot' /> Public testnet
        </span>
        <h2>
          Testnet 1 <span aria-hidden='true'>↗</span>
        </h2>
        <p>
          Look up native transfers and follow receipts on the public validator.
          Test units have no monetary value.
        </p>
        <span className='ex-action'>
          Browse testnet <span aria-hidden='true'>→</span>
        </span>
      </Link>
      <Link className='ex-network' href='/explorer/mainnet'>
        <span className='ex-network-status'>
          <i className='ex-dot ex-dot-muted' /> Prelaunch
        </span>
        <h2>
          Mainnet <span aria-hidden='true'>↗</span>
        </h2>
        <p>
          Check the launch status of the monetary network and the availability
          of public chain data.
        </p>
        <span className='ex-action'>
          View mainnet status <span aria-hidden='true'>→</span>
        </span>
      </Link>
    </section>
  );
}

function Mainnet() {
  return (
    <section className='ex-panel'>
      <div className='ex-panel-head'>
        <h2>Network status</h2>
        <span className='ex-network-status'>
          <i className='ex-dot ex-dot-muted' /> Prelaunch
        </span>
      </div>
      <p>
        The P2PARTY mainnet has not launched. Its public genesis, chain ID and
        RPC endpoint have yet to be published.
      </p>
      <p>
        You can already explore native transfers on Testnet 1 using valueless
        test units.
      </p>
      <Link className='ex-button' href='/explorer/testnet'>
        Explore Testnet 1 <span aria-hidden='true'>→</span>
      </Link>
      <p>
        <Link className='ex-text-button' href='/whitepaper'>
          Read the P2PARTY whitepaper
        </Link>
      </p>
    </section>
  );
}

function ReceiptSearch({
  query,
  label = "Find a receipt",
}: {
  query: string;
  label?: string;
}) {
  const navigate = useNavigate();
  return (
    <form
      className='ex-search'
      action='/explorer/testnet/'
      method='get'
      onSubmit={(event) => {
        event.preventDefault();
        const value = String(
          new FormData(event.currentTarget).get("receipt") ?? "",
        ).trim();
        if (value) void navigate(receiptPath(value));
      }}
    >
      <label htmlFor='ex-receipt'>{label}</label>
      <div>
        <input
          id='ex-receipt'
          name='receipt'
          type='text'
          required
          maxLength={130}
          defaultValue={query}
          spellCheck={false}
          autoCapitalize='none'
          autoComplete='off'
          placeholder='Receipt height or full move ID'
        />
        <button type='submit' className='ex-button'>
          Look up <span aria-hidden='true'>→</span>
        </button>
      </div>
      <p>Enter a decimal or hexadecimal height, or a 64-byte native move ID.</p>
    </form>
  );
}

function Failure({ text, retry }: { text: string; retry: () => void }) {
  return (
    <div className='ex-feedback' role='status'>
      <p>{text}</p>
      <button type='button' className='ex-text-button' onClick={retry}>
        Try again
      </button>
    </div>
  );
}

function ReceiptData({ receipt }: { receipt: ExplorerReceipt }) {
  return (
    <>
      <div className='ex-panel-head'>
        <h2>Receipt #{format(receipt.height)}</h2>
        <Link className='ex-text-button' href={receiptPath(receipt.id)}>
          Permanent link
        </Link>
      </div>
      <dl className='ex-fields'>
        <dt>Move ID</dt>
        <dd>
          <code>{receipt.id}</code>
        </dd>
        <dt>Spent unit ID</dt>
        <dd>
          <code>{receipt.inputId}</code>
        </dd>
        <dt>Created unit ID</dt>
        <dd>
          <code>{receipt.outputId}</code>
        </dd>
        <dt>Testnet amount</dt>
        <dd>{format(receipt.weight)} P2PARTY</dd>
        <dt>Spending signature suite</dt>
        <dd>{receipt.spendSuite}</dd>
        <dt>Receiving signature suite</dt>
        <dd>{receipt.receiveSuite}</dd>
        <dt>Expiry height</dt>
        <dd>
          {receipt.expiryHeight === 0n
            ? "No expiry"
            : format(receipt.expiryHeight)}
        </dd>
      </dl>
      <details className='ex-wire'>
        <summary>Signed transfer bytes · {format(receipt.wireBytes)} B</summary>
        <code>{receipt.wire}</code>
      </details>
    </>
  );
}

function ReceiptLookup({ query, retry }: { query: string; retry: () => void }) {
  const [result, setResult] = useState<
    Pending<ExplorerReceipt | "genesis" | null>
  >({ state: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    void lookupExplorerReceipt(query, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ state: "loaded", data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({ state: "error", message: message(error) });
      });
    return () => controller.abort();
  }, [query]);
  return (
    <section
      className='ex-panel'
      aria-label='Receipt lookup'
      aria-busy={result.state === "loading"}
    >
      {result.state === "loading" ? (
        <p role='status'>Looking up receipt…</p>
      ) : result.state === "error" ? (
        <Failure text={result.message} retry={retry} />
      ) : result.data === "genesis" ? (
        <>
          <h2>Genesis · height 0</h2>
          <p>
            The ledger begins with 128 valueless test units. Transfer receipts
            begin at height 1.
          </p>
          <a
            className='ex-text-button'
            href='/downloads/testnet-1/genesis.json'
          >
            View genesis JSON
          </a>
        </>
      ) : result.data === null ? (
        <>
          <h2>Receipt not found</h2>
          <p>
            The public validator returned no receipt for this height or move ID.
          </p>
        </>
      ) : (
        <ReceiptData receipt={result.data} />
      )}
    </section>
  );
}

function ReceiptList({ data, from }: { data: ExplorerOverview; from: string }) {
  return (
    <>
      <dl className='ex-stats'>
        <div>
          <dt>Ledger height</dt>
          <dd>{format(data.height)}</dd>
        </div>
        <div>
          <dt>RPC chain ID</dt>
          <dd>{data.rpcChainId.toString()}</dd>
        </div>
        <div>
          <dt>Genesis allocation</dt>
          <dd>
            128 <small>P2PARTY</small>
          </dd>
        </div>
      </dl>
      <div className='ex-panel-head'>
        <h2>{from ? "Transfer receipts" : "Latest transfers"}</h2>
      </div>
      {data.receipts.length ? (
        <ul className='ex-receipts'>
          {data.receipts.map((r) => (
            <li key={r.id}>
              <Link
                href={receiptPath(r.id)}
                aria-label={`Open receipt at height ${r.height.toString()}`}
              >
                <b>#{format(r.height)}</b>
                <span className='ex-move'>
                  <code>{short(r.id)}</code>
                  <small>{r.spendSuite}</small>
                </span>
                <span className='ex-weight'>{format(r.weight)} P2PARTY</span>
                <span aria-hidden='true'>→</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>No transfers have been recorded in this range.</p>
      )}
      {(from || data.olderThan !== null) && (
        <div className='ex-paging'>
          {from && (
            <Link className='ex-text-button' href='/explorer/testnet'>
              Latest transfers
            </Link>
          )}
          {data.olderThan !== null && (
            <Link
              className='ex-text-button'
              href={`/explorer/testnet/?from=${data.olderThan}`}
            >
              Older receipts →
            </Link>
          )}
        </div>
      )}
    </>
  );
}

function Overview({ from, retry }: { from: string; retry: () => void }) {
  const [result, setResult] = useState<Pending<ExplorerOverview>>({
    state: "loading",
  });
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (from && !/^[1-9][0-9]{0,18}$/u.test(from))
        throw new Error(
          "Enter a positive receipt height or return to the latest transfers.",
        );
      return loadExplorerOverview(
        controller.signal,
        from ? BigInt(from) : undefined,
      );
    };
    void load()
      .then((data) => {
        if (!controller.signal.aborted) setResult({ state: "loaded", data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({ state: "error", message: message(error) });
      });
    return () => controller.abort();
  }, [from]);
  return (
    <section
      className='ex-panel'
      aria-label='Live ledger'
      aria-busy={result.state === "loading"}
    >
      <div className='ex-panel-head'>
        <span className='ex-network-status'>
          <i
            className={
              result.state === "loaded" ? "ex-dot" : "ex-dot ex-dot-muted"
            }
          />{" "}
          Testnet 1 validator
        </span>
        <button type='button' onClick={retry} className='ex-text-button'>
          Refresh
        </button>
      </div>
      {result.state === "loading" ? (
        <p role='status'>Reading the validator’s ledger…</p>
      ) : result.state === "error" ? (
        <>
          <Failure text={result.message} retry={retry} />
          {from && (
            <Link className='ex-action' href='/explorer/testnet'>
              Return to latest transfers
            </Link>
          )}
        </>
      ) : (
        <ReceiptList data={result.data} from={from} />
      )}
    </section>
  );
}

function Testnet() {
  const [search] = useSearchParams();
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const query = hydrated ? (search.get("receipt") ?? "").trim() : "";
  const from = hydrated ? (search.get("from") ?? "") : "";
  const [revision, setRevision] = useState(0);
  const retry = () => setRevision((v) => v + 1);
  return (
    <>
      <ReceiptSearch key={query} query={query} />
      {!hydrated ? (
        <section className='ex-panel'>
          <p role='status'>Loading validator data…</p>
          <noscript>
            Enable JavaScript to read live transfer receipts from the public
            validator.
          </noscript>
        </section>
      ) : query ? (
        <>
          <ReceiptLookup
            key={`${query}:${revision}`}
            query={query}
            retry={retry}
          />
          <Link className='ex-back' href='/explorer/testnet'>
            ← All transfers
          </Link>
        </>
      ) : (
        <Overview key={`${from}:${revision}`} from={from} retry={retry} />
      )}
      <details className='ex-network-info'>
        <summary>Network details</summary>
        <dl className='ex-fields'>
          <dt>Currency symbol</dt>
          <dd>P2PARTY (test units)</dd>
          <dt>Native chain ID</dt>
          <dd>
            <code>{TESTNET_CHAIN_ID}</code>
          </dd>
          <dt>Public RPC</dt>
          <dd>
            <code>{TESTNET_RPC}</code>
          </dd>
          <dt>Genesis</dt>
          <dd>
            <a
              className='ex-text-button'
              href='/downloads/testnet-1/genesis.json'
            >
              Published allocation
            </a>
          </dd>
        </dl>
        <p>
          One validator orders testnet transfers. Its receipt records acceptance
          by that validator.
        </p>
      </details>
    </>
  );
}

export default function Explorer({ page }: { page: Page }) {
  const meta = networks[page];
  useEffect(() => {
    const previous = document.title;
    document.title = `${meta.title} · p2party`;
    return () => {
      document.title = previous;
    };
  }, [meta]);
  return (
    <BlogChrome>
      <main className='ex-shell' id='blog-content'>
        <header className='ex-header'>
          <div className='ex-hero-copy'>
            <p className='ex-crumb'>
              <Link href='/'>p2party</Link>
              <span aria-hidden='true'>/</span>
              {page === "overview" ? (
                "Explorer"
              ) : (
                <Link href='/explorer'>Explorer</Link>
              )}
              {page !== "overview" && (
                <>
                  <span aria-hidden='true'>/</span>
                  {page === "testnet" ? "Testnet 1" : "Mainnet"}
                </>
              )}
            </p>
            <h1>
              {page === "overview"
                ? "Ledger explorer"
                : page === "testnet"
                  ? "Testnet 1"
                  : "Mainnet"}
            </h1>
            <p className='ex-intro'>
              {page === "overview"
                ? "Explore the P2PARTY networks and follow native transfers from one unit to the next."
                : page === "testnet"
                  ? "Read native P2PARTY transfers from the public validator. Testnet units have no monetary value."
                  : "Launch status and public network data for P2PARTY."}
            </p>
          </div>
          <Coin />
        </header>
        <nav className='ex-nav' aria-label='Explorer networks'>
          {(Object.keys(networks) as Page[]).map((k) => (
            <Link
              key={k}
              href={networks[k].path}
              aria-current={k === page ? "page" : undefined}
            >
              {k === "overview"
                ? "Networks"
                : k === "testnet"
                  ? "Testnet 1"
                  : "Mainnet"}
            </Link>
          ))}
        </nav>
        {page === "overview" ? (
          <>
            <NetworkDirectory />
            <ReceiptSearch query='' label='Find a Testnet 1 receipt' />
          </>
        ) : page === "testnet" ? (
          <Testnet />
        ) : (
          <Mainnet />
        )}
      </main>
    </BlogChrome>
  );
}
