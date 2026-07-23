import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/framer-motion")) return "motion";
          if (id.includes("node_modules/recharts")) return "charts";
          if (id.includes("node_modules/@tanstack")) return "query";
          if (id.includes("node_modules/lucide-react")) return "icons";
          if (id.includes("/client/src/data/content")) return "catalog-content";
          if (id.includes("/client/src/data/kids")) return "catalog-kids";
          if (id.includes("/client/src/data/profiles")) return "catalog-profiles";
        },
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
