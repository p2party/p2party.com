# p2party.com

A browser client for encrypted peer-to-peer messaging and file sharing.
Open a room, share its invitation, and communicate over a WebRTC mesh.
Built with React, Vite, and TypeScript, with Capacitor projects for Android
and iOS. Licensed under [AGPL-3.0-only](LICENSE.md).

**Research-stage software.** The project has not completed an independent
security audit. The signaling service sees room membership and timing;
server-blind rendezvous and Sybil resistance are not shipped guarantees.
Read the [security policy](SECURITY.md) before relying on it for sensitive use.

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

## Run locally

Use Node **24.11.1** and npm **11.6.2** to match CI. Bun **1.3.14** runs tests;
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
absent from the HTTP request for the invitation page. Joining still sends the
capability to the signaling service. Direct WebRTC connections also reveal
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

The current dependency is `file:vendor/p2party-0.14.10.tgz`. Its self-hosted WASM
is `public/vendor/p2party-0.14.10/libcrypto.wasm`; `src/protocol/wasm.ts` selects
that path. The normal SDK loader verifies the WASM against its built-in SRI pin.
The experimental `/session-lab` entry receives fetched WASM bytes directly;
its release provenance is checked at build time rather than by browser SRI.

`npm run provenance:check` verifies the archive version and lockfile SHA-512,
its WASM provenance, and the byte-identical public WASM. It prints the artifact
and WASM SHA-256 values. CI runs it before installing dependencies.

To adopt a new SDK, build an immutable release archive in `p2party-js`, copy it
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

## Android and iOS

This release is validated for the web. The Capacitor 8 native migration is
incomplete; the native configuration needs migration and platform validation
before a mobile build or release.

`android/` and `ios/` are maintained Capacitor projects. They require separate
platform builds, signing, and device validation; a passing web build does not
certify a mobile release. After building the web client, use `npx cap sync android`
or `npx cap sync ios`, review the generated diff, and open the platform project.

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
