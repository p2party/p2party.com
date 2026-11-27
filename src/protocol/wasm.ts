/**
 * The single source of truth for the self-hosted libcrypto.wasm.
 *
 * p2party ships an SRI pinned INSIDE its bundle, so this only redirects WHERE
 * the bytes come from — integrity is still enforced against the build pin.
 * The store-free `p2party/session` entry does not share the root module's
 * loader state: omitting `wasmBinary` there falls back to the versioned CDN,
 * which 404s for a version that has not been published yet. Both entries must
 * therefore be pointed at this same file.
 *
 * Keep the version in the path in step with package.json's vendored tarball —
 * scripts/verifyLocalDependency.mjs derives the expected public path from the
 * lockfile version and fails the build if they diverge.
 */
export const SELF_HOSTED_WASM_PATH =
  "/vendor/p2party-0.15.0-rc.1/libcrypto.wasm";

let cachedWasmBinary: Promise<ArrayBuffer> | undefined;

/** Fetch (once per page) the self-hosted WASM bytes for `p2party/session`. */
export const loadSessionWasmBinary = (): Promise<ArrayBuffer> => {
  cachedWasmBinary ??= fetch(
    new URL(SELF_HOSTED_WASM_PATH, window.location.href),
  ).then((response) => {
    if (!response.ok)
      throw new Error(
        `Could not load the local cryptography module (${String(response.status)})`,
      );
    return response.arrayBuffer();
  });
  return cachedWasmBinary;
};
