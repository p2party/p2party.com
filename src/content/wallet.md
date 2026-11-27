## Move spending access

Choose **Restore a wallet**, select or drop your encrypted wallet file, or paste its contents. Paste the recovery code you saved separately and choose **Restore wallet**. Your keys are opened in this browser. To unlock with just the code on your next visit, choose **Remember encrypted wallet on this device**. The restore page runs on P2Party’s HTTPS project site and can also be opened as a downloaded offline file. [Open wallet restore](https://p2party.github.io/p2party-server/restore/) · [Source and offline-file checksum](https://github.com/p2party/p2party-server/tree/2a023b3f2733d8cf5f1cc90edfae577cf6e79f85/clients/evm/portable-wallet/browser)

**If you have the old browser**, make sure your file contains your latest receive requests. In the desktop companion choose **Move to another browser**, download the encrypted file and save its recovery code separately. On the replacement device restore the file and check a receive commitment against one you already know. You can sign an offline test to verify spending access.

**If you lost the old device**, bring the most recent file and its matching code. Requests created after that backup need their own saved keys and nonces. The 24-word P2Party room recovery phrase restores a chat identity. The spending wallet uses the encrypted file and code. Anyone who has both can authorize a transfer, including a copy left on the old device.

To pay from a restored wallet, open the offline payment form, paste a public transfer request and review the input, amount, destination and expiry. Approve to download the signed transaction for separate submission. The restore page never broadcasts a transfer.

## Start a local wallet

In the server source containing the companion, run the following commands from the repository root. Open the loopback address printed in your own terminal.

```sh
npm ci --prefix clients/evm/portable-wallet
node clients/evm/portable-wallet/serve.mjs
```

Choose **Create a new wallet** and select your signing suite. Download the encrypted file and save the recovery code elsewhere, for example in a password manager. Choose **Check my backup** and reopen that file with your saved code. The companion then shows the full public receive commitment and its shorter balance handle. Keep the wallet process running while you use it. After adding another request, confirm an updated backup before giving the commitment to a payer.

Existing command-line wallets keep a private `key.pk8` and `nonce` in each receive directory. On the restore page, open **Import an older command-line wallet**, choose those two files and paste the expected full public commitment. Save the resulting encrypted backup and its separate new code, then reopen them in the restore form. This converts one receive folder at a time. The desktop companion’s `import-legacy.mjs` command can combine several folders into one kit. To make a payment from a restored kit, review the full destination, unit value and expiry in the companion’s `sign-offline.mjs` command. It exports a signed transfer that the command-line client can submit. Retain your signed file and move ID until settlement. [Existing wallet instructions](https://github.com/p2party/p2party-js/blob/master/docs/testnet-1.md) · [Earlier command-line restore test](/blog/restoring-a-p2party-wallet)

## Receive a payment

Give the payer **Testnet 1**, the signing suite and the **full 64-byte commitment** for a checked receive request. Each commitment can receive one whole unit once. For two units, create two requests. After payment, check the output ID, weight and full commitment.

To see the balance for one commitment on another browser, enter its public 20-byte handle below and choose **Watch in another browser**. Scan the QR code or copy the link. On the receiving browser, **Check balance** asks the public validator for that handle’s balance. Anyone holding the link can read the same balance. Spending requires the local wallet.

## Choosing a spending suite

Both ML-DSA-65 and SLH-DSA-SHA2-192s work on Testnet 1. The former uses module lattices. The latter uses hash-based signatures and has larger transfers. A unit is protected by the suite in its own commitment. A move to another suite needs a fresh descriptor and a valid signature under the old suite. The recent AI-assisted papers reviewed on 27 November gave us no demonstrated practical forgery for either public wallet option. [Read the dated security review](/blog/ai-math-and-p2party-keys)

## Who can see my balance?

A watch link shows the amount at **one receive request**. Your companion makes a new signing key and nonce for every new request. Sharing one handle gives the recipient no list of the others. On Testnet 1 the amounts and links between spends are public. Someone who recognizes transactions or already knows which handles you control can infer more. Older wallets that reused a signing key reveal the same public key when those units are spent.

To see all your holdings together without sending a list of addresses to the public RPC, import a complete public Testnet 1 snapshot from a replica you trust into your local companion. It matches your commitments on your device. The displayed total is the replica’s reported result at the file’s height. This offline view cannot establish by itself that the file is current or authentic. [Snapshot format and source instructions](https://github.com/p2party/p2party-server/tree/2a023b3f2733d8cf5f1cc90edfae577cf6e79f85/clients/evm/portable-wallet) · [Holder privacy and the mainnet design](/whitepaper#what-one-address-reveals-about-a-holder)
