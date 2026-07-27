import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig((configEnv) => {
  const isDevelopment = configEnv.mode === "development";

  return {
    plugins: [react(), tailwindcss()],
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
      exclude: ["p2party"],
      // p2party is excluded so a re-vendored SDK is picked up without clearing
      // the dep cache -- but excluding it also means its imports are served as
      // raw source. class-validator then reaches for validator's CommonJS
      // submodules, which the browser cannot import ("doesn't provide an
      // export named: 'default'" on validator/lib/isLatLong.js). Pre-bundling
      // them converts CJS to ESM, which is what Vite advises for the CommonJS
      // dependencies of an excluded package.
      include: ["class-validator", "validator"],
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
