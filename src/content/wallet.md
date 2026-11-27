## If you lose access to the old browser

Restore the latest encrypted wallet file with its matching recovery code. A file saved before you created a receive request cannot recover that request. If you still have the old browser, save a fresh backup there first. Someone with both the file and the code can spend from the wallet. The 24-word room phrase restores a chat identity. A P2PARTY wallet uses the file and code.

## Who can see my balance?

The wallet checks public ledger history and matches your receive requests on your device. Other people can follow the amount and activity of a public request you give them. A watch link lets another browser look up that one request. It carries no spending key. [Holder privacy](/whitepaper#what-one-address-reveals-about-a-holder)

If the validator is unavailable or the height is older than a payer’s receipt, try again later. Keep the result unconfirmed until you can verify the payment. For an offline check, download a public history file and import it in the wallet. You can see the file’s height there. [Download public history](/wallet/snapshot/)

## Choosing a spending suite

Testnet 1 supports ML-DSA-65 and SLH-DSA-SHA2-192s. The wallet uses the suite recorded for each receive request. ML-DSA-65 produces smaller signatures. SLH-DSA-SHA2-192s uses hash-based signatures. [How the two signing families work](/blog/ai-math-and-p2party-keys)

## Use the desktop companion

The desktop companion can import older command-line wallets. Keep each original private key and nonce together. In the browser wallet, use **Import an older command-line wallet** to convert one receive folder at a time. The desktop importer can combine several. To pay offline, review the destination and amount, then export the signed transfer for separate submission. [Companion setup and legacy recovery instructions](https://github.com/p2party/p2party-server/tree/d2f0f306737a9979f5ff5264770ac6a9043ef352/clients/evm/portable-wallet)
