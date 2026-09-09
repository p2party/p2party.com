# Browser testing

The `e2e/` runners use Playwright and Chromium. Install the browser once with
`npx playwright install chromium`, build the site with `npm run build`, and
serve it with `npm run preview -- --host 127.0.0.1 --port 5840 --strictPort`.
Browser tests are separate from CI's unit tests and static build.

Use disposable signaling state on dedicated local ports. Explicitly set a local
`SIGNALING_URL`; the older runners otherwise inherit the app's server default.
Do not run against production or a developer's regular database.

| Runner                       | Coverage                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `run.mjs`                    | Two-peer text/files, OPFS reload, retransmission, cancellation, reconnection, and data-channel transport        |
| `mesh-and-pin.mjs`           | Three-peer delivery, wrong-PIN failure, and retry throttling                                                    |
| `desync-local-stack.mjs`     | Built UI, signaling restart, responder replacement, remembered consent, and wrong-PIN recovery                  |
| `pending-transfers.mjs`      | React pending-transfer panel with controlled SDK promises, including cancellation during retry and room remount |
| `pending-transfers-live.mjs` | Real partial transfer, sender reload, automatic/manual retries, room navigation, and durable cancellation       |
| `room-hydration.mjs`         | Saved signaling/STUN preferences, navigation, and hydration without an unrequested connection                   |
| `csp-hydration.mjs`          | All prerendered pages hydrate with strict CSP, without inline scripts or production requests                    |
| `packet-trace.mjs`           | Scheduled-cover packet sizes and rates on loopback                                                              |
| `correlation-check.mjs`      | Packet-size classes near transfer completion on loopback                                                        |

For a running local signaling server:

```bash
APP_URL=http://127.0.0.1:5840 \
SIGNALING_URL=ws://127.0.0.1:5841/ws \
node e2e/run.mjs
```

The two live stack runners can start and stop their own sibling
`p2party-server` process against an already migrated, disposable PostgreSQL
database:

```bash
APP_URL=http://127.0.0.1:5840 \
DATABASE_URL='postgresql://p2party_e2e@127.0.0.1:6543/p2party_followups?sslmode=disable' \
node e2e/desync-local-stack.mjs

APP_URL=http://127.0.0.1:5840 \
DATABASE_URL='postgresql://p2party_e2e@127.0.0.1:6543/p2party_followups?sslmode=disable' \
node e2e/pending-transfers-live.mjs
```

These fixtures reject database port 5432 and an existing server listener, stop
only the child they own, and start Bun with `--no-env-file` so the server
checkout's credentials cannot enter the fixture. They default a validated
loopback database to `sslmode=disable` only when no explicit SSL mode was given.
Reports and server logs stay under ignored `logs/desync/`.

The packet runners need `tcpdump`, `tshark`, and capture permission for `lo0`.
Read each runner's configuration and limits before using its results. Loopback
measurements cover one preset and payload size; they do not prove traffic
indistinguishability or bound recovery time on real networks.

After changes to rendering or response headers, run `node e2e/csp-hydration.mjs`
against the local preview. It applies the documented CSP to test-browser
responses, blocks external requests, checks every prerendered route for
hydration errors and policy violations, and opens the invitation consent dialog
without connecting. The renderer also rejects script-assisted route markup
during the build. These checks do not configure headers on the deployed CDN.

The preview server serves each prerendered route and redirects `/r` to `/r/`,
matching the bucket's directory behavior. Do not replace it with a generic SPA
fallback when checking hydration. See `tests/previewParity.test.ts`.

Previous measurements and exact artifact hashes are preserved in
[Recorded validation history](validation-history.md).
