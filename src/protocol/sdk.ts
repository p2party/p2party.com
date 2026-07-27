import p2party from "p2party";

import { SELF_HOSTED_WASM_PATH } from "./wasm";

/**
 * The SDK, configured, and the only module that should import "p2party"
 * directly.
 *
 * Configuration used to live in the entry, which meant every page imported the
 * SDK to run one line: reading the terms of service or a blog post pulled
 * 406 KB of WebRTC mesh and cryptography before React would mount. Measured on
 * the built site, a blog post downloaded 1,065 KB of JavaScript, of which the
 * SDK was the single largest chunk and none of it was reachable from the page.
 *
 * Importing this module is what configures the WASM source, so the setup
 * happens exactly once, on the first module that actually needs cryptography,
 * and never on a page that does not.
 */
// Guarded because this module is now reachable from unit tests: roomAccess and
// v4 import it, and they are tested in a Node-like environment where there is
// no page to resolve a relative path against. In a browser this always runs.
if (typeof window !== "undefined")
  p2party.setWasmSourceUrl(
    new URL(SELF_HOSTED_WASM_PATH, window.location.href),
  );

export default p2party;
