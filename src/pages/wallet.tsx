import { useEffect } from "react";
import { useLocation } from "react-router";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import {
  WALLET_HOME_URL,
  WALLET_RESTORE_URL,
  WALLET_RECEIVE_URL,
  WALLET_BALANCE_URL,
  walletDocumentHref,
} from "../lib/walletRestore";
import { WalletBalance } from "../components/WalletBalance";
import help from "../content/wallet.md?raw";

export function WalletGuide() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash && !hash.startsWith("#watch="))
      document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <main className='site-reading wallet-guide'>
      <header className='site-reading-header wallet-heading'>
        <h1 className='site-title'>Wallet help</h1>
        <p>
          Recover a wallet, check a payment or look up a public request on
          Testnet 1.
        </p>
        <a className='ex-button mt-4' href={WALLET_HOME_URL}>
          Open wallet
        </a>
      </header>
      <article className='site-paper blog-prose'>
        <h2 id='move-spending-access'>Use your wallet in another browser</h2>
        <p>
          Save the latest encrypted backup from your wallet. In the other
          browser, open Restore, choose the backup file or paste its contents,
          and enter the recovery code you saved separately.{" "}
          <a href={WALLET_RESTORE_URL}>Restore a wallet</a>
        </p>
        <h2 id='receive-a-payment'>Receive a payment</h2>
        <p>
          Create a receive request, save the updated backup and confirm it. Give
          the payer the public request or its QR code. Your backup and recovery
          code stay with you. <a href={WALLET_RECEIVE_URL}>Receive P2PARTY</a>
        </p>
        <h2 id='check-a-payment'>
          Check a payment sent while you were offline
        </h2>
        <p>
          Restore the backup that contains the request you gave the payer. Check
          for payments to see your available amount and the ledger height it
          covers. You can choose to show that amount in Account for this tab.{" "}
          <a href={WALLET_BALANCE_URL}>Check your balance</a>
        </p>
        <ReactMarkdown
          urlTransform={(url) => walletDocumentHref(defaultUrlTransform(url))}
        >
          {help}
        </ReactMarkdown>
      </article>
      <section className='my-8' aria-labelledby='watch-public-request'>
        <h2 id='watch-public-request' className='mb-3'>
          Look up one public receive request
        </h2>
        <WalletBalance />
      </section>
    </main>
  );
}
