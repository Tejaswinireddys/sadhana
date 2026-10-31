import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@funnel": path.resolve(import.meta.dirname, "funnel"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  // Absolute base so deep links (/asanas/:slug, /guided) load JS/CSS correctly.
  // Relative "./" resolves assets under the route path and returns HTML (MIME error).
  base: "/",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    manifest: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        app: path.resolve(import.meta.dirname, "client/index.html"),
        welcome: path.resolve(import.meta.dirname, "client/welcome.html"),
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
