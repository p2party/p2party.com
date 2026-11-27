## On the same device

A wallet manages the private material that authorizes spending and the public records used to find its units. The ledger records who can spend each unit. A new visitor can open a room, receive messages and browse the ledger without creating a wallet. To spend an existing P2PARTY unit, today's Node wallet opens the private signing key and the original 32-byte receive nonce for that unit. If your device already holds both, keep them there. The wallet uses them locally to sign. Only the signed transfer goes to the validator. [Testnet wallet instructions](https://github.com/p2party/p2party-js/blob/master/docs/testnet-1.md)

## To receive a payment

Generate a fresh receive descriptor in your wallet and save its private material **before** you give the descriptor to anyone. Tell the payer the network, the signature suite and the full 64-byte commitment. Each commitment can receive one whole unit once. For two separate units, provide two fresh commitments. After payment, check the output ID, weight and full commitment. A relayer can receive its reward the same way.

The shorter, 20-byte read handle lets someone look up the balance of one commitment. It does not contain the full payment destination. For a consumer wallet, a payment request should package the network and full descriptor in a QR code or copyable link, with the amount and expiry visible for confirmation. The current testnet client exchanges the descriptor directly.

## To move to a new device

Today’s testnet wallet example stores two private files per receive directory, `key.pk8` and `nonce`. Both are needed. Protect every directory for units you want to recover, including fresh requests that are awaiting payment. The example files are unencrypted. Make an encrypted backup before receiving funds, and keep its unlock secret separately. The testnet operator and the room recovery phrase cannot reconstruct those files. A fresh-device rehearsal restored two receive commitments under each public signing suite. [What the restore test verified](/blog/restoring-a-p2party-wallet)

On the new device, use the same ledger client to load the key and nonce, recompute each public descriptor, and query its unspent units on the pinned network. Compare the full commitments and amounts. Keep exact signed bytes and move IDs for any pending payments so the wallet can resolve an interrupted submission. A transaction receipt or screenshot is useful for lookup, but grants no spending authority. Anyone who obtains a usable copy of the signing key and matching nonce can spend the same unit.

## The wallet experience we propose

On an enrolled device, the user should open the wallet, choose **Receive** or **Pay**, and unlock it locally. A relay purchase should show the route, each payee, the charge per hop, the maximum total, expiry and any outstanding payment. A sponsor can pay so a guest can join without carrying credentials.

For a replacement device, the proposed recovery kit has two things to bring. One is an encrypted wallet backup. The other is a high-entropy recovery code stored separately. The backup must cover all signing suites, the private material for each receive request, the pinned network and pending sends. A successful restore should show the same public commitments and independently recover the same units. A phone PIN or biometric can unlock an enrolled device. Cross-device recovery and hardware signer support still need implementation and testing. The released client has no universal seed phrase.

A backup only covers the receive material it contains. An eventual wallet should verify recovery before first use and refresh the backup before sharing any newly generated request. A future seed-based wallet would need a versioned derivation and discovery specification across all supported signature suites. Losing both the device and the only usable backup leaves the current units unrecoverable. [Wallet proofs and relay pricing](/whitepaper) · [Roadmap](/roadmap)

## Choosing a spending suite

Both ML-DSA-65 and SLH-DSA-SHA2-192s work on Testnet 1. The former uses module lattices. The latter uses hash-based signatures and has larger transfers. A unit is protected by the suite in its own commitment. A move to another suite needs a fresh descriptor and a valid signature under the old suite. The recent AI-assisted papers reviewed on 27 November gave us no demonstrated practical forgery for either public wallet option. [Read the dated security review](/blog/ai-math-and-p2party-keys)
