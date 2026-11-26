import { defineConfig } from "vite";
import { resolve } from "path";
import { existsSync, readFileSync } from "node:fs";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

import type { Plugin } from "vite";

/**
 * The web Content-Security-Policy, as docs/deployment.md specifies it for the
 * CDN. Read from that document so the native policy below cannot drift from it.
 */
export const documentedWebPolicy = (deploymentDoc: string): string => {
  const line = /^Content-Security-Policy: (.+)$/m.exec(deploymentDoc);
  if (line === null)
    throw new Error("docs/deployment.md has no Content-Security-Policy line");
  return line[1].trim();
};

/**
 * The iOS app's page origin. Android's is https://localhost, which 'self'
 * matches. capacitor: is not a special URL scheme, so under the URL standard
 * its origin is opaque and a CSP 'self' is not guaranteed to match it; the
 * origin is listed explicitly wherever the web policy allows 'self'.
 */
const CAPACITOR_IOS_ORIGIN = "capacitor://localhost";

/**
 * The web build targets the current release of each evergreen browser, as
 * MDN's browser-compat-data 8.1.11 listed them on 2026-11-26: nothing older
 * gets lowered syntax, CSS fallbacks or vendor prefixes. Raise these as new
 * versions ship.
 */
const WEB_BROWSER_TARGET = ["chrome158", "edge158", "firefox161", "safari27.2"];

/**
 * The native build runs in the platform WebView. Android's System WebView
 * updates like Chrome. iOS's is the WebKit of the installed iOS, so its floor
 * is the app's deployment target, iOS 16.0 (ios/App/Podfile). Built for the
 * web target instead, the bundle loses the -webkit- prefixes for
 * backdrop-filter, text-decoration and hyphens, the light-dark() fallback and
 * the min-width form of the breakpoint media queries, and the blog's link
 * patterns become lookbehind regex literals, which WebKit before 16.4 cannot
 * parse.
 */
const NATIVE_BROWSER_TARGET = ["chrome158", "safari16"];

/**
 * The web policy for a document meta element in the Android and iOS apps,
 * which have no response headers to carry one. frame-ancestors is dropped:
 * browsers ignore it in a meta element and log an error.
 */
export const nativeContentSecurityPolicy = (webPolicy: string): string =>
  webPolicy
    .split(";")
    .map((directive) => directive.trim())
    .filter(
      (directive) =>
        directive.length > 0 && !directive.startsWith("frame-ancestors"),
    )
    .map((directive) =>
      directive.split(/\s+/).includes("'self'")
        ? `${directive} ${CAPACITOR_IOS_ORIGIN}`
        : directive,
    )
    .join("; ");

/**
 * Put the native policy in index.html for `vite build --mode native` only. The
 * web build gets its policy as a response header from the CDN instead, where
 * frame-ancestors works.
 */
const nativeContentSecurityPolicyMeta = (mode: string): Plugin => ({
  name: "native-content-security-policy",
  transformIndexHtml() {
    if (mode !== "native") return [];
    const policy = nativeContentSecurityPolicy(
      documentedWebPolicy(
        readFileSync(
          resolve(import.meta.dirname, "docs", "deployment.md"),
          "utf8",
        ),
      ),
    );
    return [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: policy },
        // Before every script and stylesheet the policy has to govern.
        injectTo: "head-prepend",
      },
    ];
  },
});

/**
 * Make `vite preview` answer like the bucket does.
 *
 * Two behaviours have to match, because preview is what this project verifies
 * against before deploying and a preview that answers differently produces
 * bugs that do not exist. `appType: "mpa"` below covers the first: serve
 * dist/<route>/index.html instead of falling back to the landing page. This
 * plugin covers the second: S3 answers a directory path with no trailing slash
 * with a 302 to the slashed form, while Vite's static handler just 404s.
 *
 * Files are left alone -- a request carrying an extension is an asset, not a
 * route -- and anything without a prerendered index.html falls through, so a
 * genuine 404 stays a 404.
 */
const previewLikeTheBucket = () => ({
  name: "preview-like-the-bucket",
  configurePreviewServer(server: {
    middlewares: {
      use: (
        fn: (
          req: { url?: string },
          res: {
            statusCode: number;
            setHeader: (k: string, v: string) => void;
            end: () => void;
          },
          next: () => void,
        ) => void,
      ) => void;
    };
  }) {
    server.middlewares.use((req, res, next) => {
      const [pathname = "/", query] = (req.url ?? "/").split("?");
      if (pathname.endsWith("/") || pathname.split("/").pop()?.includes(".")) {
        next();
        return;
      }
      if (
        !existsSync(
          resolve(import.meta.dirname, "dist", pathname.slice(1), "index.html"),
        )
      ) {
        next();
        return;
      }
      res.statusCode = 302;
      res.setHeader(
        "Location",
        `${pathname}/${query === undefined ? "" : `?${query}`}`,
      );
      res.end();
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig((configEnv) => {
  const isDevelopment = configEnv.mode === "development";

  return {
    plugins: [
      react(),
      tailwindcss(),
      previewLikeTheBucket(),
      nativeContentSecurityPolicyMeta(configEnv.mode),
    ],
    // `vite preview` is this project's stand-in for the real origin, and by
    // default it is a liar: with the SPA fallback on, every prerendered route
    // is answered with dist/index.html, so /rooms/ serves the landing page's
    // markup and React reports a hydration mismatch (error #418) that does not
    // exist in production. S3 serves dist/<route>/index.html, and so must this.
    //
    // Scoped to preview on purpose: the dev server has no prerendered output to
    // serve and still needs the fallback for client-side routes.
    appType: configEnv.isPreview === true ? "mpa" : "spa",
    resolve: {
      alias: {
        app: resolve(import.meta.dirname, "src"),
        components: resolve(import.meta.dirname, "src", "pages"),
        hooks: resolve(import.meta.dirname, "src", "hooks"),
      },
    },
    css: {
      modules: {
        generateScopedName: isDevelopment
          ? "[name]__[local]__[hash:base64:5]"
          : "[hash:base64:5]",
      },
    },
    server: {
      port: 3000,
    },
    optimizeDeps: {
      // Pick up a newly vendored SDK without retaining its previous bundle.
      exclude: ["p2party"],
    },
    build: {
      // The server build renders HTML and is never served, so it has no use
      // for a copy of public/ -- which includes the WASM module and every logo.
      copyPublicDir: !configEnv.isSsrBuild,
      target:
        configEnv.mode === "native"
          ? NATIVE_BROWSER_TARGET
          : WEB_BROWSER_TARGET,
      rolldownOptions: {
        output: {
          // No manual chunking. Two attempts at steering it (under Rollup,
          // before Vite 8) made things worse: `{ p2party: ["p2party"] }` let
          // Rollup group the CommonJS interop helpers into the SDK chunk, and
          // since the entry imports those helpers every page did
          // `import{g,c}from"./p2party-*.js"` and dragged 406 KB of WebRTC and
          // cryptography onto a blog post. A path predicate moved the helpers
          // *and* grew the chunk to 519 KB.
          //
          // Left alone, Rolldown puts a module in a chunk reachable from the
          // things that actually import it, which is the property that matters
          // here: the SDK is imported only by the room routes and by one
          // deferred call on the landing page.
          //
          // React and Redux must stay together wherever they land: react-dom
          // mutates react's internals at import time, and separating them
          // across chunks renders a blank page with "Cannot set properties of
          // undefined (setting 'Activity')".
        },
      },
    },
  };
});
