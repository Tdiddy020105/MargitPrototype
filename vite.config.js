import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const keyPath = fileURLToPath(new URL("./certs/dev-key.pem", import.meta.url));
const certPath = fileURLToPath(new URL("./certs/dev-cert.pem", import.meta.url));

function localHttps() {
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) return null;
  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
}

export default defineConfig(({ command }) => {
  const https = command === "serve" ? localHttps() : null;
  return {
    base: command === "build" ? "/MargitPrototype/" : "/",
    plugins: [react()],
    server:
      command === "serve"
        ? {
            host: "0.0.0.0",
            port: 5173,
            strictPort: true,
            allowedHosts: true,
            ...(https ? { https } : {}),
            proxy: {
              "/api": {
                target: `${https ? "https" : "http"}://127.0.0.1:3001`,
                secure: false,
                changeOrigin: true
              }
            }
          }
        : undefined
  };
});
