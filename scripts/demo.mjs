import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");

function lanAddresses() {
  const addresses = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if ((net.family === "IPv4" || net.family === 4) && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

const server = spawn(process.execPath, ["server.cjs"], {
  cwd: root,
  stdio: "inherit"
});
const vite = spawn(process.execPath, [viteBin], {
  cwd: root,
  stdio: "inherit"
});

const addresses = lanAddresses();
console.log("Op de laptop, zelfde netwerk, alleen de browser:");
if (addresses.length) {
  for (const address of addresses) console.log(`http://${address}:5173`);
} else {
  console.log("http://<ip-van-deze-pc>:5173");
}
console.log("Zet poort 5173 open in de firewall van deze PC.");

function stop() {
  server.kill();
  vite.kill();
}

process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});

server.on("exit", (code) => {
  if (code) {
    vite.kill();
    process.exit(code);
  }
});
vite.on("exit", (code) => {
  server.kill();
  process.exit(code ?? 0);
});
