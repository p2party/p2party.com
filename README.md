# p2party.com

The reference client for [p2party](https://p2party.com): a React 19 + Vite
single-page app that is prerendered to static HTML, deployed to an
S3-compatible bucket, and wrapped by Capacitor for Android and iOS.

Peers who open the same room connect to each other over WebRTC and exchange
messages and files directly. This repository contains **none** of that
protocol. It integrates it:

| Repository                                                    | What lives there                                                                         |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **this one**                                                  | UI, routing, room/invite plumbing, prerender + deploy pipeline, native shells            |
| [`p2party-js`](https://github.com/p2party/p2party-js)         | the protocol: handshake, ratchet, WebRTC mesh, chunking, storage — consumed as a tarball |
| [`p2party-server`](https://github.com/p2party/p2party-server) | the signaling service that introduces peers (Bun + PostgreSQL)                           |

The retro two-column / hacker visual identity is deliberate. It is a reference
integration, not a generic component library, and not a design system.

Licensed [AGPL-3.0-only](LICENSE.md).

---

## Quick start

```bash
npm ci
npm run dev
```

`npm run dev` is `vite --host` on port 3000 (`vite.config.ts`, `server.port`).

The app ships with `wss://signaling.p2party.com/ws` and
`stun:stun.p2party.com:3478` as defaults (`src/hooks/useRoom.tsx`,
`DEFAULT_SIGNALING_URL` / `DEFAULT_STUN_URLS`). Both are editable in room
settings, so pointing at a local signaling service needs no source change.

Toolchain: `engines` requires Node >= 22.22.0 and npm >= 11.6.2; CI
(`.github/workflows/ci.yml`) pins Node 24.11.1, npm 11.6.2, and Bun 1.3.14.
Bun is the test runtime only — npm and `package-lock.json` remain the
authoritative resolver and lock.

---

## How the SDK is vendored

`package.json` depends on an immutable local tarball, not a registry range:

```text
"p2party": "file:vendor/p2party-0.14.4.tgz"      // package.json, dependencies
```

Four things to know: what that pins, how the WebAssembly module is served, the
script that enforces both, and how to replace the artifact. None of it rests on
convention — `npm run provenance:check` fails the build otherwise.

### 1. The bytes are pinned

`vendor/p2party-0.14.4.tgz` is committed. `package-lock.json` records its
SHA-512, so `npm ci` from a clean clone installs exactly those bytes, with
nothing about the SDK resolved over the network. (The other dependencies are
ordinary registry packages and are still fetched.)

A public branch must never point the dependency at a sibling checkout
(`file:../p2party-js/...`). Paired local development may do it temporarily,
but `provenance:check` then **always fails**, locally as well as in CI —
`CI=true` only changes which message you get first. With the lockfile
untouched it dies on `package-lock.json resolves a different p2party artifact`;
after `npm install` refreshes the lockfile it dies on `p2party dependency must
be the version-matched artifact file:vendor/p2party-<version>.tgz`. So run
`provenance:check` _after_ re-vendoring, not while pointing at a sibling tree.

### 2. The WASM is self-hosted, and still SRI-checked

The SDK's cryptography is a WebAssembly module. Its default source is
`https://cdn.p2party.com/@0.14.4/libcrypto.wasm`. `src/protocol/sdk.ts` — the
only module that may `import "p2party"` directly — calls `setWasmSourceUrl()`
to redirect it to `/vendor/p2party-0.14.4/libcrypto.wasm`
(`src/protocol/wasm.ts`), a copy committed under `public/`.

Redirecting the source does not weaken the integrity check. The SDK fetches
that URL with `{ integrity: "sha384-5bfyPJcX2JVKEJA8MK+YuBYDFu6VMg8Jphdt30CQBqHI8NIQSMwP1advvY5iuzXE" }`,
a hash pinned when the SDK was built, so the browser rejects any bytes that do
not match — from the CDN or from us. (Verified by reading the built bundle:
`node_modules/p2party/lib/index.js` holds both the default URL and the
`integrity` option passed to `fetch`.)

The one exception is `/session-lab`. The store-free `p2party/session` entry
does not share the root module's loader state, so `src/pages/session-lab.tsx`
fetches the same file itself and hands the bytes over as `wasmBinary`. That
path skips the browser's SRI check; what ties those bytes to the release is
`provenance:check` below.

Self-hosting exists because the app must work against an SDK version that has
not been published to the CDN yet, and because a first-party origin is one
fewer third party in the load path.

### 3. `npm run provenance:check`

`scripts/verifyLocalDependency.mjs` verifies the whole chain as one unit:

- the dependency is a `file:` artifact **inside** this repository;
- `package-lock.json` resolves that exact path, and the tarball's SHA-512
  matches the lockfile's `integrity`;
- the dependency filename, the lockfile version, and the version inside
  `package/package.json` in the tarball all agree;
- `package/lib/libcrypto.provenance.json` matches the packed WASM's size and
  SHA-256;
- `SELF_HOSTED_WASM_PATH` occurs exactly once in `src/protocol/wasm.ts` and
  equals `/vendor/p2party-<version>/libcrypto.wasm`;
- `public/vendor/p2party-<version>/libcrypto.wasm` is **byte-identical** to the
  WASM inside the tarball.

It prints the two hashes a release record needs. Run here:

```text
$ npm run provenance:check
p2party artifact SHA-256: 64819b97bc72652c51c473b41c7f922f6728bb08b8a0e861770a0d071fae0680
p2party WASM SHA-256: 8e1ef6a853be326dbc41cb42dde4d7ebe9042ec2550cedadd1e02a757c01b91e
```

CI runs it **before** `npm ci`, so a broken vendoring fails the build before a
single package is installed.

### 4. Re-vendoring a new SDK build

Everything below belongs in one commit. A release is incomplete until the
tarball, the lockfile, the dependency string, the public WASM, and
`wasm.ts` all name the same version.

```bash
# 1. In the SDK checkout: build the reproducible release tarball.
#    It writes p2party-<version>.tgz at the SDK repo root and prints its
#    SHA-256 / SHA-512 (scripts/buildRelease.mjs).
cd ../p2party-js && npm run release:pack

# 2. Back here: vendor the tarball.
cd ../p2party.com
cp ../p2party-js/p2party-<version>.tgz vendor/

# 3. Point the dependency at it and refresh the lockfile.
npm pkg set dependencies.p2party="file:vendor/p2party-<version>.tgz"
npm install

# 4. Self-host the exact WASM the tarball carries.
mkdir -p public/vendor/p2party-<version>
tar -xzOf vendor/p2party-<version>.tgz package/lib/libcrypto.wasm \
  > public/vendor/p2party-<version>/libcrypto.wasm

# 5. Update SELF_HOSTED_WASM_PATH in src/protocol/wasm.ts to
#    /vendor/p2party-<version>/libcrypto.wasm

# 6. Prove the chain, then rebuild from clean.
npm run provenance:check
npm ci && npm test && npm run build

# 7. Delete the previous vendor/*.tgz and public/vendor/p2party-<old>/.
```

Step 4's `tar` invocation was run against the current release: the extracted
bytes are byte-identical to the committed
`public/vendor/p2party-0.14.4/libcrypto.wasm` (both SHA-256
`8e1ef6a8…7c01b91e`).

Never replace a published artifact while keeping its version number.

---

## Scripts

Every entry is from `package.json`.

| Command                    | What it does                                                   |
| -------------------------- | -------------------------------------------------------------- |
| `npm run dev`              | `vite --host`, port 3000                                       |
| `npm run build`            | `typecheck` → `build:client` → `build:server` → `prerender`    |
| `npm run typecheck`        | `tsc -b --pretty false`                                        |
| `npm run lint:check`       | `eslint . --ext .ts,.tsx --max-warnings 0`                     |
| `npm run format:check`     | Prettier over the tree (`android/`, `ios/` excluded)           |
| `npm test`                 | `bun test` — the unit suite in `tests/`                        |
| `npm run provenance:check` | the SDK vendoring chain (above)                                |
| `npm run preview`          | `vite preview` over `dist/`                                    |
| `npm run e2e`              | `node e2e/run.mjs` — the two-peer real-WebRTC harness          |
| `npm run upload`           | build, then `scripts/uploadAllToS3.mjs` with `--env-file=.env` |

Ran in this tree while writing this file: `provenance:check` (output above),
`typecheck` (clean), `lint:check` (clean), `npm test` (**37 pass, 0 fail, 159
`expect()` calls, 6 files, 842 ms**), and `npm run build` (output below).
`npm run e2e` and the other `e2e/` harnesses were not run here — they need a
protocol-v4 signaling service, and two of them need packet capture; their
commands are quoted from the scripts themselves.

---

## Repository map

```text
src/
  pages/            one file per route: home, chat, rooms, session-lab, blog,
                    blog-post, privacy, tos (+ registry.ts, the lazy route table)
  routes.tsx        the single route table, shared by StaticRouter (build) and
                    BrowserRouter (client) — a divergence is a hydration mismatch
  entry-server.tsx  renderToPipeableStream entry used by the prerenderer
  main.tsx          hydrateRoot entry
  protocol/         the integration boundary with the SDK:
    sdk.ts            the only direct `import "p2party"`; configures the WASM source
    wasm.ts           SELF_HOSTED_WASM_PATH + the session-lab WASM fetch
    v4.ts             room policies, ML-KEM suites, scheduled-cover presets
    roomAccess.ts     transient PIN/policy vault, keyed by normalized capability
    delivery.ts       what a send's per-peer outcome means
    safetyNumber.ts   identity fingerprint rendering
    universalLink.ts  which https://p2party.com/r#... links the native app claims
  hooks/            useRoom (SDK ↔ Redux), useRoomInvite, useUniversalLink
  components/       Tailwind UI kit + custom/ (ChatLayout, CoverStatusPill,
                    HandshakeStatusBanner, MessageBubble, HeroDemo, …)
  content/blog/     the field-notes series (markdown + index.json manifest)
tests/            bun unit tests
e2e/              headless-Chromium harnesses over real WebRTC
scripts/          verifyLocalDependency, prerender, uploadAllToS3, mime table
public/           static assets, manifest, .well-known/, self-hosted WASM
vendor/           the immutable SDK release tarball
android/ ios/     Capacitor native projects
docs/             deployment.md, assetlinks.json.example
```

PIN bytes live only in `src/protocol/roomAccess.ts`'s in-memory map, and are
zeroed when replaced. Never put a PIN in a URL, in Redux, in IndexedDB, in
logs, in screenshots, in analytics, or in an issue report.

---

## Build and prerender

`npm run build` runs four steps in order:

1. **`typecheck`** — `tsc -b`.
2. **`build:client`** — `vite build` → `dist/`, including a copy of `public/`.
3. **`build:server`** — `vite build --ssr src/entry-server.tsx --outDir dist-ssr`.
   `copyPublicDir` is off for this pass (`vite.config.ts`): the server bundle
   renders HTML and is never served, so it has no use for the WASM or the logos.
4. **`prerender`** — `node scripts/prerender.mjs`.

The prerenderer imports `dist-ssr/entry-server.js` **in Node** (not in a
browser) and renders each route with React, then splices the markup into the
`<div id="root"></div>` of the built `dist/index.html`. The client hydrates
that markup, so the first response carries the text and the SPA still takes
over on load. Because the SDK reads `localStorage` and constructs its database
Worker at module scope, the script installs inert `localStorage`, `Worker`,
`WebSocket` and `indexedDB` globals first; none of them have to behave, since
the SDK's real work happens in effects and server rendering never runs those.

It also writes, per route, the `<title>`, description, canonical, Open Graph
and Twitter tags from one route table, plus `BlogPosting` JSON-LD for posts —
and emits `robots.txt` and `sitemap.xml` describing exactly the routes it
rendered, so those two cannot drift from what exists.

Two guards worth knowing before you add a route:

- a route whose rendered text is under 200 characters **fails the build**;
- `/r` and `/rooms` are rendered for their chrome but carry `noindex`, are
  excluded from the sitemap, and are disallowed in `robots.txt`. A room is
  addressed by a secret capability; there is nothing there to index.

Current output:

```text
$ npm run build
  /                                    6214 chars
  /privacy-policy                     12673 chars
  /terms-of-service                    9130 chars
  /session-lab                         1483 chars
  /blog                                1958 chars
  /blog/the-64-kib-lie                 8341 chars
  /blog/green-tests-are-not-a-security-proof   8661 chars
  /blog/a-room-is-n-minus-one-sessions   8667 chars
  /blog/protocol-v3-is-not-pqxdh      10481 chars
  /blog/free-is-a-dangerous-word      16493 chars
  /blog/borrowing-from-spqr           10803 chars
  /r                                    408 chars
  /rooms                                699 chars
  robots.txt and sitemap.xml written (11 indexable of 13 rendered)
```

---

## Deployment

```bash
npm run upload      # = npm run build && node --env-file=.env scripts/uploadAllToS3.mjs
```

Credentials come from `.env` (see `.env.example`). They are deployment-only and
must never be given a `VITE_` prefix — anything Vite inlines is public.

`scripts/uploadAllToS3.mjs` fails closed before it uploads anything:

- `.well-known/apple-app-site-association` must have exactly one `applinks`
  detail, `appID` `Y4UAPYWG26.com.p2party.app`, and `paths` exactly `["/r"]`;
- `.well-known/assetlinks.json` must carry a `com.p2party.app` statement with
  at least one uppercase colon-separated SHA-256 fingerprint. A missing file is
  fatal unless `AWS_S3_REQUIRE_ANDROID_APP_LINKS=false`, which warns and
  deliberately deploys without verified Android links;
- `dist/index.html` must exist, no symlinks or non-regular files are deployed,
  and nothing may escape `dist/`.

Cache policy is set per key: every `.html` and everything under `.well-known/`
is `no-cache, no-store, must-revalidate` (each prerendered page is an
entrypoint referencing content-hashed assets); `assets/**` and
`vendor/p2party-<x.y.z>/**` are `public, max-age=31536000, immutable` because
both name exactly one build forever; everything else gets an hour.
`index.html` is uploaded last.

Pruning is opt-in (`AWS_S3_PRUNE=true`), runs only after every upload
succeeded, and never deletes `assets/**` or the protected keys, so a client
holding the previous entrypoint can still fetch its lazy chunks.

The uploader cannot set response headers. CSP, HSTS, `Referrer-Policy`,
`Permissions-Policy` and `X-Content-Type-Options` are configured at the CDN or
reverse proxy — the exact header block is in
[docs/deployment.md](docs/deployment.md), which also covers the association
files and the requirement that the host serve `index.html` for a direct request
to `/r`.

---

## Android and iOS (Capacitor)

`capacitor.config.ts`: `appId` `com.p2party.app`, `appName` `P2Party`,
`webDir` `dist`. The native projects are committed under `android/` and `ios/`.

```bash
npm run build          # webDir must exist first
npx cap sync android   # or: npx cap sync ios
npx cap open android   # opens Android Studio; `ios` opens Xcode
```

What the app actually uses natively:

- **`@capacitor/app`** — `appUrlOpen` plus `getLaunchUrl()` for universal
  links (`src/hooks/useUniversalLink.tsx`). Only
  `https://p2party.com/r#v1.<43 base64url chars>` is accepted, and only with no
  port, no credentials, and that exact path
  (`src/protocol/universalLink.ts`); everything else is ignored.
- **`@capacitor/status-bar` + `@capacitor-community/safe-area`**
  (`src/App.tsx`) — status-bar style and insets follow the dark-mode setting.
- **`@capacitor/filesystem`** and
  **`@capawesome-team/capacitor-file-opener`** — writing a received file to
  disk and opening it (`src/components/MessageItem/MessageDropdown.tsx`), and
  saving a room QR code (`src/components/alerts/QRCodeAlert.tsx`).

`SystemBars.insetsHandling` is explicitly `"disable"` in `capacitor.config.ts`.
The safe-area plugin already pads for the keyboard on the decor view; leaving
Capacitor core's own listener on makes the two paddings nest instead of
replace, and the WebView ends up shrunk by roughly twice the keyboard height.
Exactly one layer may own the insets.

Android verified links stay off until the production signing certificate
exists: copy `docs/assetlinks.json.example` to
`public/.well-known/assetlinks.json` and fill in the real fingerprint.

**Do not treat `android/` and `ios/` as build output.** `cap sync` regenerates
only the copied web assets (`android/app/src/main/assets/public`,
`ios/App/App/public`), `capacitor.config.json` / `capacitor.plugins.json`, and
the plugin Gradle and CocoaPods wiring. `AndroidManifest.xml`,
`app/build.gradle`, `variables.gradle`, `Podfile` and `project.pbxproj` are
hand-maintained and are never restored by a sync — the app-link intent filter
for `https://p2party.com/r` (`android:autoVerify="true"`) and the
`androidx.core.content.FileProvider` declaration both live in the committed
manifest. Edit those files deliberately and commit them like source.

---

## Tests

### Unit — `npm test`

`bun test` over `tests/`: room access and capability normalization
(`roomAccess.test.ts`), safety-number rendering, universal-link acceptance,
blog manifest/content consistency, and two chat-layout regressions
(`chatScroll`, `composerViewport`). Last run here: 37 pass, 0 fail, 159
`expect()` calls, 842 ms.

### Browser — `e2e/`

Four Playwright + headless-Chromium harnesses that drive the **real app**
against **real WebRTC** (real `RTCPeerConnection`, DTLS/SCTP data channels).
They are not wired into CI. Each reads two environment variables:

- `APP_URL` — where the app is served, default `http://localhost:5190`;
- `SIGNALING_URL` — a protocol-v4 signaling service. Left unset, the harness
  uses whatever default the app is configured with; a v4 client fails closed
  against a v3 server, so an explicit local URL is usually what you want. Run
  [`p2party-server`](https://github.com/p2party/p2party-server) (Bun +
  PostgreSQL) or the SDK repository's Bun relay,
  `docs/e2e/appstack/relay.ts`, which needs no database and prints its own
  `ws://localhost:<port>/ws`.

Serve the built site first — verified working here:

```bash
npm run build
npx vite preview --port 5190 --strictPort
# GET /                                    → 200
# GET /vendor/p2party-0.14.4/libcrypto.wasm → 200
```

Then, in another shell:

#### `e2e/run.mjs` — `npm run e2e`

Two contexts, one room, real WebRTC. It asserts that a text message and a file
arrive byte-exact; that a 16 MiB transfer streams to OPFS and survives a page
reload; that the traffic really went over the data channel and not the
WebSocket relay (it instruments `RTCDataChannel.send` and requires the
65,490-byte frames there); that a deliberately dropped load-bearing chunk is
recovered by retransmission and the sender exposes the retransmit count; that
every data channel is closed at `bufferedAmount === 0`, so no queued write is
discarded; and that a mid-transfer disconnect still finishes the transfer after
a reconnect over a **brand-new** `RTCPeerConnection` — with relay of data
frames blocked, so only the peer-to-peer path can complete it.

#### `e2e/mesh-and-pin.mjs`

The two things `run.mjs` cannot show. At n=3: three contexts in one room, every
pair authenticated, and one send delivered byte-exact to **both** other peers.
Then a wrong-PIN joiner: the handshake must fail, the UI must say so rather
than sit on "Waiting for peers", and repeated attempts must be throttled with a
retry deadline.

#### `e2e/packet-trace.mjs`

Captures loopback UDP with `tcpdump -i lo0`, reads it back with `tshark`, and
compares an idle phase against a sending phase of a scheduled-cover room on
packet-size profile and rate.

#### `e2e/correlation-check.mjs`

The same capture, asking a sharper question: does any packet-size class occur
preferentially near a transfer completion? It computes a lift per size class
against that class's own base rate, with a Poisson tail bound so a handful of
packets cannot raise a false alarm. Its header records why it exists: a rate
comparison cannot catch one distinctive packet emitted at a telling moment,
"which is exactly the bug that shipped (an off-schedule 65-byte receipt at
transfer completion)".

The last two need `tcpdump` and `tshark` and the privileges to capture on
`lo0`. Read their header comments before quoting any number they print: both
state up front that loopback is not a network path, that they measure the
_shape_ of what the transport emits rather than proving indistinguishability,
and that they cover one preset and one payload size.

---

## What the app does today

Grounded in the vendored `p2party` 0.14.4 and in this repository's code.

- **Handshake.** Every peer edge runs interactive 3DH together with one
  room-pinned ML-KEM suite — ML-KEM-512, ML-KEM-768 (default), or ML-KEM-1024.
  The secrets are combined by **HKDF over their concatenation** in a fixed
  order (`3DH ‖ ML-KEM`, or `CPace-ISK ‖ 3DH ‖ ML-KEM` in a PIN room), under a
  suite-specific domain — not an XOR combiner, and deliberately not X-Wing
  (`p2party-js/src/handlers/handshakeCore.ts`). There is no suite negotiation
  and no classical fallback; peers whose room policy disagrees fail closed.
- **Confirmation and authentication.** Three chained key-confirmation flights
  complete the handshake; an `RTCDataChannel` reaching `open` is transport, not
  authentication. The Ed25519 identity key cross-signs the X25519 identity key
  over a static message (`IDENTITY_CROSS_SIGN_DOMAIN ‖ X25519_pub`) — a
  certificate, which the SDK itself notes is replayable, so transcript
  authentication comes from the interactive 3DH and those confirmations, not
  from a signature over the transcript.
- **Ratchet.** A per-peer Double Ratchet protects messages after the handshake;
  each message is sealed with ChaCha20-Poly1305 under its own message key.
- **Sparse post-quantum healing.** An OFFER/ADVANCE/ACK epoch exchange re-keys
  an established session, persisting before dispatch and blocking application
  traffic while an epoch is in flight.
- **Scheduled timing cover.** A room policy may pin a cadence, lane count and
  frames per cell; every edge then emits fixed-size cells on that schedule
  whether or not there is data. The UI offers 10 s, 60 s and 5 min presets plus
  a raw editor (`src/protocol/v4.ts`), and `CoverStatusPill` reports the worst
  live per-edge cover status — idle, starting, active, degraded, or a suspended
  "cover gap — not sending" — with the count of edges on the schedule in its
  tooltip. **This is timing cover, measured over loopback only.** It is not a
  traffic-analysis-resistance claim.
- **PIN rooms.** CPace runs inside the handshake, in addition to (never instead
  of) identity possession. The SDK records failed attempts per identity and
  reports a throttled state carrying a retry deadline, which
  `e2e/mesh-and-pin.mjs` asserts after six wrong PINs. The escalation curve
  itself is one of the three properties the SDK's `ROADMAP.md` lists as
  implemented but not yet demonstrated end to end, so do not claim it. This
  client keeps the PIN in a transient in-memory map only.
- **Transfers.** Each outbound message gets its own transfer identity and data
  channel, a cancellable handle, authenticated receipts and selective
  retransmission. Text and files up to the SDK's enforced 10 GiB limit; the
  receiver streams large files to OPFS where the browser provides it, and a
  reload fills the gaps rather than starting over. A transfer resumes across a
  replaced peer connection.
- **Invitations and identity.** A room invitation carries the full room policy;
  the address book pins a contact's Ed25519 identity and warns when it changes.
  The two surfaces are the note in `MessageSenderDropdown` and the
  `VerifyIdentityAlert` dialog — a warning you can find, not one that
  interrupts you before you talk to them.
- **Waking up.** `src/components/custom/ChatLayout.tsx` re-dials the room on
  window `focus`, `visibilitychange` to visible, `pageshow` (bfcache restore)
  and `online`, deferred one macrotask so the SDK's liveness state lands first.
  A phone that was backgrounded with its radio off wakes through
  `visibilitychange` without necessarily focusing the window, which is why
  `focus` alone was not enough.

### Not in the vendored SDK yet

The current SDK release cycle binds a peer edge to the DTLS certificate it was
authenticated against, re-dials the room after every failure teardown, fails a
send to a peer that never authenticates instead of hanging, and adds a
signaling heartbeat watchdog that marks a half-open socket disconnected. **None
of that is in `p2party-0.14.4.tgz`** — it lives on the SDK branch
`fix/peer-edge-transport-binding` and arrives here with the next re-vendor.
(Checked by grepping the built bundle: the vendored SDK answers server pings
with pongs, and it does verify the SDP `a=fingerprint:sha-256` against the
certificates `getStats()` reports at connect time — `DTLS fingerprint mismatch:
remote certificate ... (possible MITM)`. What it does not do is remember the
certificate an edge was authenticated against and replace a stale transport
when that certificate changes; there is also no re-dial and no watchdog.) The
app-side half above ships today; do not advertise the SDK half from this
repository until the tarball changes.

---

## Honest boundaries

- **The signaling operator sees membership and timing.** Joining sends the room
  capability to the signaling service, which stores its SHA-512 rather than the
  capability itself, together with a row per identity public key and the room's
  membership. The operator can see who is in a room and when. Server-blind
  rendezvous is **not** shipped: `connect()` rejects every `rendezvousMode`
  other than `legacy-signaling`.
- **Cover traffic is timing cover, verified on loopback.** See `e2e/` above.
- **There has been no independent third-party security audit** of the protocol
  or of this client.
- **Long-term identities live only in browser storage**, and there is no
  backup or restore flow yet. Clearing site data loses the identity.
- The room secret lives in the URL **fragment**, which a browser never puts in
  an HTTP request — but it is still in the link, and joining transmits the
  capability to the signaling service.

If you are about to add a sentence to the UI or to these docs, the project rule
is in the SDK's `ROADMAP.md` non-goals: _if a guarantee is not tested, it does
not go in the README._

---

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) first. Before opening a pull request:

```bash
npm ci
npm run provenance:check
npm run format:check
npm run lint:check
npm run typecheck
npm test
npm run build
npm audit --audit-level=high   # matches CI; currently red, see below
```

`npm audit` is **known red** in this tree: 7 advisories (2 high —
`brace-expansion`, `nanoid`; 5 moderate — `postcss`/`vite`, `@humanfs/node`,
`@xmldom/xmldom`, `plist`), all transitive through build and Capacitor
tooling. Both `npm audit` and CI's `npm audit --audit-level=high` exit 1 today,
pending an `npm audit fix` pass. If you see it fail, you did not break it —
but check that your change did not _add_ an advisory.

None of the commands above need PostgreSQL. For room or network changes, also
run the browser harnesses against a disposable signaling database on dedicated
ports — never against production infrastructure.

Report security issues privately per [SECURITY.md](SECURITY.md), not in a
public issue.

---

The corresponding source for the deployed site is
[p2party/p2party.com](https://github.com/p2party/p2party.com). Copyright ©
p2party contributors, [AGPL-3.0-only](LICENSE.md).
