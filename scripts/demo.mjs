import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raw = process.argv[2];

if (!raw) {
  console.error("Gebruik: npm run demo -- <ip-van-de-pc>");
  console.error("Voorbeeld: npm run demo -- 192.168.1.42");
  process.exit(1);
}

function apiBase(value) {
  if (/^https?:\/\//.test(value)) return value.replace(/\/$/, "");
  if (value.includes(":")) return `http://${value}`.replace(/\/$/, "");
  return `http://${value}:3001`;
}

const api = apiBase(raw);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");

console.log(`Laptop-demo. Margit denkt op ${api}`);

const child = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", "5173"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, MARGIT_API: api }
});

child.on("exit", (code) => process.exit(code ?? 0));
