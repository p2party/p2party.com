## Move spending access

Bring **the encrypted wallet file** and **the recovery code you saved separately**. The local companion can use them to restore the signing key and receive nonce for every request in that file. Keep your wallet file and recovery code in the companion on your own computer. This website only accepts public balance handles.

**If you have the old browser**, open its local wallet and choose **Move to another browser**. Download a current encrypted backup. Choose **Show recovery code** and record it separately. On the same computer, open the companion’s local address in your other browser. On another computer, start its own companion and open the address it prints. Choose **Restore my wallet**, select the file and enter the code. Open a receive request and choose **Check spending access**. The companion signs a synthetic transfer offline so you can verify the restored request without spending a test unit.

**If you lost the old device**, start the same way with your most recent saved file and code. Only the receive requests included in that backup can be restored. If every usable kit and the original signing material have been lost, access to those units is lost.

Restoring makes a second copy with spending authority. Either copy can authorize a spend until the ledger accepts one. The companion runs from source on a computer with Node 26.13.1 or later. A phone browser can open a public watch link. [Local companion source and setup](https://github.com/p2party/p2party-server/tree/research/portable-spending-wallet/clients/evm/portable-wallet)

## Start a local wallet

In the server source containing the companion, run the following commands from the repository root. Open the loopback address printed in your own terminal.

```sh
npm ci --prefix clients/evm/portable-wallet
node clients/evm/portable-wallet/serve.mjs
```

Choose **Create a new wallet** and select your signing suite. Download the encrypted file and save the recovery code elsewhere, for example in a password manager. Choose **Check my backup** and reopen that file with your saved code. The companion then shows the full public receive commitment and its shorter balance handle. Keep the wallet process running while you use it. After adding another request, confirm an updated backup before giving the commitment to a payer.

Existing command-line wallets keep a private `key.pk8` and `nonce` in each receive directory. The companion’s local `import-legacy.mjs` command checks both against the expected public commitment and builds a recovery kit. To make a payment from a restored kit, review the full destination, unit value and expiry in the companion’s `sign-offline.mjs` command. It exports a signed transfer that the command-line client can submit. Retain your signed file and move ID until settlement. [Existing wallet instructions](https://github.com/p2party/p2party-js/blob/master/docs/testnet-1.md) · [Earlier command-line restore test](/blog/restoring-a-p2party-wallet)

## Receive a payment

Give the payer **Testnet 1**, the signing suite and the **full 64-byte commitment** for a checked receive request. Each commitment can receive one whole unit once. For two units, create two requests. After payment, check the output ID, weight and full commitment.

To see the balance for one commitment on another browser, enter its public 20-byte handle below and choose **Watch in another browser**. Scan the QR code or copy the link. On the receiving browser, **Check balance** asks the public validator for that handle’s balance. Anyone holding the link can read the same balance. Spending requires the local wallet.

## Choosing a spending suite

Both ML-DSA-65 and SLH-DSA-SHA2-192s work on Testnet 1. The former uses module lattices. The latter uses hash-based signatures and has larger transfers. A unit is protected by the suite in its own commitment. A move to another suite needs a fresh descriptor and a valid signature under the old suite. The recent AI-assisted papers reviewed on 27 November gave us no demonstrated practical forgery for either public wallet option. [Read the dated security review](/blog/ai-math-and-p2party-keys)
