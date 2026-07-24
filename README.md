# p2party.com

The React/Vite client shipped at [p2party.com](https://p2party.com). Peers who
open the same room form a WebRTC mesh; the signaling service introduces them
but does not carry room messages.

The site intentionally keeps its retro-web / hacker visual identity. It is the
reference browser integration for [`p2party-js`](https://github.com/p2party/p2party-js),
not a generic component library.

## Protocol status

This checkout consumes the local `p2party` 0.10.0 tarball:

```text
file:../p2party-js/p2party-0.10.0.tgz
```

Protocol v3 uses a fixed interactive-3DH + ML-KEM-768 handshake, optional CPace
room-PIN authentication, and a per-peer Double Ratchet. There is no suite
negotiation or classical fallback.

Immediate delivery is the only wired room-wide traffic policy and remains the
default. The UI shows the reserved 10-second, 60-second, and 5-minute scheduled
cover policies as unavailable; it does not claim that timed cover is deployed.
Likewise, the standalone `createSession()` lab is an in-process cryptography
demo, not a networking demo.

The implementation has not completed an independent security audit. Do not
treat the research claims or current release as a substitute for one.

## Local development

Prerequisites:

- Bun 1.3+ and Node.js/npm
- a sibling `../p2party-js` checkout
- an audited `../p2party-js/p2party-0.10.0.tgz`

Install and run:

```bash
npm install
npm run start
```

The app defaults to `wss://signaling.p2party.com/ws` and
`stun:stun.p2party.com:3478`. Both are editable in room settings, so a local
signaling service does not require a source change.

Non-database checks:

```bash
npm run build
npm run lint -- --no-fix
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

`npm run build` writes the static bundle to `dist/`. Upload scripts require the
variables documented in `.env.example`; those credentials are deployment-only
and must never be exposed through Vite `VITE_*` variables.

There is no `.openai/hosting.json` in this repository as of this release.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report
security issues privately according to [SECURITY.md](SECURITY.md), not in a
public issue.

## License

Copyright © p2party contributors.

Licensed under the [GNU Affero General Public License v3.0 only](LICENSE.md).
