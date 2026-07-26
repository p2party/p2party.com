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
