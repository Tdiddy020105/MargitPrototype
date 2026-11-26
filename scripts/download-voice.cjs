const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { pipeline } = require("stream/promises");

const ROOT = path.join(__dirname, "..", "tools", "voice");
const PIPER_DIR = path.join(ROOT, "piper");
const PIPER_EXE = path.join(PIPER_DIR, "piper.exe");
const MODEL = path.join(ROOT, "nl_NL-mls-medium.onnx");
const CONFIG = path.join(ROOT, "nl_NL-mls-medium.onnx.json");
const ZIP = path.join(ROOT, "piper_windows_amd64.zip");
const VOICE_NAME = "Lot nl-NL";
const SPEAKER = "3";
const CHOICE = path.join(ROOT, "choice.json");

// Female Netherlands speakers inside nl_NL-mls-medium. 5809 is the default.
// Piper speaker ids: 5809 → 3, 7432 → 6, 1666 → 2, 496 → 4.
const VOICES = [
  { id: "lot", name: "Lot", speaker: "3" },
  { id: "fenna", name: "Fenna", speaker: "6" },
  { id: "noor", name: "Noor", speaker: "2" },
  { id: "saar", name: "Saar", speaker: "4" }
];

function currentVoice() {
  let id = "lot";
  try {
    const saved = JSON.parse(fs.readFileSync(CHOICE, "utf8"));
    if (VOICES.some((voice) => voice.id === saved.id)) id = saved.id;
  } catch {
    id = "lot";
  }
  return VOICES.find((voice) => voice.id === id);
}

function chooseVoice(id) {
  const voice = VOICES.find((item) => item.id === id);
  if (!voice) return null;
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(CHOICE, JSON.stringify({ id: voice.id }));
  return voice;
}

const PIPER_URL = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip";
const MODEL_URL =
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/nl/nl_NL/mls/medium/nl_NL-mls-medium.onnx?download=true";
const CONFIG_URL =
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/nl/nl_NL/mls/medium/nl_NL-mls-medium.onnx.json?download=true";

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
  if (voiceFilesReady()) return { exe: PIPER_EXE, model: MODEL, config: CONFIG, speaker: SPEAKER, name: VOICE_NAME };
  fs.mkdirSync(ROOT, { recursive: true });
  await download(PIPER_URL, ZIP, 1000000);
  extractPiper();
  await download(CONFIG_URL, CONFIG, 100);
  await download(MODEL_URL, MODEL, 1000000);
  if (!voiceFilesReady()) throw new Error("Netherlands Dutch voice files are missing.");
  return { exe: PIPER_EXE, model: MODEL, config: CONFIG, speaker: SPEAKER, name: VOICE_NAME };
}

module.exports = {
  ensureDutchVoice,
  voiceFilesReady,
  PIPER_EXE,
  MODEL,
  CONFIG,
  SPEAKER,
  VOICE_NAME,
  VOICES,
  currentVoice,
  chooseVoice
};

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
