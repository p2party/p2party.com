---
title: "Your contacts and files after signaling v5"
slug: "rooms-after-signaling-v5"
description: "What changes when you reopen a room, what two browsers verified on the public service, and the next device and privacy checks."
author: "Dimitris Karoukis"
date: "2026-11-27"
series: "Road to protocol-v3"
seriesOrder: 9
status: "published"
storyPeriod: "2026-11-27"
commitAnchors: []
tags: ["WebRTC", "signaling", "identity", "file transfer"]
---

The web app now uses SDK **0.15.0**. When you reopen a room, your browser opens a WebSocket without putting your identity key in its URL. It signs a challenge for that signaling host and joins using a SHA-512 hash of the invitation capability. The service can still associate that room with its members' keys and connection times. Signaling uses protocol **5**. Each pair of peers continues to encrypt messages and files using protocol **4**. [Signaling health](https://signaling.p2party.com/health) · [SDK source](https://github.com/p2party/p2party-js/tree/v0.15.0)

## Contacts and history after a reload

A server can assign your contact a different routing ID after a reconnect. The address book and block list now follow the Ed25519 key the peer actually proves. The local database migrates entries with a usable public key. Older messages stay readable. Where a message has no authenticated sender key, it cannot be used to add or block a contact. A recovery phrase restores the corresponding identity on another device. Its chat history and files stay in the original browser profile.

If a file send finished preparation before the sender reloaded, it can resume from the missing chunks. Deleting a room or message now reports a file that the browser could not remove. Cleanup can retry after the next start. This matters when a tab still holds a file open. [SDK migration notes](https://github.com/p2party/p2party-js/blob/v0.15.0/CHANGELOG.md)

## What reached another browser

Two fresh Chromium profiles opened an invitation on the public site, authenticated, and exchanged a short message and a 32 KiB file. The receiver read the message back from storage and compared every byte of the disk-backed file. Both browsers reported a selected host/server-reflexive ICE path, so this transfer ran directly. A second fresh pair repeated the checks with TURN forced on both browsers. Both reported relay/relay candidates. These runs measured delivery and integrity. They did not measure latency.

The larger file tests used a local signaling server. The receiver recovered a dropped chunk and read the complete 16 MiB file after reloading. In a separate run, the sender reloaded partway through a 64 MiB file. The receiver verified every byte and the sender's identity. Three local peers also exchanged messages and recovered after a wrong room PIN. These are the file sizes exercised by those checks. The SDK's configured transfer ceiling is 10 GiB. [Browser acceptance report](https://github.com/p2party/p2party-js/blob/v0.15.0/docs/e2e/release-0.15.0.md)

## What comes next

The web release is available now. Android debug and unsigned release APKs build for API 37. On an Android 16 emulator the PIN screen resized when the keyboard opened and returned to its original height when it closed. The next native checks are Android 17 local-network permission grant and denial, a real LAN connection, and TURN fallback on a physical device. The native apps still need signing and device validation.

Independent review of the peer protocol and wide-area measurements of recovery and cover traffic remain open. The two-store rendezvous prototype can connect two local browsers, but the public room flow still uses the signaling service. [SDK roadmap](https://github.com/p2party/p2party-js/blob/master/ROADMAP.md) · [Native protocol tests](https://github.com/p2party/p2party-js/tree/v0.15.0/tests/cryptography)

## A separate network for testing transfers

P2Party Testnet 1 is awaiting activation. The wallet, its source and the genesis are available now. Once the validator reports the chain IDs in the guide, developers can request a test unit and submit a native post-quantum transfer. Chat rooms, contacts and files operate independently of this experiment. Genesis created 128 units of weight one, with no monetary value. The operator can grant an existing unit to a fresh receive commitment. A wallet signs a spend with ML-DSA-65 or SLH-DSA-SHA2-192s, and anyone can check the resulting receipt. [Developer guide and genesis](https://github.com/p2party/p2party-js/blob/master/docs/testnet-1.md) · [Native transfer verifier](https://github.com/ondemos/libdemos/tree/ceef24a8bf1f5dee045e72c838ffdbf080d9cd83/ledger)

The network design uses one validator to order transfers. The Ethereum-facing chain ID is `1345474644` (`0x50325054`), which client libraries can use to identify the endpoint. The client signs native transfers. EVM execution, proof of stake, independent validators and mainnet monetary rules remain outside this design. [Validator health endpoint](https://signaling.p2party.com/rpc/health) · [Wallet and RPC examples](https://github.com/p2party/p2party-js/blob/master/docs/testnet-1.md#verify-and-spend-a-unit)
