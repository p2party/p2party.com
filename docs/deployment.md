# Deployment

`npm run upload` builds the site, validates the association files, and uploads
`dist/` to the configured S3-compatible bucket. It uploads binary bodies without
text conversion, sends content-addressed assets before `index.html`, and exits
non-zero on the first failed request.

Remote pruning is disabled by default. `AWS_S3_PRUNE=true` removes stale
non-asset objects only after a successful upload. Old `assets/` objects are
retained so a client that loaded the previous entrypoint can still fetch a lazy
chunk; expire them later with a bucket lifecycle rule.

## Association files

The Apple association is tracked at
`public/.well-known/apple-app-site-association` and is restricted to `/r`.

Android verified links remain blocked until the production signing certificate
exists. Copy `docs/assetlinks.json.example` to
`public/.well-known/assetlinks.json`, replace the placeholder with the
production certificate's uppercase, colon-separated SHA-256 fingerprint, and
leave `AWS_S3_REQUIRE_ANDROID_APP_LINKS=true`. The deploy command fails closed
when the file is absent or malformed. Setting the variable to `false` emits a
warning and deliberately deploys without verified Android links.

## Response headers

The uploader sets binary-safe `Content-Type` and cache policy metadata. Configure
these response headers at the CDN or reverse proxy; S3 `PutObject` cannot set
them as standard HTTP response headers:

```text
Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' https: wss:; worker-src 'self' blob:; manifest-src 'self'; frame-ancestors 'none'
Permissions-Policy: camera=(), geolocation=(), payment=(), usb=(), microphone=(self)
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
```

The host must serve `index.html` for a direct request to `/r`; the room
capability remains in the URL fragment and is therefore not part of that HTTP
request.

### Cloudflare configuration

The server repository manages this
[Response Header Transform Rule](https://developers.cloudflare.com/rules/transform/response-header-modification/)
in `deploy/terraform/p2party_frontend_headers.tf`. It matches only
`(http.host eq "p2party.com")` and sets the five headers above; signaling keeps
its own Caddy headers. Follow that repository's `deploy/README.md` for ownership
checks, planning and activation rather than creating a second dashboard rule.

Both `manage_frontend_response_headers` and `frontend_response_headers_enabled`
default to `false`. The Cloudflare token needs zone-scoped **Transform Rules →
Edit** permission in addition to DNS access. Terraform reads the current phase
and refuses a differently named ruleset or additional unmanaged rules, preserving
existing configuration until ownership is reconciled. Deploy this frontend's
CSP-compatible build and run its browser checks before activating the rule.

Earlier frontend builds emitted inline React boundary-repair scripts on room
pages. Enforcing this CSP on those builds produces hydration errors. The current
static renderer resolves the page before output, keeps large completed boundaries
in place, and rejects script-assisted markup at build time. It does not require
inline JavaScript permission or a fixed nonce.

Uploading HTML or adding S3 object metadata does not install this edge rule.
`frame-ancestors` must be delivered in the CSP response header; a document meta
tag cannot supply that protection. Verify the public response after applying
the reviewed Terraform plan, including a direct room request:

```bash
curl -sS -D - -o /dev/null https://p2party.com/
curl -sS -L -D - -o /dev/null https://p2party.com/r
```

## Verify a deployment

For the SDK 0.15.0 rollout, upgrade signaling first. Verify its health response
before releasing the frontend. After the frontend deploys, compare the served
WASM with the copy approved in the release checkout:

```bash
curl -fsS https://signaling.p2party.com/health | jq -e '.status == "ok" and .version == "0.2.0" and .protocolVersion == 5'
npm run provenance:check
curl -fsS --compressed https://p2party.com/vendor/p2party-0.15.0/libcrypto.wasm | cmp - public/vendor/p2party-0.15.0/libcrypto.wasm
```

The WASM response should use `application/wasm`, gzip encoding, and immutable caching.
The HTML entrypoint should remain uncached so a newly deployed page can select
the current content-addressed assets.

Open a fresh browser profile and use a new invitation to check delivery between
two test peers, one small file, reload recovery, and a second tab sharing one
identity. Explicitly leave the test room with each active identity, then close
the test peers. Keep restart, fault-injection, large transfer, and load tests on
the disposable local stack described in
[Browser testing](browser-testing.md).

On 2026-09-09, frontend tag `deploy-2026-09-09.2` was deployed before the
Cloudflare rule was activated. The reviewed Terraform apply created one ruleset,
changed no other resources and destroyed none; a subsequent full plan reported
zero changes. All five headers above are now present on the public frontend.

An actual production Chromium check verified all 15 pages and 66 distinct
page/asset responses with the expected headers, without injecting or rewriting
responses. No executable inline scripts, CSP violations or uncaught page errors
occurred, and homepage-to-blog-to-article navigation passed. A separate room smoke
confirmed WebRTC text and byte-exact file delivery, reload persistence and
same-identity tab replacement under the live policy. See
[Validation history](validation-history.md) for measurements and limitations.
