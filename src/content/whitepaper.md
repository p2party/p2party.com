## The service people would pay for

P2Party rooms already exchange messages and files directly over WebRTC. The public signaling host introduces peers. A TURN server carries encrypted traffic when a direct connection fails. This draft proposes keeping ordinary room creation and direct transfers free, and using **P2PARTY** to buy optional network services. A room host, community or sponsor could pay so guests can join without a wallet. Today's rooms have no coin paywall. [Room protocol](/protocol) · [\[1\]][w1]

Start with relay capacity. A relay operator incurs bandwidth costs when it forwards data and can quote a price for an allowance. A direct transfer consumes none of that allowance. Signaling has a different cost structure: connection setup, membership storage and reconnect work. Test a free, rate-limited allowance first. If operators regularly exhaust capacity, try a prepaid reservation for additional concurrent connections or signaling capacity. Charging on every invitation, message or reconnect would put ordinary use and recovery behind a payment.

## Paying for an encrypted relay

A proposed relay quote identifies the provider, network, price, expiry, byte allowance and billing interval. For TURN, meter the encrypted transport datagrams the selected allocation sends toward its peer. Count each eligible outbound leg once. A TURN server cannot identify individual application cells inside the encrypted WebRTC data channel. An application-level volunteer relay can count the encrypted cells it forwards. Quote the counter and direction explicitly because the two meters include different overhead. [\[2\]][w2] Padding, cover traffic and retransmission can consume capacity, so the wallet must show the measurement rule and a hard spending cap before the user accepts. A relay must never need plaintext or room membership records to calculate the charge.

One possible settlement uses a prepaid deposit and signed, cumulative vouchers. After forwarding an agreed interval, the provider can ask the payer to authorize the next total. Either party can stop. The provider can settle the highest authorized total once, and the payer can reclaim the unused balance after expiry. This needs enforceable deposits, replay protection, expiry rules and change handling. The present ledger moves one whole unit of conserved weight. It cannot split that unit between a provider and a refund. Use prepaid fixed bundles of valueless units to test metering, recovery and usability before building voucher settlement. A valueless pilot cannot establish willingness to pay a monetary price.

## Buying a route with multiple relays

The payer selects an ordered list of volunteers and a maximum total. Each volunteer quotes a reward and supplies a fresh receiving commitment. The payer checks the network, expiry, identities, billing unit, price at each hop and sum before opening the route. A sponsor can pay on behalf of both peers. The wallet keeps each unit’s signing key and original receive nonce on the payer’s device. [What to bring to use a wallet](/wallet) Each volunteer opts in and can stop forwarding. Adding a hop consumes another operator’s bandwidth and increases the amount due.

**Worked purchase.** Alice selects Dana and Bo, in that order, to reach Casey. Both quote one test P2PARTY to forward one encrypted application record. Alice sets a cap of two and supplies two distinct weight-one units. On delivery, her wallet can move one unit to Dana’s commitment and one to Bo’s. A cap of one cannot buy this route. The billing unit in this experiment is one 65,559-byte encrypted record at each hop. A commercial bandwidth tariff would also need rules for retransmissions, partial delivery, rounding and network overhead.

The local purchase binds the ordered quotes, payout commitments, content digest and delivery challenge to one request. Each provider signs its quote with ML-DSA-65. Each selected relay signs its route position and the digest of the ciphertext its outgoing data channel accepted. After decrypting, the recipient signs the matching ciphertext digest, content digest and delivery challenge. The payer verifies all observations under the pinned receipt keys. These Ed25519 evidence signatures are classical. The native payout uses the wallet’s post-quantum signature suite. The payer journals the signed payouts before submitting them. If submission stops between providers, it can retry the original bytes and look up each native receipt. Separate whole-unit transfers allow partial settlement. A provider still trusts the payer to authorize payment after delivery, and a payer who controls the endpoints can fabricate demand. Enforceable fair exchange, escrow and refunds require additional protocol work.

## Visitors as volunteer relays

A visitor could opt in to forward encrypted P2Party cells between two peers. The analogy to a Tor relay is that an intermediate participant contributes bandwidth. A browser would open WebRTC data channels to its immediate neighbors and forward only traffic assigned to that P2Party circuit. It would have no interface for fetching an arbitrary URL or connecting to a destination on the public internet. The recipient would still authenticate and decrypt the original end-to-end message. [WebRTC data channels](https://www.w3.org/TR/webrtc/) · [Tor relay types](https://community.torproject.org/relay/types-of-relays/)

Participation should be off until the visitor chooses a time and byte budget. Show bytes in both directions, active circuits and a stop button. A route can include several volunteers. Each sees its immediate neighbors. Browser suspension, tab closure and NAT can interrupt service. The sender needs a fresh route or a TURN fallback, and must retain the unacknowledged data needed for recovery. If a volunteer's own link uses paid TURN, show who pays that leg before enrolling them.

**Browser results.** On a closed loopback network, the original single-volunteer test recovered every byte at the recipient and rejected decryption under the volunteer’s own session. The paid pilot then exercised two and three intervening volunteers. In the two-volunteer case, the sender and recipient exchanged 1,024 bytes of authenticated plaintext including the delivery challenge. The native validator credited the two distinct payees once each. In the three-volunteer run, a downstream refusal produced no delivery receipt and zero payouts. Repeating a successful purchase left the ledger at three transfers. Ordinary public rooms currently use direct WebRTC or TURN. Volunteer enrollment and payments are local experiments. [Run a paid relay route](https://github.com/p2party/p2party-js/blob/research/multi-relay-payout-local/docs/e2e/volunteer-relay/README.md#choose-a-paid-route)

Volunteers can observe timing and volume. Additional hops alone cannot establish anonymity or operator independence. Keep route identities, challenges and acknowledgments off the public ledger. Public transfers still expose amounts and spend relationships. Fund providers from the requesting party’s budget. Minting new rewards for reported bytes would give colluding peers a reason to generate artificial traffic.

## Visitors as verifiers

Visitors can participate at several levels. The explorer already recomputes native receipt identifiers from the signed bytes returned by the RPC. A visitor who downloads those same bytes from one operator still depends on that operator for the history it supplies. A stronger browser verifier would pin the genesis and an independently obtained operator policy, verify signed checkpoints, and check receipt inclusion and consistency against a previously saved checkpoint. An old but internally consistent signed prefix can be replayed. A verifier needs a freshness rule and a recent checkpoint from a second, independently obtained source. Checking spendability also needs the output's originating transfer and authenticated state proofs. [Testnet explorer](/explorer/testnet) · [\[3\]][w3]

A visitor can verify evidence and report disagreement. Signing a vote on transaction order requires an admitted validator key, durable signing records and the ability to retain and serve transaction data. Counting browser tabs cannot measure how many independent validators participate.

## Ownership commitments and wallet proofs

A recipient gives the payer a fresh 64-byte commitment. In the native ledger, its opening binds the signature suite, the SHA-512 hash of a private random nonce and the SHA-512 hash of the public key. The two public spending options are lattice-based ML-DSA-65 and hash-based SLH-DSA-SHA2-192s. See the [dated research review](/blog/ai-math-and-p2party-keys) for their different assumptions. A later spend reveals the public key and nonce hash and supplies a matching signature. The verifier checks the opening, input, expiry and conserved weight. Each accepted move produces a new output identifier derived from the signed move. These rules adapt the commitment scheme developed for voting units. Reversible delegation in the original design is a separate operation from a currency transfer. [\[4\]][w4] · [Native source](https://github.com/p2party/libdemos)

A receipt inclusion proof answers “was this move in the ordered history?” A wallet also needs to establish which output it received and whether anyone spent it by the certified height. The local design commits to three sets in one SHA-512 sparse Merkle tree with separate key domains. These record spent input IDs, applied move IDs and previously used owner commitments. The wallet connects the unit to its pinned genesis allocation or to the signed transfer in the receipt log, checks its own receiving commitment, and verifies an absence proof for the spent input ID. A certificate binds the network, committee, ordering anchor, height, receipt root and state root. An old certificate describes an old state. A wallet must obtain a sufficiently recent checkpoint through a trusted channel before relying on the result. [Native state-proof format](https://github.com/p2party/libdemos/blob/feat/ledger-sparse-state/ledger/README.md#offline-state-proofs) · [Wallet verification](https://github.com/p2party/p2party-server/blob/research/certified-dag-ordering/tools/ordering/native-replay.md)

## How validators agree on transaction order

In the local fixed-committee design, validators first store proposals and sign their availability. Each round refers back to certified proposals from the preceding round. With four pinned operators and at most one faulty operator, three distinct signatures form an availability certificate. A validator durably records its decision before returning its signature. Availability establishes that a quorum accepted the data. Further votes recorded by the graph determine when an anchor and its causal history can be ordered. This follows Narwhal’s separation of availability and ordering and the partially synchronous Bullshark anchor rule. [\[5\]][w5] · [\[6\]][w6]

Validators derive the same transaction sequence from the committed graph. For competing spends of one unit, the first valid spend in that order consumes it. Each validator replays the native transfer rules and signs the resulting height and roots. A wallet checks a quorum certificate against the committee it already trusts. This local model exercises agreement, withholding, recovery and conflicting votes. The single public operator still determines Testnet 1’s order. Deploying this protocol requires independent operators, authenticated transport and data retrieval, round timeouts and recovery, membership changes and an independently reviewed implementation. [Ordering implementation and test cases](https://github.com/p2party/p2party-server/blob/research/certified-dag-ordering/tools/ordering/README.md)

Mysticeti removes explicit vertex certification to shorten the path to commitment. [\[7\]][w7] Shoal++ studies latency improvements within DAG consensus. [\[8\]][w8] Their measurements motivate a comparison under P2Party’s larger signatures and relay workloads. A 2026 study of Mysticeti also found that deterministic tie-breaking can favor particular validators. Agreement on one order gives no guarantee of fair arrival order. The pilot’s tie-break and fee policy therefore need separate measurement before there is money at stake. [\[9\]][w9]

## Supply and operator funding

Testnet 1 began with 128 valueless units. That allocation is a test fixture and gives no entitlement to future mainnet units. This proposal leaves mainnet supply, distribution, issuance, fee levels and validator selection open. The ticker is **P2PARTY**. The coin uses the same cat icon as the site.

As a first test, pay service providers from customer or sponsor budgets and fund initial validators from a separately disclosed operator budget. Record the cost of bandwidth, storage, signing and uptime separately. A later settlement fee could help fund validators, provided its proceeds are measured against those costs. Relay payments and validator payments buy different services. A relay operator cannot use forwarded bytes as evidence that it independently validated a ledger.

## Decisions before mainnet

1. Measure signaling load, relay egress and reconnects with aggregate counters. Publish the accounting definition and a worked bill without publishing room membership, peer addresses or wallet-to-room mappings.
2. Exercise paid routes across independent devices and networks. Measure the effect of losing each volunteer in turn, recovery through an alternate route, and the cost of abandoned transfers.
3. Pilot fixed-price relay bundles on the valueless testnet. Compare them with sponsored sessions. Record disputed bytes, unused balances, settlement costs and the share of users who can still participate without a wallet.
4. Run separately administered nodes, test retrieval after disconnection, compare order and state certificates, and establish how wallets learn a fresh checkpoint.
5. Publish a new genesis proposal only after supply, initial allocations, validator funding, key rotation, governance and an independent security review are ready for scrutiny. [Project roadmap](/roadmap) · [Mainnet explorer](/explorer/mainnet)

## References

1. T. Reddy, A. Johnston, P. Matthews and J. Rosenberg. _Traversal Using Relays around NAT (TURN): Relay Extensions to Session Traversal Utilities for NAT (STUN)._ IETF RFC 8656, February 2020. DOI 10.17487/RFC8656. [Full text][w1]
2. R. Jesup, S. Loreto and M. Tüxen. _WebRTC Data Channels._ IETF RFC 8831, January 2021, §5. DOI 10.17487/RFC8831. [Full text][w2]
3. B. Laurie, E. Messeri and R. Stradling. _Certificate Transparency Version 2.0._ IETF RFC 9162, December 2021, §2.1. DOI 10.17487/RFC9162. [Full text][w3]
4. D. Karoukis. “Publicly verifiable delegative democracy with secret voting power.” arXiv:2302.14421v2, 5 May 2023. [Full text][w4]
5. G. Danezis, L. Kokoris-Kogias, A. Sonnino and A. Spiegelman. “Narwhal and Tusk: A DAG-based Mempool and Efficient BFT Consensus.” _EuroSys ’22_, 2022. [DOI 10.1145/3492321.3519594](https://doi.org/10.1145/3492321.3519594). [Full text][w5]
6. A. Spiegelman, N. Giridharan, A. Sonnino and L. Kokoris-Kogias. “Bullshark: The Partially Synchronous Version.” arXiv:2209.05633v1, 12 September 2022, §2.2, Algorithm 2. [Full text][w6]
7. K. Babel, A. Chursin, G. Danezis, A. Kichidis, L. Kokoris-Kogias, A. Koshy, A. Sonnino and M. Tian. “Mysticeti: Reaching the Limits of Latency with Uncertified DAGs.” arXiv:2310.14821v6, 24 November 2025. [Full text][w7]
8. B. Arun, Z. Li, F. Suri-Payer, S. Das and A. Spiegelman. “Shoal++: High Throughput DAG BFT Can Be Fast and Robust!” _22nd USENIX Symposium on Networked Systems Design and Implementation (NSDI ’25)_, 2025, pp. 813–826. [Full text][w8]
9. I. Mirzaei and M. J. Amiri. “Fair on the Surface: Transaction-Ordering Bias and MEV in Mysticeti DAG-based BFT Protocol.” arXiv:2607.13378v1, 15 July 2026, §§3, 5–6. Preprint. [Full text][w9]

[w1]: https://www.rfc-editor.org/rfc/rfc8656
[w2]: https://www.rfc-editor.org/rfc/rfc8831#section-5
[w3]: https://www.rfc-editor.org/rfc/rfc9162#section-2.1
[w4]: https://arxiv.org/abs/2302.14421v2
[w5]: https://arxiv.org/abs/2105.11827v4
[w6]: https://arxiv.org/abs/2209.05633v1
[w7]: https://arxiv.org/abs/2310.14821v6
[w8]: https://www.usenix.org/conference/nsdi25/presentation/arun
[w9]: https://arxiv.org/abs/2607.13378v1
