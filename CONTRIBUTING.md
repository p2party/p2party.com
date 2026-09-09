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
   repositories. Protocol v4 deliberately has no downgrade compatibility path.

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

`master` carries the public history. Publish from this repository root with
`git push`; a separate export checkout is not needed. Start public changes
from `master`, and keep any older private history out of public merges.
Review history and packaged artifacts for credentials and personal data;
deleting a sensitive file from the latest tree does not remove it from older
commits. Keep local logs, native archives, provisioning profiles, and signing
keys out of Git.

Prefer browser or Node built-ins for small, well-defined operations. A new
dependency should provide enough maintained functionality to justify its
transitive packages and update burden. Check imports and platform configuration
before removing a package; a native plugin may be wired in Gradle or CocoaPods
without a JavaScript import. Review lockfile changes and run `npm audit` after
dependency changes.

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
- Call out intentionally deferred behavior. Scheduled cover is implemented,
  with loopback measurements; do not describe it as proven traffic-analysis
  resistance. Private rendezvous is research and is not a deployed guarantee.
- Add screenshots for visual changes at desktop and narrow mobile widths.
- Keep secrets and personal data out of fixtures, logs, and screenshots.

By contributing, you agree that your work is licensed under this repository's
AGPL-3.0-only license.
