import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { runDataPlugin } from "./vite-plugin-run-data";

export default defineConfig({
  plugins: [react(), tailwindcss(), runDataPlugin()],
  server: {
    port: 4173,
    proxy: {
      "/api": {
        target: "http://localhost:4174",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
