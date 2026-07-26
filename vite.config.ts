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
      rollupOptions: {
        output: {
          // Split only the SDK. It is the largest dependency by far and moves
          // on its own release cadence, so keeping it out of the entry chunk
          // stops an app-code change from invalidating it in every cache.
          //
          // React and Redux are deliberately NOT split: react-dom mutates
          // react's internals at import time, and separating them across
          // chunks breaks that ordering -- it renders a blank page with
          // "Cannot set properties of undefined (setting 'Activity')".
          manualChunks: { p2party: ["p2party"] },
        },
      },
    },
  };
});
