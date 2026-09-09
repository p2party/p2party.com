---
title: "An open channel is not a live peer: the phone that slept through its own disconnection"
slug: "an-open-channel-is-not-a-live-peer"
description: "A phone asleep with its radio off came back holding half a connection while the other side held a fresh one. Binding every peer edge to the DTLS certificate it was authenticated against, and the SIGSTOP harness that had to agree before any of this was written down."
author: "Dimitris Karoukis"
date: "2026-09-02"
series: "Road to protocol-v3"
seriesOrder: 7
status: "published"
storyPeriod: "2026-08-28 to 2026-09-02"
commitAnchors:
  - "4432feb"
  - "a923f64"
  - "2f763cd"
  - "8f7dbd0"
  - "d2e52e3"
  - "e6ecddd"
tags:
  - "WebRTC"
  - "DTLS"
  - "reliability"
  - "reconnect"
---

> **September 9, 2026:** SDK 0.14.10 and server 0.1.4 include the subsequent fixes
> for reload, signaling restart, same-identity tabs, persistent wrong-PIN failure,
> and pending-transfer retry/cancel. See the [current release and research update](/blog/after-the-desync-fixes)
> for validation and the separate blind-rendezvous work. This article retains the
> earlier investigation's scope.

The [protocol-v4 security boundary](https://github.com/p2party/p2party-js/blob/master/docs/protocol-v4-security.md) opens with a list of three things that are easy to mistake for each other: a data channel becoming `open`, the handshake completing, and a receipt arriving. Only the second one means there is a peer on the other end who has proven anything.

That distinction was written down a while ago. This release is what it cost to actually honour it.

## The bug, as a user sees it

Put a phone in your pocket. The screen goes off, the page is frozen, the radio is powered down. Nothing on the phone gets told about any of this. The WebSocket to the signaling server does not fire `close`, because there is no packet to trigger it; the TCP stack finds out minutes later, if at all. The peer connection is in exactly the same state.

Meanwhile the other side, a laptop, awake, on Wi-Fi, sees its edge fail, tears it down, and dials again. It builds a new `RTCPeerConnection`, which mints a new DTLS certificate, and offers it.

Now take the phone out of your pocket. It has an authenticated session. Transcript, ratchet, message keys, all of them proven against a certificate that no longer exists on the other end. The browser is happy to accept the new remote description and re-run DTLS on the old peer connection. Everything looks connected. Nothing decrypts.

The room shows two people in it and no way to talk.

## What was actually wrong

Not the crypto. The crypto was doing its job: keys proven against one transport refused to authenticate frames from another. The mistake was upstream of that, in what the SDK considered "the same edge".

A peer edge was identified by room and peer. A new remote description for that pair was treated as an update to a live session. But a fresh `RTCPeerConnection` means a fresh DTLS certificate, and the handshake transcript binds both endpoint fingerprints. A different fingerprint is not the same edge wearing new clothes. It is a different edge with the same name.

So the edge is now bound to the certificate it was authenticated against. `detectRemoteTransportChange` compares the `a=fingerprint:sha-256` line of the incoming SDP against the one already applied. If they differ and this side holds anything proven under the old one, the whole authenticated edge is torn down and rebuilt: ratchet wiped, PQ healing state destroyed, cover schedule stopped, gate reset, handshake re-run. A stale transport gets replaced, not re-authenticated in place.

## The things that fall out of that

Fixing the identity of an edge exposed four smaller lies of the same family, each of which had been surviving on the assumption that a connection which had not reported an error was working.

**Every failure teardown now re-dials.** Some teardown paths ended by removing the edge and stopping, which is correct only if something else is going to reconnect. Nothing was.

**A send whose peer never authenticates fails.** It used to wait, indefinitely, for a handshake that no longer had a transport to complete on. It now returns an error naming the reason, which the app puts on the message where you sent it.

**The signaling socket has a wall-clock watchdog.** The server pings every 10 seconds and closes a socket that misses a pong by 5. The client had no equivalent, so a half-open socket stayed "connected" in the UI for as long as the operating system took to notice. The watchdog checks on an interval and, more usefully, immediately on `visibilitychange`, `pageshow`, `online` and `focus`, because timers are throttled while a page is hidden, and the first useful moment to notice a dead socket is the moment the page wakes up.

**The app reconnects on the same four events.** Coming back to the tab, restoring it from the back/forward cache, and the network returning are all now reconnect triggers, deferred by one macrotask so the watchdog's verdict lands first.

## Why we believe it

A bug that only appears when a phone's radio is off is not a bug you fix by reasoning about it.

The harness runs two headless Chromium instances in a real room. It floods one instance's UDP buffers, `SIGSTOP`s the process, waits long enough for the other side to give up and rebuild its edge, then `SIGCONT`s it. That is as close as a laptop gets to being a phone that has been in a pocket for two minutes. It then asserts the thing a user would assert: both sides converge, and a message sent after the wake arrives.

It reproduced the desync before the change and does not after it. That is the entire claim, and it is a claim about two headless browsers on one machine, not about every phone, network and NAT in the world.

## What this is not

This is a reliability fix. It is not a privacy property, and it does not move the boundary in any direction.

The signaling operator still sees the room hash, which identity keys are members of it, and when they connect. This work adds a little to that, because an edge that re-dials is an edge the operator watches re-dial. Scheduled cover is still timing cover measured over loopback. There has still been no independent audit.

What changed is narrower and, if you have ever watched a room go quiet for no reason, more immediately useful: the software now agrees with the other side about whether you are connected.
