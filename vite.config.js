
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const api = process.env.MARGIT_API || "http://127.0.0.1:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": api
    }
  }
});
