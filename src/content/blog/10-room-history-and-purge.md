---
title: "What happens to a room when you reconnect or purge"
slug: "room-history-and-purge"
description: "How the browser recovers a peer connection, where it keeps session keys, and how to tell whether the signaling server acknowledged a leave."
author: "Dimitris Karoukis"
date: "2026-11-27"
series: "Road to protocol-v3"
seriesOrder: 10
status: "published"
commitAnchors: []
tags: ["WebRTC", "signaling", "storage", "privacy"]
---

SDK **0.15.1** and signaling server **0.2.2** change what happens when you return to a room or remove an identity. Existing identities, messages and room settings survive the browser storage upgrade. [SDK source](https://github.com/p2party/p2party-js/tree/v0.15.1) · [Signaling health](https://signaling.p2party.com/health)

## Returning to a room

When signaling returns, the client checks which peer connections need repair. Peers whose connection survived can keep talking while a missing connection is authenticated again.

Opening a room with a long message history now takes work proportional to the number of messages loaded. Reading the same history again leaves one copy of each message in the room. A local test exercised the normal SDK entry point with 20,000 messages. Internal background requests release their tracking records on completion. The test suite also checks for timers left running and for tests whose results depend on execution order.

## What stays on the device

The upgrade moves the contacts-only preference for a room out of legacy browser storage keys that contained its invitation capability. Choosing relay-only connections in the SDK limits the ICE candidates sent to peers to TURN relay candidates. This setting is useful when the other peer should see the relay address instead of a local or publicly discovered address. The relay still sees the connecting network address.

Live browser ratchet keys stay in memory. Version 24 of the browser database discards previously saved session records without reading their keys. Reloading a page establishes fresh sessions under the saved identity. Your identity, room preferences and previously saved messages remain available on that device. Applications using the separate standalone session API can still explicitly export and restore a snapshot.

## What a purge can confirm

**Purge Identity** and **Purge All Data** ask the signaling server to remove the outgoing identity from the rooms the device knows about. They allow three seconds for all the acknowledgements together. Local deletion then proceeds, including when the server is unavailable. The result lists room IDs whose leaves could not be confirmed and tells you if it could not finish reading the local room list. An older saved room whose server or identity is unknown is reported locally without sending its locator to another server.

The public server now expires an offline identity and its room memberships after 90 days without authentication. A disconnected peer can remain listed during that period. When the identity table is full, the server can also reclaim the oldest eligible offline identities, with a ten-minute reconnect window. A returning peer can sign in with the same identity key and rejoin its rooms. Copies of messages on other people's devices are outside a local purge.

## The public testnet

P2Party Testnet 1 still has one public operator and 128 valueless units. In a separate local test, a second validator with its own PostgreSQL database verified the transfers under both signature suites and reproduced their balances. It refused an altered earlier receipt, an invalid signature, a mismatched output, a missing receipt and a different genesis. Public consensus and independent finality remain open work. [Public testnet and verification guide](https://github.com/p2party/p2party-js/blob/master/docs/testnet-1.md)
