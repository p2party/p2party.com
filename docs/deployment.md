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
