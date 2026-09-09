import { defineConfig } from "vite";
import { resolve } from "path";
import { existsSync } from "node:fs";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

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
        !existsSync(resolve(__dirname, "dist", pathname.slice(1), "index.html"))
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
    plugins: [react(), tailwindcss(), previewLikeTheBucket()],
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
        app: resolve(__dirname, "src"),
        components: resolve(__dirname, "src", "pages"),
        hooks: resolve(__dirname, "src", "hooks"),
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
      rollupOptions: {
        output: {
          // No manual chunking. Two attempts at steering it made things worse:
          // `{ p2party: ["p2party"] }` let Rollup group the CommonJS interop
          // helpers into the SDK chunk, and since the entry imports those
          // helpers every page did `import{g,c}from"./p2party-*.js"` and
          // dragged 406 KB of WebRTC and cryptography onto a blog post. A
          // path predicate moved the helpers *and* grew the chunk to 519 KB.
          //
          // Left alone, Rollup puts a module in a chunk reachable from the
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
