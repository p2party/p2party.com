# p2party.com

The React/Vite client shipped at [p2party.com](https://p2party.com). Peers who
open the same room form a WebRTC mesh; the signaling service introduces them
but does not carry room messages.

The site intentionally keeps its retro-web / hacker visual identity. It is the
reference browser integration for [`p2party-js`](https://github.com/p2party/p2party-js),
not a generic component library.

## Protocol status

The protocol-v3 release target consumes an immutable local `p2party` 0.12.0
tarball:

```text
file:../p2party-js/p2party-0.12.0.tgz
```

Protocol v3 uses interactive 3DH combined with one exact room-wide ML-KEM suite:
ML-KEM-512, ML-KEM-768 (the default), or ML-KEM-1024. It also provides optional
CPace room-PIN authentication, triple handshake confirmation, and a per-peer
Double Ratchet. There is no suite negotiation, downgrade, or classical
fallback; peers with conflicting room policy fail closed.

Immediate delivery is the only wired room-wide traffic policy and remains the
default. The UI shows the reserved 10-second, 60-second, and 5-minute scheduled
cover policies as unavailable; it does not claim that timed cover is deployed.
Likewise, the standalone `createSession()` lab is an in-process cryptography
demo, not a networking demo.

The implementation has not completed an independent security audit. Do not
treat the research claims or current release as a substitute for one.

## Local development

Prerequisites:

- Node.js 24.11.1 and npm 11.6.2
- Bun 1.3.14 for the unit-test runner
- a sibling `../p2party-js` checkout
- a verified `../p2party-js/p2party-0.12.0.tgz`

Install and run:

```bash
npm ci
npm run dev
```

`package-lock.json` is the authoritative dependency graph. Do not replace a
published tarball while keeping the same version: build it once, record its
SHA-256, and update the dependency and lockfile in the same release commit. A
public release is incomplete until those references and the recorded digest
agree.

The sibling `file:../p2party-js/...` layout is supported only for paired local
development. Before publishing this repository, vendor the immutable tarball at
`vendor/p2party-0.12.0.tgz` and point the dependency and lockfile there (or use
an immutable registry release). `npm run provenance:check` verifies the bytes
against the lockfile and deliberately rejects an external sibling artifact in
CI, so a standalone clone cannot pass accidentally with undeclared local state.

The app defaults to `wss://signaling.p2party.com/ws` and
`stun:stun.p2party.com:3478`. Both are editable in room settings, so a local
signaling service does not require a source change.

Non-database checks:

```bash
npm run format:check
npm run lint:check
npm run typecheck
npm test
npm run build
npm audit
```

No frontend test or build command needs PostgreSQL. Browser end-to-end tests
should use a disposable signaling database and dedicated ports.

## Repository map

- `src/pages/home.tsx` — public landing and room creation
- `src/pages/chat.tsx` — mesh chat and transfer lifecycle UI
- `src/pages/session-lab.tsx` — store-free `createSession()` demonstration
- `src/hooks/useRoom.tsx` — p2party-js browser integration
- `src/protocol/` — public policy/invitation and transient PIN boundary
- `e2e/` — browser-level WebRTC checks
- `scripts/` — static-site upload tooling

PIN bytes are held only in transient memory. Never put a PIN in a URL, Redux,
IndexedDB, logs, screenshots, analytics, or issue reports.

## Deployment

`npm run build` writes the static bundle to `dist/`. `npm run upload` performs a
fail-closed, assets-first deployment using the variables documented in
`.env.example`; those credentials are deployment-only and must never be exposed
through Vite `VITE_*` variables. Read [docs/deployment.md](docs/deployment.md)
before enabling remote pruning or verified native links.

There is no `.openai/hosting.json` in this repository as of this release.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening a pull request. Report
security issues privately according to [SECURITY.md](SECURITY.md), not in a
public issue.

## License

Copyright © p2party contributors. The corresponding source for the deployed
site is [p2party/p2party.com](https://github.com/p2party/p2party.com).

Licensed under the [GNU Affero General Public License v3.0 only](LICENSE.md).
