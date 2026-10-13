import { defineConfig } from "vite";
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
  build: { chunkSizeWarningLimit: 700 },
});
