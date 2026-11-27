# Recorded validation history

These are measurements of the named artifacts. They do not certify a later
SDK package, browser, native build, or production network. Raw browser reports
under `logs/` are local and ignored because captures can contain sensitive data.
The reproducible runners remain in `e2e/`; see [Browser testing](browser-testing.md).

## Public web release on November 27, 2026

The web app served SDK 0.15.0 with protocol-5 signaling. The canonical Linux SDK archive has SHA-256 `d2eb1fbc40a585da0144413a0da9bbf5b17a03536cd5f982e0c20d429078353b`. Rebuilding the site with those exact archive bytes reproduced the same 100-file distribution deployed before this article was added. [Website CI](https://github.com/p2party/p2party.com/actions/runs/45984358051) · [SDK CI](https://github.com/p2party/p2party-js/actions/runs/45984544053)

| Environment                                      | Exercise                                                                          | Observation                                                                                                                                                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public site, two fresh Chromium profiles         | Exchange a short random message and a 32 KiB file with ordinary ICE               | Both browsers selected a direct host/server-reflexive candidate pair. The receiver read the text back from storage and byte-compared the disk-backed file.                                                              |
| Public site, two further fresh Chromium profiles | Repeat text and 32 KiB file verification with relay-only ICE on both peers        | Both browsers reported relay/relay candidates and verified the same delivery checks.                                                                                                                                    |
| Local release harness                            | Drop a chunk during a 16 MiB receive and interrupt a 64 MiB send                  | The receiver verified the received bytes after reload. The 64 MiB resume also preserved the sender's identity key.                                                                                                      |
| Android native shell                             | Build for API 37, then exercise keyboard and status bar on an Android 16 emulator | Debug and unsigned release APKs built. Opening and dismissing the real keyboard changed the PIN viewport from 775.2 to 467.0 CSS pixels and back to 775.2. Android 17 permission and physical-device tests remain open. |

[Local browser report](https://github.com/p2party/p2party-js/blob/v0.15.0/docs/e2e/release-0.15.0.md) · [Native build record](native-builds.md)

## Mobile viewport and chat scroll regression — 2026-09-09

The pre-change chat fixture failed 40 of 104 Chromium checks. Async message
layout and browser scroll anchoring could leave the latest message outside the
visible list without removing its SDK record or DOM text. Switching rooms with
the same channel name also carried an unrelated reading position. A separate
WebKit case combined a PIN failure, pending transfers, a send error and a long
draft above a simulated keyboard; the message area collapsed to zero height.

The room shell and dialogs now share visual-viewport measurements, including
keyboard panning. The composer no longer adds a second keyboard margin; mobile
vertical padding is four pixels and the shell removes the home-indicator padding
when the keyboard covers that area. Draft growth is bounded by available height.
The toolbar occupies normal document flow within the shell, and status/error/
transfer content shares a bounded scrolling area instead of covering messages.

Chat keeps the live edge across async bubble growth and keyboard changes, while
preserving the visible message row when reading history through a width change.
Anchor lookup uses logarithmic row measurements. Room changes and sending move
to the current conversation; explicit scrolling, keyboard focus and text
selection can leave it. Correction of WebKit's post-layout scroll adjustment is
limited to a short window after resizing, rather than permanently forcing the
reader to the bottom.

The final `e2e/chat-scroll.mjs` matrix passed 540 checks: 180 each in Chromium,
Firefox and WebKit at widths 320, 360, 390, 430, 768, 1024 and 1440, plus 740×320
landscape. It includes 47/34-pixel simulated iPhone safe areas, intermediate
frames during keyboard shrink/pan/expansion with long drafts, visible message
geometry, exact history anchors, room/channel navigation, reload, sending,
focus and selected-text reveal, combined error/queue states, and reachable PIN
retry and transfer cancellation. There were zero uncaught page errors. Browser
Find coverage uses a matched range plus explicit reveal where the engine does
not scroll automatically; it does not automate browser chrome or VoiceOver.
Reports are `logs/chat-scroll/final-{chromium,firefox,webkit}.json`.

The production build, lint, formatting, SDK provenance, and 134 unit tests with
507 assertions passed. All 15 prerendered routes hydrated under the production
CSP without violations, page errors or external requests. A separate built-app
WebKit audit passed nine viewport configurations, and Chromium pinch scaling
returned to the original layout at portrait and landscape sizes. Native iOS
keyboard/IME behavior still requires physical-device validation; these local
measurements do not establish a universal absence of animation or flicker.

## Responsive dialogs and QR canvas permissions — 2026-09-09

These are local regression results for the responsive changes, not a deployment
record. `e2e/dialog-layout.mjs` uses production React, the real dialog components
and compiled site CSS. Its pre-change Chromium/Firefox baseline failed all 32
cases under controlled keyboard-overlay or viewport-pan geometry: final fields
and actions remained outside the visible area despite scrolling. At 320 pixels,
the Alert layout also produced a 356-pixel scroll width.

The shared dialog wrappers now use the application's visual-viewport geometry
for one scrolling area, keep tall panels from shrinking, reduce mobile padding,
wrap long text and action rows, and keep touch input text at least 16 pixels.
The final matrix passed all 48 cases in Chromium, Firefox and WebKit at widths
320, 360, 390, 430, 768, 1024 and 1440, plus an 844×390 landscape viewport.
It recorded 1,368 element geometry and hit-test checks with no clipped controls,
uncaught page errors or CSP violations. The matrix included 72 openings of the
actual Settings, PIN-join and QR dialogs, long unbroken signaling URLs, field
editing and primary-action clicks after keyboard geometry changes, scrolling
back to the title, dropdown selection, nested confirmations and focus return.
SDK and room-hook boundaries use synthetic local state; no room connection is
created by this fixture. The baseline and final reports are
`logs/dialog-layout/baseline.json` and `logs/dialog-layout/result.json`.

A follow-up matrix exercised nine actual dialog screens across the same three
engines and eight viewport sizes: 24 passing cases, 216 dialog openings and
1,080 additional geometry/hit-test checks. Alongside Settings, PIN-join and QR,
it covered advanced room setup with PIN and scheduled-cover controls, identity
backup options, identity restore with an invalid synthetic phrase, Address Book
and Blacklist tables containing 20 entries, and diagnostics containing 20 peers
and messages. Long contact names, signaling URLs and existing content stayed
within the dialog or their intended table scroll area; final actions remained
reachable after simulated keyboard movement. There were no clipped checks,
uncaught page errors or CSP violations. Identity creation/restoration and room
generation were not invoked. The report is
`logs/dialog-layout/actual-dialogs.json`.

The companion `e2e/room-qr.mjs` run passed 33 cases across the same three browser
engines. QR display now draws between canvases without extracting their pixels.
With canvas readback/export APIs deliberately blocked, the QR remains displayed;
an explicit download reports a copy-link fallback, and allowing export while
the dialog remains open permits retry. The suite also checks downloaded PNGs,
generation failure recovery and stale invitation/native-save completions.
Its report is `logs/room-qr/result.json`. This extends the earlier 22-case QR
regression recorded below; it does not weaken the site's CSP.

WebKit automation exercises that engine, not a physical Safari device. Keyboard
overlay and pan are controlled visual-viewport simulations; these results do
not establish behavior with a real iOS/Android keyboard, IME composition and
candidate windows, native browser chrome or physical pinch gestures. Canvas
permission restrictions and native filesystem completions are simulated API
boundaries, not automated operating-system/browser permission prompts or native
device writes. The reports remain local and ignored.

## Room QR dialog regression — 2026-09-09

A user report exposed a blank room-sharing QR code after the header rollout.
The earlier route and room-delivery checks did not open the sharing dialog.
The focused `e2e/room-qr.mjs` fixture reproduced eight blank canvases across
Chromium and Firefox, covering initially open/closed dialogs and reopening.
These failures occurred with zero CSP violations: generation read the canvas
ref before the dialog portal mounted and returned without retrying.

Generation now follows the mounted canvas. Downloads stay disabled until a QR
has rendered, rendering/export failures offer the copy-link fallback, and stale
async results are discarded when the invitation or dialog changes. The QR also
has a four-module clear margin. Both browsers passed all 22 focused cases,
including eight rendering observations and nonblank 1024×1024 PNG downloads
matching the displayed canvas. Native completion tests use a mocked filesystem
boundary and do not establish behavior on a device. PNG checks verify image
content and dimensions; automatic QR payload decoding and physical camera
scanning were not verified. The strict CSP remains unchanged. This isolates the
application bug; it does not identify the source of inline-script
warnings in a browser with an unknown extension configuration.

## Completed production Cloudflare rollout — 2026-09-09

Frontend tag `deploy-2026-09-09.2` was deployed with SDK 0.14.10 and signaling
server 0.1.4 (protocol 4). The public homepage, room, saved-room and new
release/research article HTML matched the tested local build byte-for-byte.
The decoded self-hosted WASM retained SHA-256
`7fc91b615f6ca7f7f61497b784c8e75102751cdc84251bcadcd688aaa17c4d76`,
with `application/wasm` and gzip encoding.

The reviewed Terraform apply created one Cloudflare response-header ruleset,
changed no other resources and destroyed none. A subsequent full Terraform plan
reported zero changes. The public frontend now returns the exact CSP,
Permissions-Policy, Referrer-Policy, HSTS and X-Content-Type-Options values in
[Deployment](deployment.md).

An independent production Chromium run checked all 15 routes and 66 distinct
same-origin page/asset responses with the actual edge headers. No headers were
injected and no responses were rewritten. All five header values matched;
there were no executable inline scripts, inline event handlers, failed resource
loads, CSP violations, uncaught page errors or console errors. Client navigation
from the homepage to the blog and then the new article passed. WebSockets were
blocked for this route-only check, and none were attempted.

A separate two-peer smoke exercised the real room flow under the live headers.
UI text crossed WebRTC, and a 40,000-byte file arrived byte-exact. Receiver reload
retained the file and restored message delivery in 1,239 ms. A second tab with
the same identity took over and remained stable for five seconds. This run had
zero CSP violations and uncaught page errors. Four handled transport console
errors occurred during reload/replacement, matching the earlier pre-header
smoke's count and message types; the check does not establish an exact cause
for every event. Test-room memberships were explicitly left and the browser
contexts closed.

Reports are `logs/deployment-check-2026-09-09/cloudflare-followup-readiness.json`,
`production-csp-hydration-result.json` and `post-headers-live-result.json` in
that same directory (local, ignored). The server repository retains the reviewed
apply and subsequent full-plan summaries. These are bounded observations of one
Chromium environment, not long-term reliability, load, mobile or forced-TURN
validation. They do not verify production database TLS configuration or establish
cryptographic security. Blind rendezvous, private invitation retrieval and
PoW/passkey admission remain experimental and outside the deployed room flow.

## Initial production smoke and CSP investigation — 2026-09-09

After the operator deployed SDK 0.14.10 and server 0.1.4, bounded public checks
confirmed the server's health/version/protocol, signature challenge, correlated
room snapshots, heartbeat, same-identity socket replacement and acknowledged
membership cleanup. TURN credentials were issued with the expected URLs and
expiry; relay connectivity and database TLS configuration were not established
by these public checks.

The deployed homepage matched the local release build. The six main non-home
routes returned their prerendered HTML, and the self-hosted WASM matched
`7fc91b615f6ca7f7f61497b784c8e75102751cdc84251bcadcd688aaa17c4d76`, with
`application/wasm`, gzip encoding and immutable caching. Two isolated Chromium
profiles exchanged text and a byte-exact 40,000-byte file through the actual UI
over WebRTC. Receiver reload retained the file and restored message delivery in
1,248 ms in this run. A same-identity second tab took over and remained stable
for a five-second observation. No uncaught page errors occurred. Four transport
console errors were observed around replacement/reload; guarded handling and
successful recovery were confirmed, without attributing every event to an exact
cause. This short smoke does not establish long-term or mobile reliability.

The frontend was missing the five response headers documented in
[Deployment](deployment.md); the signaling origin had its expected headers.
Applying the proposed CSP only in test-browser responses exposed inline React
boundary-repair scripts in the deployed room HTML: the browser blocked them and
reported hydration errors before recovering through client rendering. The
live CDN configuration was not changed by that compatibility test.

The follow-up frontend build uses React's static prerender API and keeps large
completed Suspense boundaries in place. It rejects script-bearing route markup
during the build. All 15 rebuilt pages passed `e2e/csp-hydration.mjs` under the
strict policy, with no inline executable scripts, uncaught errors, CSP violations
or external requests. This includes the new release/research article, client
navigation, and opening invitation consent without connecting. This corrected
build was subsequently released as `deploy-2026-09-09.2`; the completed rollout
and production checks are recorded above.

Raw reports are under `logs/deployment-check-2026-09-09/` and
`logs/csp-hydration/result.json` (local, ignored). These observations apply to
the versions, browser and paths named above; research protocols remain outside
the deployed room flow.

## Recorded acceptance for SDK 0.14.10 — 2026-09-09

The built site passed both live Chromium runners with SDK 0.14.10, actual
signaling server 0.1.4 (protocol 4), and isolated PostgreSQL. The exact vendored
archive SHA-256 is
`179188fa070445cc142bec08a0c5a192e33bad43c45684a755e6b67d70913d41`.
All 61 installed SDK files match this archive, and the self-hosted WASM matches
its packaged provenance. These are loopback measurements with synthetic data.

- UI messages traversed real WebRTC data channels. Remembered consent rejoined
  after reload in 907 ms; unattended signaling restart recovered in 3,060 ms.
- A second tab with the same identity authenticated in 711 ms. A wrong PIN
  stayed visibly failed for 120,812 ms over 120 samples, without creating more
  peer transports; correcting it through explicit retry delivered a message.
- A partially received 1 MiB file survived sender reload. Automatic and manual
  retries emitted fresh chunk frames. Cancellation remained usable across room
  navigation while retry was active, removing both the sender outbox and the
  receiver partial. No browser page errors were recorded.

The reports are `logs/desync/2026-09-09T09-21-14.784Z/result.json` and
`logs/desync/pending-ui-2026-09-09T09-23-56.589Z.json` (local, ignored).
Frontend validation also passed 134 unit tests / 458 assertions, lint,
TypeScript, client/SSR builds and 14-route prerender. The final dependency audit
reported zero known advisories. Offline upload tests verify gzip WASM bytes,
MIME/encoding, unchanged decoded integrity, and preserved deployment ordering.

## Recorded acceptance for SDK 0.14.9 — 2026-09-09

The recorded built site was checked with SDK 0.14.9, actual signaling server
0.1.3 (protocol 4), and the isolated PostgreSQL database on port 6543. The
vendored artifact has SHA-256
`61a719a28652704d1e6d599c9eed0cf394e1805d1a344e0e71320eb2423a917e`.
All 219 installed SDK library files matched the archive byte-for-byte, and
`provenance:check` confirmed its lockfile integrity and matching public WASM.

The strict pending-transfer browser run passed. Its report is
`logs/desync/pending-ui-2026-09-09T06-03-40.989Z.json` (local, ignored), which
records the artifact hash and the server's exact version. These are loopback
Chromium results with deliberate chunk-frame loss.

| Scenario                                 | Observed result                                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Reload during a real 1 MiB file send     | Receiver had 222,884 of 1,048,576 bytes; the pending panel retained the original transfer and root                                |
| Automatic retry after reload             | The same identities reauthenticated and a new sending attempt emitted chunk frames before settling as pending                     |
| Manual retry and room navigation         | The retry emitted new frames, stayed in the SDK's `sending` phase, and showed “Retrying…” after leaving and returning to the room |
| Cancel while the manual retry was active | Cancel remained enabled; the sender outbox and receiver partial were removed                                                      |
| Browser errors and WASM                  | No page errors; both peers fetched the versioned self-hosted 0.14.9 WASM successfully                                             |

The broader `desync-local-stack.mjs` run also passed on this same artifact and
server version. Its report is
`logs/desync/2026-09-09T06-30-31.903Z/result.json` (local, ignored), with the
owned server log beside it. It recorded no browser page errors.

| Scenario                                    | Observed result                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Connect and send through the UI             | Message delivered through the real RTC data channel                                                |
| Reload with remembered consent              | The same identity rejoined and exchanged a message in 890 ms                                       |
| Kill and restart the signaling process      | Both pages verified and rejoined in 3,547 ms without focus, clicks or reloads; UI delivery resumed |
| Second tab replacing the identity responder | Authenticated in 683 ms; another 10 seconds showed no competing socket opens                       |
| One-character-wrong PIN                     | Failure remained visible for 120,945 ms across 120 samples, with one peer transport per side       |
| Correct the PIN through the retry dialog    | Authenticated and delivered a UI message                                                           |

The Node 24 build (typecheck, client, SSR and prerender), lint, provenance and
116 unit tests with 410 assertions passed against this artifact. The component
browser check also passed all five cases, including active retry state across
the chat page's keyed room remount. Build, lint and unit logs are in
`logs/followups-site-{build,lint,tests}.log` (local, ignored).

## Recorded desync results — 2026-09-08

The desync-local-stack and room-hydration checks passed against the built site
with the vendored SDK 0.14.8
artifact with SHA-256
`631bdc04b1b3591b644d48a0d63d35d20bf60af7f1d6c817e869015e7bbbc076`,
actual signaling server 0.1.2
and an isolated PostgreSQL database on port 6543. The browser runner's report
is `logs/desync/2026-09-08T15-47-27.597Z/result.json` (local, ignored), with its
server log beside it. This is a loopback Chromium measurement.

| Scenario                                    | Result                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Connect and send through the UI             | Message delivered over a real RTC data channel                                                     |
| Reload with remembered consent              | Same identity rejoined and exchanged a message in 882 ms                                           |
| Kill and restart the signaling process      | Both pages verified and rejoined in 3,536 ms without focus, clicks or reloads; UI delivery resumed |
| Second tab replacing the identity responder | Authenticated in 886 ms; another 10 s showed no competing socket opens                             |
| One-character-wrong PIN                     | Failure stayed visible for 120.6 s across 120 samples, with exactly one peer transport per side    |
| Correct the PIN through the retry dialog    | Authenticated and delivered a UI message                                                           |
| Saved signaling and STUN preferences        | `/r` and `/rooms` hydrated and reloaded without errors or an unrequested signaling connection      |

The complete run had no browser page errors. Every context fetched the
self-hosted 0.14.8 WASM. Before the fixes, the old SDK/site pair failed the
responder replacement and created hundreds of competing signaling sockets;
wrong-PIN failure created replacement transports. The focused hydration check
also failed before the preference snapshot fix, on all four navigation/reload
cases. Clean offline `npm ci`, provenance, the site build, 116 unit tests with
410 assertions, typecheck and lint passed.

## What 0.14.6 added, and how it was checked here

`p2party-0.14.6.tgz` is the first vendored build that ships identity backup and
restore: `createRecoverableIdentity`, `restoreIdentityFromMnemonic`,
`getIdentityBackupStatus`, `validateMnemonicWords` and
`InvalidRecoveryPhraseError` are exported from the package root and declared in
`lib/index.d.ts`. `src/protocol/identityBackup.ts` is typed against those
declarations rather than against a local copy of them, so a rename in the
library is now a compile error here; the runtime check it wraps them in stays,
because a build could ship the declarations without the code.

The derivation is the SDK's existing one-way phrase derivation: the phrase,
plus an optional password as the salt, stretched by argon2id into an Ed25519
seed. It borrows the BIP-39 English wordlist and nothing else — different
checksum, different KDF — so **no BIP-39 wallet can restore one of these
identities**, which the vendored package's own README states at
`node_modules/p2party/README.md`.

**What was measured on the built site, and what was not.** One headless-Chromium
run drove `dist/` through a static server on `:5190` and the SDK repository's
Bun relay (`p2party-js/docs/e2e/desync/relay.ts`) on `:5811`, in three browser
contexts, entirely through the rendered UI — the menu, the dialog buttons, the
composer — and asserted, in order: the backup dialog reports this device's
identity as generated at random and therefore not exportable; creating a
recoverable identity yields 24 words and a new key that replaces the random one;
"Done" is disabled until the written-it-down checkbox is ticked; a second
context joins by invite link and the edge authenticates; a message goes
byte-exact each way; that context saves the first as a contact, pinning the key
just created; the first context is **closed entirely**; a fresh context, which
had no identity of its own, types the 24 words and is shown the same key; it
rejoins the room, exchanges a byte-exact message each way, and the peer's sender
menu still shows the saved contact with **no** "identity key changed" warning.
The restored device came back under the same peer id because this relay keys
peers by public key, exactly as the real server's `peer.upsert` does.

A separate network capture of a page minting an identity on the same build
recorded three 200s for `/vendor/p2party-0.14.6/libcrypto.wasm` and zero
requests to `cdn.p2party.com`, so the cryptography those steps ran on was the
self-hosted copy, accepted by the browser under the SDK's pinned SRI.

That is one run, on one machine, over loopback, with the same Chromium build on
both sides and a relay that mirrors the real signaling server's message flow
rather than being it. It is evidence that the flow works end to end. It is not
a measurement of the derivation's strength, and it does not exercise the
optional recovery password, whose wrong value silently restores a different
identity.

## What 0.14.5 added, and how it was checked here

`p2party-0.14.5.tgz` is the first vendored build that binds a peer edge to the
DTLS certificate it was authenticated against: when the remote certificate
changes, an authenticated transport is **replaced** rather than
re-authenticated in place. It also re-dials the room after a failure teardown
(but not after a deliberate disconnect), fails a send to a peer that never
authenticates inside a bounded wait instead of hanging, and adds a signaling
heartbeat watchdog that marks a half-open socket disconnected.

Checked, when 0.14.5 was the vendored build, by grepping the then-installed
bundle (`node_modules/p2party/lib/index.js`) against the one inside
`p2party-0.14.4.tgz`, since the build is minified and only literals survive:

| Evidence in the bundle                                              | 0.14.4 | 0.14.5  |
| ------------------------------------------------------------------- | ------ | ------- |
| `"reset-in-place"` (the replace-vs-rebind decision)                 | absent | present |
| `"Peer is not authenticated on this transport: ..."` (bounded send) | absent | present |
| `45e3` (`RATCHET_GATE_WAIT_TIMEOUT_MS`)                             | absent | present |
| `25e3` (`SIGNALING_HEARTBEAT_TIMEOUT_MS`)                           | absent | present |
| `["visibilitychange", ...]` wake-event list in the watchdog         | absent | present |

**What was measured on the built site, and what was not.** A two-browser
harness froze one page's whole Chromium process tree for 20 s with its UDP
host-candidate buffers flooded — a phone asleep with the radio off — and both
pages showed the peer again and exchanged a typed message about 2 s after the
wake. That run passes on the previously vendored 0.14.4 build too, because the
app's own reconnect-on-resume (`ChatLayout.tsx`) already covers it: it is
evidence that this build works end to end, **not** evidence for the transport
binding specifically. The isolating evidence for that is the SDK's own recorded
matrix in `p2party-js/docs/e2e/desync/`, not a run from this repository.

**Known follow-up, recorded and not claimed fixed.** In the SDK's matrix, the
one arm where a frozen identity responder carries an in-flight transfer
converges in about 37 s rather than the usual few seconds, because the
surviving transport's SCTP association accepts the new streams of one side but
not the other and recovery waits out the 30 s handshake step timeout. The
outcome is correct; the latency is not yet.
