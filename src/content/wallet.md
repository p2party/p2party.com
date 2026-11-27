## Receive a payment

**Your wallet can be offline when a payer sends you a unit.** First create a fresh public receive request and save the matching private material. Testnet 1 uses valueless whole units. Make one request per unit.

1. Open **Receive P2PARTY**. Choose **Create a wallet** for a new wallet, or restore your existing encrypted file using its separate recovery code. In an open wallet choose **Create a receive request**. [Open the receive screen](https://p2party.github.io/p2party-server/restore/#receive)
2. Download the updated encrypted wallet file and keep its recovery code separately. Reopen the file with the matching code to confirm the backup. Only then can you copy the public request, download it or show its QR code. A backup made before this request cannot restore it.
3. Give the payer the **public request**. The copyable request, download and QR all identify the network, genesis, one-unit weight, signing suite and full 64-byte receive commitment. Keep the wallet file and recovery code private. The payer checks the full destination before signing and submitting the transfer. You can close your browser, go offline or change devices while the validator records it.
4. When you return, restore the backup containing that request and choose **Sync with validator**. The wallet checks the public Testnet 1 history from its pinned checkpoint and matches your commitments on your device. Use the **verified height** shown with the result. At that height a request can be awaiting a payment, received and unspent, or received and later spent. A recognized payment shows the height it arrived and, if spent, the height it left. Only an unspent unit contributes to the total. [Follow the illustrated payment walkthrough](/protocol#walkthrough-receive)

If the history is unavailable, fails verification or is older than the payer’s receipt, keep the payment unconfirmed. Retry sync when connectivity returns and compare the payer’s receipt with the full commitment. A stale zero does not establish that the transfer failed. If the payer has already spent an input, confirm its recorded destination before asking them to send again.

The request can be shared without exposing other requests in your wallet. A payer or anyone with the request can follow its public ledger activity; transfers and amounts are public. A watch link carries only the shorter read handle and can show that commitment’s balance. [Check a public balance](#check-a-public-balance)

## Move spending access

Choose **Restore a wallet**, select or drop your encrypted wallet file, or paste its contents. Paste the recovery code you saved separately and choose **Restore wallet**. Your keys are opened in this browser. To unlock with just the code on your next visit, choose **Remember encrypted wallet on this device**. The restore page runs on P2Party’s HTTPS project site and can also be opened as a downloaded offline file. [Open wallet restore](https://p2party.github.io/p2party-server/restore/) · [Source and offline-file checksum](https://github.com/p2party/p2party-server/tree/d2f0f306737a9979f5ff5264770ac6a9043ef352/clients/evm/portable-wallet/browser)

**If you have the old browser**, make sure your file contains your latest receive requests. In the desktop companion choose **Move to another browser**, download the encrypted file and save its recovery code separately. On the replacement device restore the file and check a receive commitment against one you already know. You can sign an offline test to verify spending access.

**If you lost the old device**, bring the most recent file and its matching code. Requests created after that backup need their own saved keys and nonces. The 24-word P2Party room recovery phrase restores a chat identity. The spending wallet uses the encrypted file and code. Anyone who has both can authorize a transfer, including a copy left on the old device.

To pay from a restored wallet, open the offline payment form, paste a public transfer request and review the input, amount, destination and expiry. Approve to download the signed transaction for separate submission. The restore page never broadcasts a transfer.

## Use the desktop companion

In the server source containing the companion, run the following commands from the repository root. Open the loopback address printed in your own terminal.

```sh
npm ci --prefix clients/evm/portable-wallet
node clients/evm/portable-wallet/serve.mjs
```

Choose **Create a new wallet** and select your signing suite. Download the encrypted file and save the recovery code elsewhere, for example in a password manager. Choose **Check my backup** and reopen that file with your saved code. The companion then shows the full public receive commitment and its shorter balance handle. Keep the wallet process running while you use it. After adding another request, confirm an updated backup before giving the commitment to a payer.

Existing command-line wallets keep a private `key.pk8` and `nonce` in each receive directory. On the restore page, open **Import an older command-line wallet**, choose those two files and paste the expected full public commitment. Save the resulting encrypted backup and its separate new code, then reopen them in the restore form. This converts one receive folder at a time. The desktop companion’s `import-legacy.mjs` command can combine several folders into one kit. To make a payment from a restored kit, review the full destination, unit value and expiry in the companion’s `sign-offline.mjs` command. It exports a signed transfer that the command-line client can submit. Retain your signed file and move ID until settlement. [Existing wallet instructions](https://github.com/p2party/p2party-js/blob/master/docs/testnet-1.md) · [Earlier command-line restore test](/blog/restoring-a-p2party-wallet)

## Choosing a spending suite

Both ML-DSA-65 and SLH-DSA-SHA2-192s work on Testnet 1. The former uses module lattices. The latter uses hash-based signatures and has larger transfers. A unit is protected by the suite in its own commitment. A move to another suite needs a fresh descriptor and a valid signature under the old suite. The recent AI-assisted papers reviewed on 27 November gave us no demonstrated practical forgery for either public wallet option. [Read the dated security review](/blog/ai-math-and-p2party-keys)

## Who can see my balance?

A watch link shows the amount at **one receive request**. Your companion makes a new signing key and nonce for every new request. Sharing one handle gives the recipient no list of the others. On Testnet 1 the amounts and links between spends are public. Someone who recognizes transactions or already knows which handles you control can infer more. Older wallets that reused a signing key reveal the same public key when those units are spent.

To see all your holdings together without sending a list of addresses to the public RPC, import a complete public Testnet 1 snapshot from a replica you trust into your local companion. It matches your commitments on your device. The displayed total is the replica’s reported result at the file’s height. This offline view cannot establish by itself that the file is current or authentic. [Snapshot format and source instructions](https://github.com/p2party/p2party-server/tree/d2f0f306737a9979f5ff5264770ac6a9043ef352/clients/evm/portable-wallet) · [Holder privacy and the mainnet design](/whitepaper#what-one-address-reveals-about-a-holder)

After checking a total inside the HTTPS wallet, choose **Show total on p2party.com** if you want that amount in the site navigation. The wallet sends just the Testnet 1 total and the height it used, after you choose to share them. Confirm **Show in navbar** on p2party.com to keep that snapshot in this tab’s session storage. **Balance details → Hide and forget balance** clears it. To update the figure, share a newer balance from the wallet. Keeping the total inside the wallet also keeps it private from this site.
