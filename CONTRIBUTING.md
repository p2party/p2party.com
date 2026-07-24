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

The site consumes a local p2party-js tarball. Build and audit that package
before updating the `file:../p2party-js/p2party-<version>.tgz` dependency and
both lockfiles.

Run before opening a pull request:

```bash
npm run lint -- --no-fix
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
