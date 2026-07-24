# Contributing

Thank you for helping with p2party.com.

## Before changing code

1. Open an issue for protocol, privacy, persistence, signaling, or room-policy
   changes. These surfaces need an explicit threat-model discussion.
2. Keep changes scoped. Preserve the retro two-column / hacker identity rather
   than replacing it with a generic SaaS design.
3. Never commit room PINs, identity secrets, `.env` files, captured signaling
   frames, browser databases, generated `dist/`, or `*.tsbuildinfo`.
4. Coordinate API changes with the sibling p2party-js and signaling-server
   repositories. Protocol v3 deliberately has no downgrade compatibility path.

## Development

The site consumes a vendored p2party-js tarball. Build and verify that package
before updating `vendor/p2party-<version>.tgz`, the `file:vendor/...`
dependency, and `package-lock.json` in the same commit. npm and
`package-lock.json` are the authoritative dependency resolver and lock; Bun is
used only as the test runtime. Never replace an artifact without changing its
version, and record its SHA-256 in the release handoff.

Paired development may use a sibling `../p2party-js` artifact. The public branch
must instead vendor that immutable tarball inside this repository (or consume an
immutable registry release), so a clean clone can run `npm ci` without
undeclared sibling state.

Before the first public push, export a fresh or squashed history whose author
and committer email addresses all use `@p2party.com`. Do not rewrite this active
protocol-development branch.

Run before opening a pull request:

```bash
npm ci
npm run format:check
npm run lint:check
npm run typecheck
npm test
npm run build
npm audit
```

For room/network changes, also run the browser WebRTC suite against disposable
signaling state. Do not point tests at production infrastructure or a
developer's PostgreSQL instance.

## Pull requests

- Explain the user-visible outcome and the security boundary.
- Include exact test commands and results.
- Call out intentionally deferred behavior. UI must not advertise unwired
  guarantees such as scheduled cover or private rendezvous.
- Add screenshots for visual changes at desktop and narrow mobile widths.
- Keep secrets and personal data out of fixtures, logs, and screenshots.

By contributing, you agree that your work is licensed under this repository's
AGPL-3.0-only license.
