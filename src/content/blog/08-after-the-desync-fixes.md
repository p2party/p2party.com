---
title: "After the desync fixes: the path to blind rendezvous"
slug: "after-the-desync-fixes"
description: "What SDK 0.14.10 and server 0.1.4 ship, what the one-server experiments show, and the privacy and efficiency work still ahead."
author: "Dimitris Karoukis"
date: "2026-09-09"
series: "Road to protocol-v3"
seriesOrder: 8
status: "published"
storyPeriod: "2026-09-08 to 2026-09-09"
commitAnchors: []
tags:
  - "WebRTC"
  - "reliability"
  - "blind rendezvous"
  - "private invitations"
  - "research"
---

The September web release uses SDK **0.14.10** and signaling server **0.1.4**,
speaking protocol v4. The desynchronization fixes, transfer recovery and server
resource limits are in that release. Blind rendezvous, private invitation
retrieval, proof of work and optional passkeys remain separate experiments.

The distinction matters to anyone opening a room today: the signaling service
still learns which identity keys join the same room and when they connect. An
invitation's URL fragment keeps the capability out of the initial page request;
joining subsequently sends it to the signaling service. Encrypted messages do
not conceal those relationships.

## What the release changes

Reloading a sender or restarting signaling should no longer leave a room looking
connected while messages go nowhere. Reconnection repairs missing peer edges,
and a second tab using the same identity can replace the responder without
creating competing signaling sockets. Authentication failures have a different
outcome: a wrong PIN stays visibly failed until the user explicitly retries.

Prepared pending transfers survive sender reload for up to 24 hours. Automatic
and manual retries can send missing chunks. Retry state survives room navigation,
and cancellation removes the sender's retained transfer and the receiver's
partial, including when a retry is active. Preparation must finish before a
payload is recoverable.

The release was checked with real WebRTC, the actual server and disposable
PostgreSQL in local Chromium runs. Reload recovery took 907 ms, signaling restart
recovery 3,060 ms and same-identity tab replacement 711 ms in the recorded run. A
wrong PIN remained failed for over two minutes without transport churn. A
partially received 1 MiB file exercised reload, fresh retry frames, navigation
and cancellation. These observations validate those scenarios; they are not
recovery deadlines for the internet or every mobile browser. The web release
does not complete the separate native Capacitor migration.

Server 0.1.4 creates durable identity records only after a valid signature and
limits connections, messages, new identities and room membership. Empty rooms
can be pruned after 24 hours without deleting occupied rooms or stable identity
records. Database TLS verifies the certificate and expected host. The supported
deployment uses one signaling worker; the experimental multi-worker path does
not provide the same global admission guarantees. These are concrete resource
and authentication controls, not proof that each key represents a different
person. Limits depend on operator configuration, and clients behind a shared
network address share its address budget.

We also removed unnecessary dependency trees, replaced general validation
libraries where only UUID and hexadecimal checks were needed, and disabled
Redux DevTools access to the SDK's secret-bearing state. External message links
accept explicit HTTP or HTTPS URLs and open without an opener or referrer. The
SDK archive shrank from 869,854 to 735,691 bytes, a 15.4% reduction, largely by
removing unreachable declarations. That package-size saving is separate from
browser transfer: WASM is now served gzip-compressed, and its decoded bytes still
match the SDK's integrity pin.

The [SDK release](https://github.com/p2party/p2party-js/tree/v0.14.10) provides
the published library source; the [privacy policy](/privacy-policy) describes the
deployed service's data handling. The frontend acceptance measurements above
were recorded against that exact SDK artifact. Passing tests and dependency
audits does not replace an independent security review.

## Blind rendezvous has runnable prototypes

The research goal is to let peers discover each other without handing the store
a room directory. Clients with a shared capability publish padded encrypted
operations, download public batches and select relevant operations locally.
Pair-encrypted signaling then bootstraps WebRTC. This store protocol is separate
from the production signaling server.

Both one-store and two-store prototypes have run with real Chromium clients.
The one-store experiments completed authenticated, byte-exact exchanges in both
directions. A second store provides another possible delivery path if one stops
responding; one store cannot deliver through complete withholding by its sole
operator. Neither configuration hides source addresses or automatically proves
that timing, retries and later WebRTC traffic reveal no relationships.

A local diagnostic also confirmed a limit of the current carrier encryption:
someone who later obtains the room capability can reopen archived outer
operations such as presence. That does not by itself decrypt separately protected
pair signaling or application messages. Client-code authenticity is another
assumption: a store operator that can replace the browser application's JavaScript
can steal its secrets regardless of the retrieval protocol.

An eight-browser pilot ran four unrelated pairs at once. Its baseline completed
32 of 32 pair exchanges; a separate repair comparison completed 30 of 32. A
later handshake-race fix passed a smaller follow-up, but the larger comparison
still needs a fresh run. The small held-out timing classifier did not establish
a relationship attack. That negative result is not a privacy proof, especially
without a demonstrated browser/store attack as a positive control.

Bandwidth remains a substantial cost. At a one-second window, that pilot
recorded about 4.98 decimal GB of response bodies per continuously participating
client-hour, including startup traffic and excluding network headers. That is
a local prototype profile, not the deployed application's idle traffic. A
useful design must measure sustained bytes, latency, memory and device cost
together.

## A less-than-linear invitation lookup, with the setup counted

Here, **n is the number of stored invitation records**. A separate native pilot
adapted the existing [Piano private-information-retrieval construction](https://eprint.iacr.org/2023/452).
At 1,024, 16,384 and 262,144 records, a warm query read 16, 64 and 256 records
respectively at the server and returned one 1 KiB record. For the tested
parameters, that is square-root online record work.

The largest database still required a full **256 MiB initialization download**
and about **75.2 MiB of retained client arrays**, before maps and runtime
overhead. The setup and database-loading work remain at least linear. Full
download followed by local lookup already needs no further network traffic for
an unchanged snapshot, at the cost of retaining the entire database. The pilot
does not establish smaller total downloads than that control.

This is an implementation of prior work with a measured online cost, not a new
PIR construction or a sublinear first invitation. It ran natively, not as browser
PIR, and did not integrate admission or room joining. Browser execution,
malicious answers, hint refresh, query exhaustion and changing databases still
need evaluation as one complete flow.

Merkle trees exposed a second accounting trap. In the pilot's layout every
record contains its proof. Changing one invitation therefore changes every
serialized record's proof or envelope: **all n records**, despite the canonical
tree needing only a logarithmic number of changed ancestors. A local model
compares this with independently authenticated records that update only selected
rows. That changes the integrity guarantee: it no longer binds everyone to one
global snapshot. Sparse-update timings and an integrated private-update path
are unfinished.

The invitation work also considers recipient-bound authorization and delegation
ideas from [Publicly verifiable delegative democracy with secret voting power](https://arxiv.org/abs/2302.14421).
Merkle commitments can authenticate an invitation set; Shamir sharing could split
an activation or recovery secret among independent holders. Those are separate
authorization and custody tools. They do not hide a direct request for a known
invitation, and storing enough shares with one operator gives that operator the
secret.

## Proof of work with optional passkeys

Another local browser prototype earns a limited store allocation budget through
proof of work. Work runs in a cancellable Worker with a deadline; the server
verifies it and persists the grant. Tests check that token rotation, exact retries,
passkey recovery and restart do not create extra quota. Passkeys are optional
and recover the existing funded grant; registering one does not create credit.

At the demonstrator's default difficulty, three desktop trials took
0.432–4.146 seconds to solve, with verification plus durable grant creation under
1 ms. Three samples do not calibrate mobile cost or resistance to faster
hardware. Multiple paid grants can still occupy the prototype's entire capacity.
This closes free quota multiplication; it does not exclude all Sybils, guarantee
an honest anonymity population, or identify unique humans.

The current grant links its reservations, including after passkey recovery.
The next admission step explores anonymous allocation tickets that conserve the
paid budget while removing the stable grant from redemption messages. Preliminary
ticket modules and a cryptographic primitive round trip exist, but they are not
connected to the admission flow. Issuance and redemption timing, network origin,
selective failures and recovery can still create links. Combining this with PIR
and rendezvous is unfinished work, not an inherited privacy guarantee.

## What we want to demonstrate for FOSDEM 2027

The aim is a reproducible browser systems result: what one untrusted rendezvous
store can observe, which leaks survive practical defenses, and what those
defenses cost. One server by itself is not a novelty claim, and a major new
cryptographic finding has not been established.

The next steps are:

1. Repeat the multi-client baseline after the handshake fix, retaining failures
   and measuring browser suspension, store faults and real STUN/TURN paths.
2. Compare full download and private invitation retrieval in a browser, charging
   initialization, retained state, updates, retries and sustained traffic.
3. Integrate budget-conserving tickets with fixed participation schedules and
   optional passkey recovery, then test the combined observer-visible behavior.
4. Publish the reproducible research bundle and attack methodology, obtain
   external review, and submit only demonstrated results and explicit limits.

The research measurements above were recorded locally on September 8, 2026;
the complete experiment bundle is not yet part of the public release. The
frontend offers no blind-rendezvous, PIR, proof-of-work or passkey mode today.
The shipped room flow remains the baseline against which that work is judged.
