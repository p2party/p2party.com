# Web client changelog

## November 27, 2026 — P2PARTY ledger explorer

- Browse [Testnet 1](https://p2party.com/explorer/testnet), inspect signed transfer bytes and share a receipt by move ID or height. The [mainnet page](https://p2party.com/explorer/mainnet) shows its prelaunch status.

## November 27, 2026 — Public protocol and roadmap

- Link the landing page and field notes to the [protocol guide](https://p2party.com/protocol) and [roadmap](https://p2party.com/roadmap). Both pages are prerendered and indexed.
- Surface the direct and relayed file checks, public testnet receipts and local two-store timing results on the landing page. The roadmap records the locally verified receipt proofs and signed checkpoints alongside the milestones for an independent operator and wallet state proofs.

## November 27, 2026 — SDK 0.15.1 and signaling 0.2.2

- Repair missing peer connections after signaling returns. Room history loads without duplicate entries, and internal completed requests release their tracking records. The SDK was exercised with 20,000 stored messages.
- Move the contacts-only preference off legacy localStorage keys containing the room capability. Relay-only mode filters host and server-reflexive addresses. Browser storage v24 discards old ratchet records and keeps the identity, messages and room settings.
- Report unacknowledged room leaves after identity or full-device purge. The production signaling service applies 90-day offline retention. SDK regression tests cover leftover timers and test-order dependencies.
- A second validator reproduced transfers and balances in a local two-database test. The public valueless testnet remains single-operator. [Release article](src/content/blog/10-room-history-and-purge.md) · [Public testnet](https://github.com/p2party/p2party-js/blob/master/docs/testnet-1.md)

## November 27, 2026

- The public web client uses SDK 0.15.0 and signaling protocol 5. Room peers continue to encrypt with protocol 4. Self-hosters should upgrade signaling before updating clients.
- Contacts and blocks follow a proved identity key after a reconnect. Legacy history remains readable. A message without an authenticated key cannot be used to add or block a contact.
- Retained files can resume after sender reload. Interrupted cleanup can retry on restart. Local browser tests verified 16 MiB recovery and a 64 MiB interrupted send byte for byte.
- Two fresh Chromium pairs verified persisted text and a byte-exact 32 KiB disk-backed file through the public service. Browser statistics confirmed one direct ICE path and one forced TURN path.
- Android now targets API 37. Debug and unsigned release builds passed, alongside an Android 16 emulator check for keyboard and status bar behavior. Android 17 permission and physical-device validation are outstanding.
- The release article links to P2Party Testnet 1, a live single-validator experiment. All six public downloads matched the release assets. A fresh wallet installation checked both chain IDs and read the genesis head.
- One grant funded a valueless unit at height 1. Ethers spent it with ML-DSA-65 at height 2 and viem spent it with SLH-DSA-SHA2-192s at height 3. Both verified receipts, historical balances and exact signed retries. [Query the receipts](https://github.com/p2party/p2party-js/blob/master/docs/testnet-1.md#verify-the-first-public-transfers)

[Release article](src/content/blog/09-rooms-after-signaling-v5.md) · [SDK release](https://github.com/p2party/p2party-js/tree/v0.15.0) · [Native build record](docs/native-builds.md)

## September 9, 2026

SDK 0.14.10 and server 0.1.4 addressed peer reconnection and durable transfer recovery. [September release notes](src/content/blog/08-after-the-desync-fixes.md)
