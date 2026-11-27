## Available on the public service

The web client uses SDK **0.15.1**, signaling **v5** and encrypted peer protocol **v4**. The latest release repairs missing peer connections after a signaling outage and reports which room leaves the server acknowledged during a purge. Direct and forced-relay browser transfers both passed on the public service. [Release notes](/blog/room-history-and-purge) · [Protocol guide](/protocol)

**P2Party Testnet 1** has a single public validator and RPC. Its first three receipts record a grant and two spends of the same valueless unit through ethers and viem. Anyone can read them from the public endpoint. [Verify the receipts and balances](https://github.com/p2party/p2party-js/blob/master/docs/testnet-1.md#verify-the-first-public-transfers)

## Tested locally

**Rendezvous timing.** Two browsers used two local stores to compare two schedules at three start times. All 24 exchanges completed across two matched sets, with zero late appends. With an 800 ms delay added to chunk reads, the revised slot order cut verification time at the slower peer by 7.94–7.99 seconds in the first set. After implementing the schedule as an explicit option in the prototype, the second set reproduced an 8.00-second saving at all three start times. That is two four-second windows. Ordinary local reads showed no whole-window saving. These measurements cover loopback latency. Public rooms continue to use signaling v5.

**Ledger verification.** Separate local databases replayed signed transfers from the same genesis. The native proof tool and the replica calculated the same SHA-512 receipt root. An inclusion proof showed that a transfer belonged to that history, and a consistency proof showed that a later checkpoint extended it. Two local signing keys certified the same checkpoint using ML-DSA-65 and SLH-DSA-SHA2-192s. The signing journal returned the original witness on a retry and refused a conflicting history. Both keys were under the same administration for this test.

## Next milestones

1. **Measure room behavior across networks.** Repeat the timing comparison with more browsers, independent stores and realistic network delay. Measure cover traffic and recovery across networks. The two-store schedule remains experimental.
2. **Bring up a separately operated replica.** A second administrator needs to control its host and signing key, pin the genesis and operator policy, and compare the history against the public operator at a common height. Public consensus and fork choice remain open design work.
3. **Prove ledger state to wallets.** Extend receipt-history proofs with a sparse tree covering spent units, applied transfers and previously used owner commitments. A wallet also needs the original transfer or genesis allocation to connect a receipt to the output it wants to spend.
4. **Validate the native apps and review the protocol.** Exercise Android local-network permissions, a physical-device LAN transfer and TURN fallback, and complete platform signing. Independent cryptographic review is still pending.

Any future monetary network needs its own issuance and governance rules. The current testnet uses valueless units. [SDK roadmap](https://github.com/p2party/p2party-js/blob/master/ROADMAP.md)
