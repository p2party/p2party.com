# Browser testing

The `e2e/` runners use Playwright and Chromium. Install the browser once with
`npx playwright install chromium`, build the site with `npm run build`, and
serve it with `npm run preview -- --host 127.0.0.1 --port 5840 --strictPort`.
Browser tests are separate from CI's unit tests and static build.

The standalone room QR, dialog-layout and chat-scroll runners also use Firefox
and WebKit. Install them with `npx playwright install firefox webkit`, then run
`node e2e/room-qr.mjs`. The QR runner bundles the real component, serves its own local fixture with the production
CSP, and makes no signaling connections.

Use disposable signaling state on dedicated local ports. Explicitly set a local
`SIGNALING_URL`; the older runners otherwise inherit the app's server default.
Do not run against production or a developer's regular database.

| Runner                       | Coverage                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run.mjs`                    | Two-peer text/files, OPFS reload, retransmission, cancellation, reconnection, and data-channel transport                                                  |
| `mesh-and-pin.mjs`           | Three-peer delivery, recovery after explicit PIN re-entry, and the retry countdown for persisted backoff                                                  |
| `desync-local-stack.mjs`     | Built UI, signaling restart, responder replacement, remembered consent, and wrong-PIN recovery                                                            |
| `pending-transfers.mjs`      | React pending-transfer panel with controlled SDK promises, including cancellation during retry and room remount                                           |
| `pending-transfers-live.mjs` | Real partial transfer, sender reload, automatic/manual retries, room navigation, and durable cancellation                                                 |
| `room-hydration.mjs`         | Saved signaling/STUN preferences, navigation, and hydration without an unrequested connection                                                             |
| `csp-hydration.mjs`          | All prerendered pages hydrate with strict CSP, without inline scripts or production requests                                                              |
| `room-qr.mjs`                | Three-engine QR rendering, blocked canvas extraction, permission recovery without reload, PNG downloads and async cancellation                            |
| `dialog-layout.mjs`          | Seven widths plus landscape: scrollable dialogs, keyboard overlays/panning, reachable actions, nine room/identity/contact dialogs, nested menus and focus |
| `chat-scroll.mjs`            | Seven widths plus landscape: visible messages, reader anchors, async bubble growth, room/channel changes, drafts, keyboard geometry and pending transfers |
| `packet-trace.mjs`           | Scheduled-cover packet sizes and rates on loopback                                                                                                        |
| `correlation-check.mjs`      | Packet-size classes near transfer completion on loopback                                                                                                  |

For a running local signaling server:

```bash
APP_URL=http://127.0.0.1:5840 \
SIGNALING_URL=ws://127.0.0.1:5841/ws \
node e2e/run.mjs
```

The three standalone UI runners build the actual React components with controlled
SDK boundaries and serve their own loopback fixtures. They need no database or
signaling server. Run `node e2e/dialog-layout.mjs` and `node e2e/chat-scroll.mjs`
directly; the layout fixtures compile the current site CSS. Reports and screenshots
are written under ignored `logs/dialog-layout/`, `logs/chat-scroll/` and
`logs/room-qr/`.

The responsive matrix includes widths 320, 360, 390, 430, 768, 1024 and 1440px,
plus short landscape views. Keyboard checks shrink and pan `visualViewport`
without changing the layout viewport, then dismiss it and verify recovery.
Assertions check visible message geometry and whether controls can be reached
and clicked after scrolling, rather than relying on DOM presence alone.

Desktop WebKit and injected viewport events do not reproduce the native iOS
keyboard or Safari permission UI. On an iPhone, also exercise keyboard open/close,
predictive-text changes, rotation, pinch zoom, long drafts, history scrolling,
incoming messages, and scrolling to each dialog's final action. Check that the
home-indicator inset returns after keyboard dismissal and that text selection or
VoiceOver scrolling can leave the live edge. Firefox canvas extraction is blocked
at the API boundary in the QR fixture; the browser's permission chrome is not
automated. These limits remain explicit in release validation.

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
