import fs from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const keyFile = new URL("./certs/dev-key.pem", import.meta.url);
const certFile = new URL("./certs/dev-cert.pem", import.meta.url);

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    https: {
      key: fs.readFileSync(keyFile),
      cert: fs.readFileSync(certFile)
    },
    proxy: {
      "/api": "http://127.0.0.1:3001"
    }
  }
});
