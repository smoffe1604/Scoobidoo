import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/portfolios": "http://127.0.0.1:8010",
      "/data-quality": "http://127.0.0.1:8010",
      "/meta": "http://127.0.0.1:8010",
      "/health": "http://127.0.0.1:8010",
    },
  },
});
