---
title: "We restored a wallet from its key and receive nonces"
slug: "restoring-a-p2party-wallet"
description: "A clean-device test with both public signing suites, plus what to save, what to share and what a relay purchase should show."
author: "P2Party"
date: "2026-11-27"
series: "Road to protocol-v3"
seriesOrder: 12
status: "published"
commitAnchors: []
tags: ["wallet", "recovery", "testnet", "relay payments"]
---

If your phone disappeared today, could another device spend the same P2PARTY unit? We exercised that question with the published Testnet 1 wallet package, newly generated keys and a native verifier. A public receipt let us identify a unit. The things that let us sign for it were the private signing key and the original receive nonce.

## Why there are two pieces

A wallet gives the payer a fresh commitment. The commitment binds its chosen signature suite, a hash of a random 32-byte nonce and a hash of the signing public key. The payer can transfer a whole unit to that commitment without seeing the private material. To spend it later, the client uses the original nonce and the matching signing key. Each fresh receive request needs its own saved nonce. The read handle for a commitment is public and works for balance lookup. A wallet can hold many such commitments. [Wallet guide](/wallet) · [\[1\]][r1]

## The restore test

We ran the same check with ML-DSA-65 and SLH-DSA-SHA2-192s. Each disposable wallet had a PKCS#8 signing key and two independent receive nonces. We put the files in a passphrase-protected archive using GnuPG’s AES-256 symmetric mode. In a fresh process with a separate keyring, we restored the files, recomputed both public descriptors and their read handles, and compared them with records saved before the backup. An incorrect unlock secret failed to recover the archive.

With the restored key and the correct nonce, the published client signed a synthetic transfer and the native verifier accepted it. A different key and a nonce for the other commitment both failed. This test ran offline and spent no public unit. The archive was a way to exercise a portable backup with existing software. The released wallet package currently exposes files and a signer API. [Published client and checksum](https://github.com/p2party/p2party-js/blob/master/docs/testnet-1.md#install-the-wallet-client)

## What a user should carry

On a replacement device, the browser restore page accepts an encrypted backup and a separate high-entropy recovery code. Back up an incoming payment request before showing it to a payer. A backup made yesterday cannot reproduce a randomly generated nonce first created today. A wallet also needs to record pending signed payments so it can recover after a lost acknowledgment.

Keep payment descriptors and recovery material visually distinct. The QR code or link you show another person should contain a fresh public destination and the intended network. A recovery file and its unlock secret belong only on devices you trust. The room recovery phrase restores a chat identity. The current ledger wallet uses separate keys and nonces. A copied usable backup carries the same spending authority as the original.

For someone buying a multi-hop route, the confirmation should show the selected volunteers in order, the reward for each, the expiry and total cap. Our local browser fixture lets a payer review signed quotes, approve or cancel and inspect each payee’s native receipt. A public visitor can already check a testnet balance with a read handle. [Try the read-only wallet view](/wallet#check-a-public-balance) · [Local payer screen](https://github.com/p2party/p2party-js/blob/research/multi-relay-payout-local/docs/e2e/volunteer-relay/README.md#choose-a-paid-route) · [Review of the new cryptographic research](/blog/ai-math-and-p2party-keys)

## References

1. D. Karoukis. “Publicly verifiable delegative democracy with secret voting power.” arXiv:2302.14421v2, 5 May 2023. [Full text][r1]

[r1]: https://arxiv.org/abs/2302.14421v2

## We tried the two-browser recovery flow

In the new local companion we created both Testnet 1 spending suites, saved an encrypted file and a separate code, and stopped the original wallet process. The replacement browser reopened the file and signed an offline transfer against the original receive commitment. Chromium-to-Firefox recovery also passed for ML-DSA-65. A wrong code failed before it could expose a receive request. This tested locally generated units without a public payment. The browser restore now also accepts a dropped file or pasted backup text. Chromium and Firefox each signed a payment with both supported suites while networking was disabled. The native verifier accepted every signed payment. The browser exports the signed transaction for separate submission. [Move a wallet](/wallet#move-spending-access) · [Companion source and tests](https://github.com/p2party/p2party-server/tree/8d0c855489c72ed25c377825d314ee8babbaf489/clients/evm/portable-wallet)

The portable file groups a holder’s requests privately. Each new request has its own signing key and nonce. A merchant holding one watch link can see that unit’s balance. Amounts and the connection between successive spends remain publicly visible, as the receipts at Testnet 1 heights two and three demonstrate. [What one address reveals](/whitepaper#what-one-address-reveals-about-a-holder)
