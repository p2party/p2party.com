---
title: "Do the new discrete-log and lattice papers change P2Party’s security?"
slug: "ai-math-and-p2party-keys"
description: "A November 2026 review of what the papers establish and which assumptions protect rooms, relay receipts and wallet signatures."
author: "P2Party"
date: "2026-11-27"
series: "Road to protocol-v3"
seriesOrder: 11
status: "published"
commitAnchors: []
tags: ["cryptography", "research", "ML-KEM", "Ed25519"]
---

**27 November 2026.** We found no demonstrated recovery of a P2Party production key or practical forgery at our deployed parameters in the papers reviewed below. Several papers do change the asymptotic picture. A smaller exponent at very large input sizes does not by itself give an attacker a feasible computation against a particular key today. This review covers known public results and selected implementation checks. Independent cryptographic and infrastructure review remains open.

## Three results worth distinguishing

Google Research’s Cogentic manuscript studies discrete logarithms in the multiplicative group of finite fields as the extension degree grows and the characteristic stays fixed. Its reported improved running time applies to that family. Ed25519 signatures and X25519 key agreement use elliptic-curve groups. Applying the Google result directly to either operation would change the mathematical problem. [\[1, Thm. 1.2\]][m1] [\[2, §5\]][m2] [\[3, §5.1\]][m3]

Akshima and colleagues do study elliptic-curve discrete logarithms. Their October paper, developed with AI assistance, derives a conditional subexponential algorithm for prime-order curves over prime fields and discusses fixed cofactors. The authors explicitly distinguish their asymptotic result from a concrete improvement for curves such as Ed25519. A November preprint by Liu, Zhang and Ren reports a related deterministic result under a tensor-contraction assumption. We found no production-size key recovery or concrete cost that would justify retiring Curve25519 on the strength of these results alone. [\[4, p. 2\]][m4] [\[5, abstract\]][m5]

The 21 November structured-LWE manuscript credits ChatGPT and prompting by Nigel Smart. Its starting example uses a power-of-two modulus, binary secrets and a particular bounded error distribution. It discusses extensions under further hypotheses. The paper conditions its running time on a tensor-contraction result and gives no concrete crossover for deployed parameter sets. P2Party’s default ML-KEM-768 uses a degree-256 module over modulus 3329 with rank three and centered-binomial sampling. ML-DSA-65 is a signature construction with modulus 8380417 and additional short-vector assumptions. A result for one LWE distribution does not automatically supply key recovery for the KEM or a signature forgery. [\[6, §§1.1, 5.1, 7\]][m6] [\[7, Table 2\]][m7] [\[8, Table 1\]][m8]

## What each component trusts

| Component                | What an affected assumption would put at risk                                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Room session             | X25519 and the room-selected ML-KEM contribute to the session secret. Ed25519 authenticates peer identities. A practical Ed25519 forgery would threaten peer authentication even if ML-KEM still hid the shared secret.                                                      |
| Volunteer relay pilot    | Providers sign price quotes with ML-DSA-65. The receiving browser and each relay sign delivery observations with Ed25519. Trust in those observations includes the classical signature and the honesty of the participants.                                                  |
| Native currency          | A unit commits to one selected spending suite. Public Testnet 1 accepts ML-DSA-65 and the hash-based SLH-DSA-SHA2-192s. Selecting SLH-DSA gives a wallet an independently based spending signature. Its protection starts when a unit is actually received under that suite. |
| Receipt and state proofs | SHA-512 binds the committed data. A wallet also trusts its genesis, committee, checkpoint freshness and quorum policy. A valid hash path cannot make a dishonest sole operator independent.                                                                                  |
| Network infrastructure   | HTTPS, WebRTC and the management VPN have their own negotiated algorithms, authentication and software updates. The ledger’s choice of spending signature does not change any of them.                                                                                       |

The higher-parameter ML-DSA and SHAKE-based SLH-DSA options are available in a local research policy. Increasing the size of a lattice key keeps the same broad family of assumptions. Hash-based SLH-DSA provides signature diversity and cannot replace a room’s key-exchange mechanism. [\[9, Table 2\]][m9] · [Room protocol](/protocol) · [Wallet guide](/wallet)

## Checks on the released software and network

The SDK 0.15.1 build record pins mlkem-native v2.1.0 and a libsodium 1.0.22-stable snapshot. The native verifier has its own build record and distribution patches. We checked these records and NIST’s posted corrections to FIPS 203 and 204. Test vectors, dependency checks and the wallet restore exercise establish implementation behavior under specific conditions. They cannot prove a mathematical assumption or rule out an undisclosed vulnerability. [SDK build provenance](https://github.com/p2party/p2party-js/blob/v0.15.1/src/cryptography/libcrypto.provenance.json) · [Native release build](https://github.com/p2party/libdemos/actions/runs/45985760486) · [NIST updates for FIPS 203](https://csrc.nist.gov/pubs/fips/203/final) · [NIST updates for FIPS 204](https://csrc.nist.gov/pubs/fips/204/final)

On 27 November, a certificate-validating TLS client negotiated hybrid X25519MLKEM768 with the website and signaling endpoint, and classical P-256 key exchange with TURN. All three connections used classical ECDSA P-256 authentication. This samples those connections only. The configured static website origin supports HTTP only. Verifying HTTPS at the public edge leaves the upstream content-delivery hop unresolved. The balance form on p2party.com accepts public read handles. The separate HTTPS restore application opens the encrypted file in the browser. For local signing, compare the downloaded wallet archive with the checksum in the separately published repository. [S3 website endpoint capabilities](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteEndpoints.html) · [Versioned wallet checksum](https://github.com/p2party/p2party-js/blob/baa723d/docs/testnet-1.md#install-the-wallet-client)

## What would change the decision

A concrete cost for the actual group or module, secret and noise distributions, working memory and success probability would trigger a new review. Independent reproduction at relevant parameters or actionable guidance from the standards body or implementation maintainers would change operational decisions faster than the authorship of a paper.

For a still-trustworthy spending suite, a wallet can transfer an unspent unit to a fresh commitment using another enabled suite. Once an old signature can be forged at practical cost, the ledger cannot reliably distinguish the owner’s migration from a forged one. A network response in that case needs a coordinated checkpoint and a publicly reviewed migration policy. Peer authentication, operator keys and transport authentication each need their own transition. Testnet 1 has one public operator, its units have no monetary value, and admission of a funded mainnet remains open. [Whitepaper](/whitepaper) · [Roadmap](/roadmap)

## References

1. Cogentic (Gemini 4), Google Research. “Discrete Logarithms in Finite Fields of Fixed Characteristic in Sub-Quasi-Polynomial Time.” Research manuscript released 25 November 2026. Attribution on p. 1, Theorem 1.2 in §1.1, proof in §6.3. [Full text][m1]
2. A. Langley, M. Hamburg and S. Turner. _Elliptic Curves for Security._ IRTF RFC 7748, January 2016. DOI 10.17487/RFC7748. [Full text][m2]
3. S. Josefsson and I. Liusvaara. _Edwards-Curve Digital Signature Algorithm (EdDSA)._ IRTF RFC 8032, January 2017. DOI 10.17487/RFC8032. [Full text][m3]
4. Akshima, R. Bacho, Y.-H. Huang, E. Kiltz, A. Nishaburi, S. Nooripoor, N. Tittelbach and E. Wiedijk. “A Subexponential Time Algorithm for Elliptic Curve Discrete Logarithm.” Authors’ preprint, v0.2, 29 October 2026. Theorem 1 and limitations on p. 2, AI assistance disclosure on p. 19. [Full text][m4]
5. S. Liu, B. Zhang and K. Ren. “A Deterministic Subexponential-time Algorithm for the Discrete Logarithm Problem.” _Cryptology ePrint Archive_, Paper 2026/3020. Received 24 November 2026, posted 27 November 2026. Cited for the result stated in the abstract. [Archive record][m5]
6. ChatGPT, with prompting by Nigel Paul Smart (title-page attribution). “Conditional Subexponential Attacks on Structured Learning with Errors: Tensor Encodings, Noise Distributions, and Comparisons with Lattice Reduction.” Author-hosted manuscript, 21 November 2026. Theorem 5.1 on p. 17 and concrete limitations on p. 28. [Full text][m6]
7. National Institute of Standards and Technology. _Module-Lattice-Based Key-Encapsulation Mechanism Standard._ FIPS 203, August 2024, §8, Table 2, p. 39. [Full text][m7]
8. National Institute of Standards and Technology. _Module-Lattice-Based Digital Signature Standard._ FIPS 204, August 2024, §4, Table 1, p. 15. [Full text][m8]
9. National Institute of Standards and Technology. _Stateless Hash-Based Digital Signature Standard._ FIPS 205, August 2024, §11, Table 2, p. 43. [Full text][m9]

[m1]: https://github.com/google-research/google-research/blob/4a7bc8ab0bc770e71a259b7966c500496b99010a/cogentic_research_papers/discrete_logarithm/paper.pdf
[m2]: https://www.rfc-editor.org/rfc/rfc7748#section-5
[m3]: https://www.rfc-editor.org/rfc/rfc8032#section-5.1
[m4]: https://github.com/bochum-crypto/subexponential-ecdl/blob/1ee44e562b1b9a50ea339f3b8f81112b5a24b96f/subexponential-ecdl.pdf
[m5]: https://eprint.iacr.org/2026/3020
[m6]: https://nigelsmart.github.io/Sub-Exp-LWE/main.pdf
[m7]: https://doi.org/10.6028/NIST.FIPS.203
[m8]: https://doi.org/10.6028/NIST.FIPS.204
[m9]: https://doi.org/10.6028/NIST.FIPS.205
