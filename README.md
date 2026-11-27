# p2party.com

A browser client for encrypted peer-to-peer messaging and file sharing.
Open a room, share its invitation, and communicate over a WebRTC mesh.
Built with React, Vite, and TypeScript, with Capacitor projects for Android
and iOS. Licensed under [AGPL-3.0-only](LICENSE.md).

**Research-stage software.** The project has not completed an independent
security audit. The signaling service sees room membership and timing;
server-blind rendezvous and Sybil resistance are not shipped guarantees.
Read the [security policy](SECURITY.md) before relying on it for sensitive use.

The November 27 web release uses SDK **0.15.0** and signaling protocol **5**.
Peer encryption continues to use protocol **4**. Contacts and blocks follow
authenticated identity keys across routing changes. Existing messages stay
readable, and interrupted file cleanup can retry after a browser restart.
Two fresh browser pairs verified persisted text and byte-compared a 32 KiB
file on the public service, once on a direct ICE path and once through TURN.
[Release notes and test results](src/content/blog/09-rooms-after-signaling-v5.md) ·
[Changelog](CHANGELOG.md) · [Signaling health](https://signaling.p2party.com/health)

## What works

- Text and file transfers with authenticated receipts and selective retry.
- Durable pending transfers that survive sender reload, with Retry and Cancel
  available after room navigation. Preparation must finish before a payload can
  be recovered; retained prepared transfers expire after 24 hours.
- Room invitations whose capability and policy stay in the URL fragment,
  optional PIN authentication, and per-room cryptographic policy.
- Automatic reconnection and targeted repair of missing peer connections;
  authentication failures require an explicit retry.
- Address-book identity verification and optional recovery phrases. Recovery
  restores identities created from a phrase; it cannot recover an older random
  identity or deleted messages.
- Immediate delivery or scheduled timing cover. Scheduled cover has been
  measured on loopback and is not a claim of resistance to traffic analysis.

The client integrates the SDK; cryptographic and transport implementation lives
in the separate library repository.

| Repository                                                  | Responsibility                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| **p2party.com**                                             | UI, invitations, browser integration, static build, native shells |
| [p2party-js](https://github.com/p2party/p2party-js)         | Handshake, ratchet, WebRTC mesh, transfers, and local storage     |
| [p2party-server](https://github.com/p2party/p2party-server) | Signaling service, using Bun and PostgreSQL                       |

P2Party Testnet 1 is live at the JSON-RPC endpoint on the signaling host.
Its genesis defines 128 units without monetary value and one validator orders
native post-quantum transfers. Using rooms requires neither a wallet nor a test unit.
The first grant funded one unit. Ethers spent it with ML-DSA-65 at height 2
and viem spent the same unit with SLH-DSA-SHA2-192s at height 3. Both clients
verified historical balances and recovered their original receipts on retry.
[Testnet guide and client examples](https://github.com/p2party/p2party-js/blob/master/docs/testnet-1.md) · [Native library](https://github.com/ondemos/libdemos)

## Run locally

Use Node **26.13.1** and npm **12.2.3** to match CI. Bun **1.4.5** runs tests;
npm and `package-lock.json` are the dependency authority.

```bash
npm ci
npm run provenance:check
npm run dev -- --host 127.0.0.1
```

Open `http://localhost:3000`. The SDK archive and cryptography module are
vendored, so a sibling SDK checkout is unnecessary. Other npm dependencies
still need to be downloaded. No deployment credentials are needed to develop
or test the frontend.

The room settings expose the signaling and STUN servers. Change them to your
local services before running network experiments. The default signaling
service is the public p2party service; connecting to a room introduces its
members to that service.

## Security and privacy boundaries

Room capability and policy are carried in `/r#v1.<capability>...`, so they are
absent from the HTTP request for the invitation page. With signaling v5 the
browser hashes the capability with SHA-512 and sends the resulting room
identifier to the signaling service. Direct WebRTC connections also reveal
network metadata to peers.

PIN bytes are retained only in memory and cleared when forgotten. Identity
keys, received content, and pending transfers use browser storage; a compromised
browser, extension, or application origin can access them. Keep recovery phrases
and room invitations out of issue reports, logs, screenshots, and analytics.

Peer text is rendered as text. External message links accept only explicit HTTP
or HTTPS URLs and open without an opener or referrer. Script-bearing attachments,
including HTML and SVG, are downloaded instead of executed as documents on this
origin. Downloaded files still require the recipient's judgment before opening
in another application.

Private rendezvous and anonymous admission remain research. Scheduled cover and
loopback recovery tests do not prove anonymity, prevent Sybil attacks, or establish
recovery bounds for mobile or wide-area networks.

## SDK artifacts

This checkout uses the SDK release archive `file:vendor/p2party-0.15.0.tgz`
from the `p2party-js` Linux CI build.
For local room tests, set **Settings → Signaling Server URL** to the WebSocket
URL of your signaling v5 server.
The app loads
`public/vendor/p2party-0.15.0/libcrypto.wasm` through `src/protocol/wasm.ts`.
The normal SDK loader verifies the WASM against its built-in SRI pin.
The experimental `/session-lab` entry receives fetched WASM bytes directly;
its release provenance is checked at build time rather than by browser SRI.

`npm run provenance:check` verifies the archive version and lockfile SHA-512,
its WASM provenance, and the byte-identical public WASM. It prints the artifact
and WASM SHA-256 values. CI runs it before installing dependencies.

To adopt a new SDK, download the validated release archive from the matching
`p2party-js` CI run and verify its SHA-256 against the build log. Copy it
into `vendor/`, update the `file:` dependency through npm, copy its packed WASM
into the matching `public/vendor/p2party-<version>/` directory, and update
`SELF_HOSTED_WASM_PATH`. Review the tarball, lockfile, source path, and public
WASM together. Never replace a published archive without changing its version;
keep older deployed assets available while clients may still reference them.

## Validate changes

```bash
npm run provenance:check
npm run format:check
npm run lint:check
npm test
npm run build
npm audit
```

The build includes TypeScript checking, a browser bundle, server rendering, and
static prerendering. It does not need PostgreSQL or a browser binary. Unit tests
cover room access, identity entry points and outcomes, invitation validation,
layout, and external-link safety.

For room or network changes, also run the [browser tests](docs/browser-testing.md)
against disposable local signaling state. They exercise real WebRTC separately
from the unit suite and are not currently part of CI. Exact earlier artifacts,
measurements, and limitations are preserved in
[Recorded validation history](docs/validation-history.md); a newer dependency
version does not inherit a previous version's browser test result.

## Deploy

The web build is static HTML and assets under `dist/`. Deploy with an HTTPS
origin that serves the prerendered routes. For the included S3-compatible
uploader, fill in a local `.env` using the names in `.env.example`, then run:

```bash
npm run upload
```

Deployment credentials are Node-only variables. Never prefix them with `VITE_`,
commit them, or copy them into `public/`. The uploader checks the association
files, rejects symlinks, uploads assets before the entrypoint, and keeps remote
pruning disabled unless explicitly enabled.

The uploader gzip-compresses WASM for transfer, retaining `application/wasm`
and setting `Content-Encoding: gzip`. The local and public WASM files stay
unchanged; browsers decode the response before checking the SDK's integrity pin.
Use `curl --compressed` when downloading a deployed WASM file for hash checks.

Android verified links require the production certificate fingerprint in
`public/.well-known/assetlinks.json`. A web-only deployment can explicitly use
`AWS_S3_REQUIRE_ANDROID_APP_LINKS=false` until that file is ready. Configure CSP,
HSTS, and the other response headers at the CDN or reverse proxy as described in
[Deployment](docs/deployment.md).

## Supported browsers and devices

The client is built for the current major of each browser, for Safari the
major's first release, because the iOS deployment target follows it. As
MDN's browser-compat-data listed them on 2026-11-26 that is Chrome and Edge
158, Firefox 161, and Safari 27 and Safari on iOS 27 (`BROWSER_TARGET` in
`vite.config.ts`). The web build and the Android and iOS apps use the same
target. The apps run it in the platform WebView, so they require:

- **iOS and iPadOS 27.0 or later**, the release that ships Safari 27. Per
  Apple, iOS 27 runs on iPhone 11 and later and iPhone SE (2nd generation and
  later), and iPadOS 27 on iPad Pro (4th generation and later), iPad Air (4th
  generation and later), iPad (9th generation and later) and iPad mini (6th
  generation and later). Older devices, and devices still on iOS or iPadOS
  26 or earlier, cannot install the app.
- **Android 10 (API 29) or later**, the lowest version Chromium 158's Android
  System WebView supports. Android 9 and earlier cannot install the app. The
  app also needs Android System WebView at Chrome 158 or newer, which the
  system updates independently of the Android version; the one emulator run
  so far was on WebView 133.

An older browser receives the same files: nothing is lowered, polyfilled or
prefixed for it, and it is shown no notice. Compared with Vite's default target
(Chrome and Edge 111, Firefox 114, Safari 16.4), the build of 2026-11-26
differed only in CSS: no `-webkit-` prefixes for `backdrop-filter` and
`text-decoration`, and no fallback for `light-dark()` colours. An older
browser may draw those styles wrongly, and code added later may not run in it
at all.

## Android and iOS

`android/` and `ios/` are Capacitor 8 projects. On November 27, the Android
debug and unsigned release APKs built for API 37. Keyboard resizing and status
bar behavior were checked on an Android 16 emulator. Android 17 permission
grant and denial, LAN access, and TURN fallback still need device testing.
An earlier iOS 27 simulator build launched with Xcode 27.2. Native publication
still needs signing and physical-device validation. [Native build record](docs/native-builds.md)

Build the app's web client with `npm run build:native`, which adds the app's
Content-Security-Policy, then copy it into the projects with
`npx cap sync android` or `npx cap sync ios` and review the generated diff.
Both native builds stop when the copied client loads a different SDK version
than `package.json` vendors or lacks that policy. Run `npm run e2e:native-csp`
after any change to that policy or to the SDK version. See
[Native builds](docs/native-builds.md).

The iOS app requires iOS or iPadOS 27.0 and the Android app Android 10; see
[Supported browsers and devices](#supported-browsers-and-devices).

The SDK accepts the iOS app's `capacitor://localhost` WASM source
and verifies the fetched bytes against its integrity pin. The native WebKit
check in `e2e/native-csp-webkit.swift` exercises this path on macOS.

Keep native archives, signing keys, provisioning profiles, and copied web build
outputs out of Git. The application ID is `com.p2party.app`; public association
files contain identifiers and certificate fingerprints, never private keys.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). Discuss protocol, privacy, persistence,
and room-policy changes in an issue before implementation. Use synthetic data
and explain what was tested and what remains uncertain.

Report suspected vulnerabilities privately to **security@p2party.com** according
to [SECURITY.md](SECURITY.md), rather than opening a public issue.
