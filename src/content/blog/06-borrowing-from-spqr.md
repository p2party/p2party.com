---
title: "Borrowing from SPQR: what a sparse post-quantum ratchet costs when you cannot chunk the ciphertext"
slug: "borrowing-from-spqr"
description: "Signal's SPQR solved post-quantum ratcheting by fragmenting ML-KEM across many messages. p2party's cells are already large enough to carry one whole. Same problem, different constraint, different construction, and why that means none of Signal's analysis transfers."
author: "Dimitris Karoukis"
date: "2026-07-26"
series: "Road to protocol-v3"
seriesOrder: 6
status: "published"
storyPeriod: "2026-07-24 to 2026-07-26"
commitAnchors:
  - "f5e9dad"
  - "d5d2ad9"
  - "f1a3a92"
  - "ebe03b1"
tags:
  - "post-quantum"
  - "ML-KEM"
  - "Double Ratchet"
  - "SPQR"
  - "prior art"
requires:
  - "mermaid"
---

The [Double Ratchet](https://signal.org/docs/specifications/doubleratchet/) has a property that looks like a footnote and is actually the whole point: it keeps healing. Compromise a device today, and the attacker reads your messages until the next DH ratchet turn lands, then loses them again. Post-compromise security is not a bonus feature. It is the reason the ratchet turns at all.

Every deployed post-quantum messaging design so far protects the _bootstrap_. [PQXDH](https://signal.org/docs/specifications/pqxdh/) makes the initial handshake harvest-resistant. So does p2party's protocol-v4 handshake, and so does [iMessage PQ3](https://www.usenix.org/conference/usenixsecurity25/presentation/linker). But if the ongoing ratchet stays classical, an attacker with a quantum computer and a compromise at any later point recovers everything after it. You have a post-quantum front door and a classical hallway.

Signal's answer is [SPQR](https://signal.org/blog/spqr/), the Sparse Post-Quantum Ratchet, shipped in the [Triple Ratchet](https://eprint.iacr.org/2025/078). p2party's sparse healing is directly inspired by it. It is also a different construction, built under a different constraint, and this post is about exactly where the two diverge, because the difference is the reason none of Signal's analysis carries over to us.

## The constraint that shapes everything

An ML-KEM-768 ciphertext is 1,088 bytes. A public key is 1,184.

For Signal, that is enormous. Signal messages are small and travel over a push infrastructure where every byte is metered across billions of messages. Attaching a kilobyte of KEM material to messages would be a serious bandwidth regression, and attaching it to _some_ messages would leak which ones.

SPQR's answer is to fragment: split the KEM material across many ordinary messages, a few bytes at a time, and reassemble it once enough fragments arrive. The ratchet advances _sparsely_: not every message, but every so often, and no single message carries a conspicuous payload. It is an elegant response to a hard constraint, and the erasure-coding machinery that keeps it working under loss and reordering is most of SPQR's complexity.

p2party does not have that constraint. It has the opposite one.

Every p2party application cell is exactly 65,490 bytes, whether it carries a nine-byte "ok" or 60 KiB of a file. That was decided two posts ago, for [unrelated reasons](/blog/the-64-kib-lie): a uniform cell means an observer cannot infer message length from frame size. The 65,405-byte plaintext cell is padded to full regardless of what is in it.

So an ML-KEM-1024 ciphertext, 1,568 bytes at the largest suite we support, occupies 2.4% of one cell that was going to be padded anyway.

We do not need to fragment. We need to decide _when_.

## Same problem, inverted cost

Here is the honest framing, and it is narrower than the slogan.

The marginal cost of a healing exchange in a **cover-enabled** room can be zero observable frames: the schedule was going to emit a cell at that moment regardless, and a KEM ciphertext displaces padding rather than adding a frame. In an **immediate-delivery** room, still the default, a healing exchange is three extra cells that would not otherwise exist, and an observer sees three extra cells.

"Free" is a dangerous word, which is why the [previous post](/blog/free-is-a-dangerous-word) was named after it. What is actually true is that our cell geometry moved the expensive part of the problem from _bandwidth_ to _scheduling_, and scheduling is where our complexity went instead of erasure coding.

<pre class="mermaid">
sequenceDiagram
    participant A as Alice
    participant B as Bob
    Note over A,B: 64 messages or 24h elapsed, quiescent boundary, Alice's turn
    A->>A: prepareHealing() -> OFFER frame
    A->>A: serialize() BEFORE sending
    A->>B: OFFER (ML-KEM public key)
    B->>B: acceptControlFrame -> ADVANCE
    B->>B: serialize() BEFORE sending
    B->>A: ADVANCE (ML-KEM ciphertext)
    A->>A: acceptControlFrame -> ACK
    A->>A: serialize() BEFORE sending
    A->>B: ACK
    Note over A,B: epoch N+1 mixed into every subsequent message key
</pre>

Three flights, one round trip and a half. Application traffic is blocked while an epoch is in flight. That is a deliberate fail-closed choice, because a message encrypted under an ambiguous epoch is worse than a message delayed by one RTT.

## The rule that took the longest to get right

Every one of those `serialize()` calls in the diagram sits _before_ its send, and that ordering is the single most important thing in the implementation.

The failure it prevents: Alice generates an OFFER, sends it, and crashes before persisting. On restart she has no record of the ephemeral KEM secret. Bob has already advanced. Alice cannot decapsulate his ADVANCE, and the two sides now disagree about what epoch they are in. That is a fork. Since the epoch is authenticated into the AEAD additional data of every subsequent frame, a fork is not a degradation. It is a dead session.

So the store-free API makes the contract explicit rather than hoping callers infer it. `prepareHealing()`, `acceptControlFrame()` and `pendingControl()` each return a `SessionControlOutput`:

```ts
interface SessionControlOutput {
  readonly frame: Uint8Array | null;
  readonly requiresPersistBeforeSend: boolean;
}
```

If `frame` is non-null, you persist before you dispatch. `pendingControl()` exists so a dropped flight can be re-emitted _byte-identically_ rather than regenerated. Regenerating would mint fresh randomness and fork the exchange just as effectively as a crash. Commit [`f5e9dad`](https://github.com/p2party/p2party-js/commit/f5e9dad) combines and persists the epoch on every Double Ratchet message path; [`d5d2ad9`](https://github.com/p2party/p2party-js/commit/d5d2ad9) is the live orchestrator that decides when an exchange is due.

## Eight bytes, because one was a bug waiting

Protocol v3 carried the PQ epoch in a single reserved byte. Protocol v4 widened it to an unsigned 64-bit counter, and that widening is a large part of why v4 is a wire break.

A one-byte epoch wraps after 256 healing exchanges. Under the due-time policy of 64 messages or 24 hours, whichever comes first, a chatty pair reaches 256 epochs in well under a year. After the wrap, two different epochs authenticate as the same value in the AEAD additional data. That is not a counter overflow bug. That is a cross-epoch key-confusion vulnerability with a calendar deadline.

Eight bytes cost seven bytes of a cell that is padded anyway. This is the clearest case in the whole protocol where the fixed-cell geometry simply paid for correctness.

## What we did not inherit

This is the part that matters for anyone evaluating p2party.

SPQR has been analysed. The Triple Ratchet has [a paper](https://eprint.iacr.org/2025/078), a security model, and proofs. p2party's sparse healing has an implementation, a test suite, and this blog post.

The differences are not cosmetic:

|                         | Signal SPQR                                     | p2party                                                   |
| ----------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| KEM delivery            | Fragmented across many messages, erasure-coded  | One whole ciphertext in one cell                          |
| Driver                  | Continuous, integrated with the message ratchet | Discrete OFFER/ADVANCE/ACK on a due-time trigger          |
| Traffic during exchange | Continues                                       | Blocked, fail-closed                                      |
| Epoch width             | n/a                                             | Authenticated u64, mixed into AEAD AAD                    |
| Handshake it sits on    | PQXDH (non-interactive, analysed)               | Interactive 3DH ⊕ ML-KEM with CPace and transport binding |
| Formal analysis         | Yes                                             | No                                                        |

That last row is the one to read twice. Because our handshake is interactive, adds an optional PAKE, binds DTLS fingerprints into the transcript, and uses its own domain-separated combiner rather than a standardized one like [X-Wing](https://eprint.iacr.org/2024/039), _none of the existing PQXDH or Double Ratchet proofs transfer to it directly_. Not "mostly transfer with minor caveats": the models do not match the protocol.

Closing that gap means a ProVerif or CryptoVerif model in the style of [Bhargavan et al.'s PQXDH verification](https://www.usenix.org/system/files/usenixsecurity24-bhargavan.pdf). It is on the [roadmap](https://github.com/p2party/p2party-js/blob/master/ROADMAP.md), it is not done, and until it is, everything here is an implementation claim rather than an analysed one.

## The leak we have not fixed, and the one we do not have

Two things get confused here, and I nearly confused them myself.

ML-KEM ciphertexts have structure. They are not uniform random bytes, and a distinguisher that can see the raw encoding can tell KEM material from padding. That is the problem obfuscated KEMs solve: [Kemeleon](https://eprint.iacr.org/2024/1086), introduced in Gunther, Stebila and Veitch's _Obfuscated Key Exchange_, maps ML-KEM public keys and ciphertexts to strings that look uniform.

But it only bites where an observer can inspect that encoding. In p2party the KEM record travels inside an authenticated fixed-size application cell, and that cell then travels inside DTLS. The adversary in our threat model sits at or before DTLS and TURN, which means they see AEAD ciphertext, not ML-KEM coefficients. Running a raw-byte uniformity test at that position is a category error, and we corrected our own roadmap after making exactly that mistake.

So Kemeleon is prior art we have to cite, not a bug we currently have. It starts to matter the moment a wire layer puts KEM material outside the encrypted envelope, which is what server-blind rendezvous needs: an introduction has to be readable by something before a session exists to encrypt it.

The leak we _do_ have is coarser and better documented: the signaling operator still sees the normalized room capability, room membership, and timing. Fixed cells and a fixed cadence hide message length and send timing from a network observer. They do not hide who is in the room from the service that introduced them.

## The takeaway

SPQR asked: how do you advance a post-quantum ratchet when a KEM ciphertext is far too large for your message budget?

We asked the same question with a cell that is already 40× larger than the ciphertext, and found that the answer inverts. The hard part stops being _how to fit it_ and becomes _when to send it, how to persist before you do, and how to fail closed when you cannot_. Different constraint, different construction, same underlying goal: a ratchet that keeps healing against an adversary who eventually has a quantum computer.

Credit where it is due: the idea that a post-quantum ratchet should be _sparse_ rather than per-message is Signal's, and it is the insight that makes the whole thing tractable. What we built on top of it is ours, and so is the responsibility for the fact that nobody has proved it correct yet.
