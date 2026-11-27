## Joining a room

An invitation carries a secret in its URL fragment. The browser opens a WebSocket and signs a challenge for that signaling host. It sends a SHA-512 hash of the invitation secret to find the other members. The service can associate that hash with identity keys, connection times and connecting network addresses. It limits connections and room membership by identity. One person can create multiple identities. An optional room PIN adds a proof that peers know the same PIN.

Signaling server **0.2.2** speaks **signaling v5**. The encrypted conversation between two browsers uses **peer protocol v4** in SDK **0.15.1**. These versions describe different parts of a connection. [Signaling server source](https://github.com/p2party/p2party-server) · [Signaling health](https://signaling.p2party.com/health) · [SDK release](https://github.com/p2party/p2party-js/releases/tag/v0.15.1)

## Sending and recovering a message

Each pair of browsers combines an X25519 three-DH exchange with the room’s selected ML-KEM suite. Ed25519 identity signatures bind the exchange to the peers. A Double Ratchet derives fresh message keys, and periodic ML-KEM exchanges refresh the session. Room identity authentication still depends on Ed25519. [Review of the November discrete-log and LWE papers](/blog/ai-math-and-p2party-keys)

The browser keeps live session keys in memory and negotiates new ones after a reload. [Run the handshake in your browser](/session-lab)

Text and files travel over WebRTC, directly or through a TURN relay. Each encrypted cell is 65,490 bytes. Recipients verify chunks against the message’s Merkle root before reassembling them. A prepared file can resume after a reload. On the public service, two browser pairs recovered a stored message and verified every byte of a 32 KiB file, one pair over a direct connection and the other over forced TURN. The 16 MiB and 64 MiB recovery runs used local infrastructure. [Transfer results](/blog/rooms-after-signaling-v5)

## What others can observe

A fixed cell size hides the length of an individual chunk. An observer can still count cells and measure the interval between them. Rooms can select a fixed sending rhythm. Its wide-area privacy properties and the peer protocol’s independent cryptographic review remain open.

The signaling service introduces peers and records room memberships. Device purges report which leaves the service acknowledged. The public server expires an offline identity and its memberships after 90 days without authentication. A recovery phrase restores an identity on another browser. The original device keeps its saved messages and files. [Room recovery and purge](/blog/room-history-and-purge) · [Privacy policy](/privacy-policy)

## The public testnet

The signaling host also serves an RPC and validator for **P2Party Testnet 1**. Anyone can read the ledger. A wallet can authorize a native transfer with ML-DSA-65 or SLH-DSA-SHA2-192s. A single public operator orders transfers against a genesis allocation of 128 valueless units. Chat works independently of the ledger.

The first grant at height 1 and the transfers at heights 2 and 3 let you follow the same unit. An ethers client spent it with ML-DSA-65, and a viem client spent the resulting output with SLH-DSA-SHA2-192s. The adapters support native balances and transfers. Smart-contract execution is outside the current testnet. [Browse Testnet 1](/explorer/testnet) · [Check the public receipts](https://github.com/p2party/p2party-js/blob/master/docs/testnet-1.md#verify-the-first-public-transfers) · [Validator health](https://signaling.p2party.com/rpc/health) · [Native verifier source](https://github.com/p2party/libdemos)

## The commitment tree

Figure 1 in Dimitrios Karoukis’s 2023 paper follows a single voting unit through three owners. The interactive tree uses the figure’s labels for the previous root. In the same paper, equation (1) explicitly hashes the previous identifier before combining it with the new owner branch. [Play the commitment tree](#walkthrough-commitments) · [D. Karoukis, *Publicly verifiable delegative democracy with secret voting power*, arXiv:2302.14421v2, §3, Definition 3.3 and Figure 1, pp. 6–7 (2023)](https://arxiv.org/pdf/2302.14421v2#page=7)

Testnet 1 uses a domain-separated SHA-512 owner commitment. Its signed move names the previous input and the new commitment. A separate hash of the move ID and output index identifies the resulting unit. The native transfer publishes its weight and spend link. [Native encoding and verification](https://github.com/p2party/libdemos/blob/94c6e968a7cba8dc30e2d53ca781fbfacb3e97c1/ledger/transfer.c)

## Experimental relay and validator protocols

A local payer can select multiple consenting browser relays, cap the total price and transfer a whole test unit to each provider after an authenticated delivery. Local validators also certify proposal data and vote on the history they will execute. The receipt log and spent-state tree let a wallet tie a unit to its owner commitment at a given checkpoint. The public room and testnet paths above describe the deployed protocols. [Worked relay purchase](/whitepaper#buying-a-route-with-multiple-relays) · [Consensus and state proofs](/whitepaper#how-validators-agree-on-transaction-order) · [Roadmap](/roadmap)
