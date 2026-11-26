const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { pipeline } = require("stream/promises");

const ROOT = path.join(__dirname, "..", "tools", "voice");
const PIPER_DIR = path.join(ROOT, "piper");
const PIPER_EXE = path.join(PIPER_DIR, "piper.exe");
const MODEL = path.join(ROOT, "nl_BE-nathalie-medium.onnx");
const CONFIG = path.join(ROOT, "nl_BE-nathalie-medium.onnx.json");
const ZIP = path.join(ROOT, "piper_windows_amd64.zip");

const PIPER_URL = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip";
const MODEL_URL =
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/nl/nl_BE/nathalie/medium/nl_BE-nathalie-medium.onnx?download=true";
const CONFIG_URL =
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/nl/nl_BE/nathalie/medium/nl_BE-nathalie-medium.onnx.json?download=true";

function voiceFilesReady() {
  return fs.existsSync(PIPER_EXE) && fs.existsSync(MODEL) && fs.existsSync(CONFIG);
}

async function download(url, dest, minBytes) {
  if (fs.existsSync(dest) && fs.statSync(dest).size >= minBytes) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const part = `${dest}.part`;
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`${url} returned ${response.status}`);
  await pipeline(response.body, fs.createWriteStream(part));
  const size = fs.statSync(part).size;
  if (size < minBytes) {
    fs.rmSync(part, { force: true });
    throw new Error(`${path.basename(dest)} is only ${size} bytes`);
  }
  fs.renameSync(part, dest);
}

function extractPiper() {
  if (fs.existsSync(PIPER_EXE)) return;
  fs.mkdirSync(ROOT, { recursive: true });
  const extracted = spawnSync("tar", ["-xf", ZIP, "-C", ROOT], { stdio: "inherit" });
  if (extracted.status !== 0 || !fs.existsSync(PIPER_EXE)) {
    throw new Error("Piper did not unpack.");
  }
}

async function ensureDutchVoice() {
  if (voiceFilesReady()) return { exe: PIPER_EXE, model: MODEL, config: CONFIG, name: "Piper Nathalie nl-BE" };
  fs.mkdirSync(ROOT, { recursive: true });
  await download(PIPER_URL, ZIP, 1000000);
  extractPiper();
  await download(CONFIG_URL, CONFIG, 100);
  await download(MODEL_URL, MODEL, 1000000);
  if (!voiceFilesReady()) throw new Error("Nathalie voice files are missing.");
  return { exe: PIPER_EXE, model: MODEL, config: CONFIG, name: "Piper Nathalie nl-BE" };
}

module.exports = { ensureDutchVoice, voiceFilesReady, PIPER_EXE, MODEL, CONFIG };

if (require.main === module) {
  ensureDutchVoice()
    .then((voice) => {
      console.log(voice.name);
      console.log(voice.exe);
      console.log(voice.model);
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
