
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    allowedHosts: [".ts.net", "desktop-u5mu3qu.tail4ac3fe.ts.net"],
    proxy: {
      "/api": "http://127.0.0.1:3001"
    }
  }
});
