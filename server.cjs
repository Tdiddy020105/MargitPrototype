
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const express = require("express");
const ffmpegPath = require("ffmpeg-static");
const { usableTranscript } = require("./scripts/hear.cjs");

const PAGES_ORIGIN = "https://tdiddy020105.github.io";

const app = express();
app.use((req, res, next) => {
  if (req.headers.origin === PAGES_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", PAGES_ORIGIN);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json({ limit: "32kb" }));

const SPEAK_DIR = path.join(os.tmpdir(), "margit-speak");
const HEAR_DIR = path.join(os.tmpdir(), "margit-hear");
const SPEAK_SCRIPT = path.join(__dirname, "scripts", "speak-dutch.ps1");
const WHISPER_BIN = path.join(__dirname, "tools", "whisper", "bin", "Release", "whisper-cli.exe");
const WHISPER_MODEL = path.join(__dirname, "tools", "whisper", "ggml-base.bin");
const speakJobs = new Map();
let pcVoice = "";

const OLLAMA_URL = "http://127.0.0.1:11434";
const MODEL = "margit:latest";

const INTENTS = ["praise", "mistake", "help", "hard", "offer", "spell", "chat"];

const FALLBACK = {
  praise: "Ja! Helemaal goed. Knap gedaan!",
  mistake: "Goed geprobeerd! Zullen we nog eens naar de eerste letter kijken?",
  help: "Ik help je wel! Luister eens goed naar de eerste klank.",
  hard: "Dat geeft helemaal niet. Misschien kunnen we iets anders proberen.",
  offer: "Dit is een lastig woord. Kies maar: memory, woordzoeker of één letter anders.",
  chat: "Hoi! Wat leuk dat je er bent!"
};

const SYSTEM_PROMPT = `
Je schrijft één Nederlandse zin voor Margit, een metgezel die met een kind lezen en spellen oefent.
Je kiest niet wat er op het scherm gebeurt. De bedoeling is al gekozen.
Antwoord alleen met JSON: {"line":"...","intent":"<precies de bedoeling die je kreeg>"}
Hoogstens twee korte zinnen. Geen les, geen advies over gevoelens, geen denkproces.
Bij praise: kort prijzen, het woord niet noemen.
Bij mistake, help of hard: het woord niet noemen, de letters niet geven, geen spel noemen.
Bij spell: vraag het gegeven woord te spellen.
Bij offer: zeg dat het een lastig woord is en noem memory, woordzoeker en één letter anders.
Bij chat: reageer kort en vriendelijk, zoals "Hoi! Wat leuk dat je er bent!". Zeg nooit "hé kind", "hey kind" of "hee kind". Noem hem niet "kind".
`;

function fold(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/é/g, "e")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mentionsWord(line, word) {
  const target = fold(word);
  if (!target) return false;
  return new RegExp(`\\b${target}\\b`).test(fold(line));
}

function namesAllGames(line) {
  const value = fold(line);
  return value.includes("memory") && value.includes("woordzoeker") && value.includes("letter");
}

function namesAGame(line) {
  const value = fold(line);
  return value.includes("memory") || value.includes("woordzoeker") || value.includes("letter");
}

function fallbackLine(intent, word) {
  if (intent === "spell") return `Spel het woord ${word || "boom"}.`;
  return FALLBACK[intent] || FALLBACK.chat;
}

function acceptLine(text, intent, word) {
  const line = String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!line || line.length > 280) return null;
  if (/[{}<>]|\bintent\b|\bjson\b/i.test(line)) return null;
  if (/\b(he|hey|hee) kind\b/.test(fold(line))) return null;
  if ((intent === "mistake" || intent === "help" || intent === "hard" || intent === "praise") && mentionsWord(line, word)) {
    return null;
  }
  if (intent === "spell" && !mentionsWord(line, word)) return null;
  if (intent === "offer") return namesAllGames(line) ? line : null;
  if (namesAGame(line)) return null;
  return line;
}

function readModel(text) {
  const raw = String(text || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function asksToSpell(text) {
  const value = String(text || "")
    .toLowerCase()
    .replace(/[''`´"]/g, "")
    .replace(/[^a-zàáäèéëìíïòóöùúü\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) return false;

  const spoken = value
    .replace(/\b(drie|twee|vier|welke|de|die|andere|alle|geen|leuke)\s+spellen\b/g, " ")
    .replace(/\b(een|het|welk|dit|dat|ander|andere|leuk|leuke)\s+spel\b/g, " ");

  if (/\b(spellen|spelt)\b/.test(spoken)) return true;
  if (/\bspel\b/.test(spoken)) return true;
  if (/\b(opschrijven|opschrijft|opschrijf|uitschrijven|schrijven|schrijft|schrijf)\b/.test(value)) return true;
  if (value.includes("welke letter")) return true;
  if (value.includes("letter voor letter")) return true;
  if (/\b(de letters|alle letters|letters van|letters in|letters zitten)\b/.test(value)) return true;

  return false;
}

function shapeReply(text) {
  let value = String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/[*_`#]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (!value) {
    return "Ik ben er. Zullen we een klein woord proberen?";
  }

  const sentences = value.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 2) return value;

  const ask = [...sentences].reverse().find((sentence) => asksToSpell(sentence));
  if (!ask || asksToSpell(sentences[0]) || asksToSpell(sentences[1])) {
    return sentences.slice(0, 2).join(" ");
  }

  return `${sentences[0]} ${ask}`;
}

function speakOnPc(text) {
  const hash = crypto.createHash("sha256").update(text).digest("hex");
  const wav = path.join(SPEAK_DIR, `${hash}.wav`);
  if (fs.existsSync(wav) && fs.statSync(wav).size > 44) {
    return Promise.resolve({ file: wav, voice: pcVoice });
  }
  if (speakJobs.has(hash)) return speakJobs.get(hash);
  fs.mkdirSync(SPEAK_DIR, { recursive: true });
  const textFile = path.join(SPEAK_DIR, `${hash}.txt`);
  fs.writeFileSync(textFile, text, "utf8");
  const job = new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        SPEAK_SCRIPT,
        "-TextFile",
        textFile,
        "-OutFile",
        wav
      ],
      { windowsHide: true }
    );
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
    }, 20000);
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const voice = out.trim().split(/\r?\n/).filter(Boolean).pop() || "";
      if (voice) pcVoice = voice;
      if (code !== 0 || !fs.existsSync(wav)) {
        reject(new Error(err.trim() || `Dutch speech exited ${code}`));
        return;
      }
      resolve({ file: wav, voice: pcVoice });
    });
  }).finally(() => {
    speakJobs.delete(hash);
  });
  speakJobs.set(hash, job);
  return job;
}

function runTool(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true, cwd });
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Het omzetten duurde te lang."));
    }, 45000);
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(err.trim() || `exit ${code}`));
      else resolve();
    });
  });
}

function audioExt(mime) {
  const value = String(mime || "").toLowerCase();
  if (value.includes("wav")) return ".wav";
  if (value.includes("webm")) return ".webm";
  if (value.includes("mpeg") || value.includes("mp3")) return ".mp3";
  if (value.includes("ogg")) return ".ogg";
  if (value.includes("mp4") || value.includes("m4a") || value.includes("aac")) return ".m4a";
  return ".audio";
}

async function transcribeAudio(buffer, mime) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 400) return "";
  if (!fs.existsSync(WHISPER_BIN) || !fs.existsSync(WHISPER_MODEL) || !ffmpegPath) {
    throw new Error("De herkenning op deze PC ontbreekt.");
  }
  const id = crypto.randomBytes(8).toString("hex");
  fs.mkdirSync(HEAR_DIR, { recursive: true });
  const input = path.join(HEAR_DIR, `${id}-in${audioExt(mime)}`);
  const wav = path.join(HEAR_DIR, `${id}.wav`);
  const outBase = path.join(HEAR_DIR, `${id}-text`);
  fs.writeFileSync(input, buffer);
  try {
    await runTool(ffmpegPath, ["-y", "-i", input, "-ac", "1", "-ar", "16000", wav]);
    await runTool(
      WHISPER_BIN,
      ["-m", WHISPER_MODEL, "-f", wav, "-l", "nl", "-nt", "-np", "-sns", "-bs", "1", "-bo", "1", "-otxt", "-of", outBase],
      path.dirname(WHISPER_BIN)
    );
    const txt = `${outBase}.txt`;
    return usableTranscript(fs.existsSync(txt) ? fs.readFileSync(txt, "utf8") : "");
  } finally {
    for (const file of [input, wav, `${outBase}.txt`]) {
      try {
        fs.rmSync(file, { force: true });
      } catch {
        // A temp file can already be gone.
      }
    }
  }
}

app.post("/api/hear", express.raw({ type: () => true, limit: "12mb" }), async (req, res) => {
  try {
    const text = await transcribeAudio(req.body, req.headers["content-type"]);
    res.json({ text });
  } catch (error) {
    console.error("Hear error:", error.message);
    res.status(503).json({ error: "De herkenning op deze PC doet het nu niet." });
  }
});

app.post("/api/speak", async (req, res) => {
  const text = String(req.body?.text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  if (!text) return res.status(400).json({ error: "Lege zin." });
  try {
    const spoken = await speakOnPc(text);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "public, max-age=86400");
    if (spoken.voice) res.setHeader("X-Margit-Voice", spoken.voice);
    fs.createReadStream(spoken.file).pipe(res);
  } catch (error) {
    console.error("Dutch speech error:", error.message);
    res.status(503).json({ error: "De stem op deze PC doet het niet." });
  }
});

app.get("/api/health", async (_req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000)
    });
    if (!response.ok) return res.status(503).json({ ok: false });
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const body = req.body || {};
    const intent = INTENTS.includes(body.intent) ? body.intent : null;
    const context = body.context && typeof body.context === "object" ? body.context : {};
    const word = typeof context.word === "string" ? context.word : "";

    const messages = intent
      ? [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              intent,
              exercise: context.exercise || "",
              word,
              attempts: context.attempts || 0,
              struggling: Boolean(context.struggling),
              helpAsked: Boolean(context.helpAsked),
              game: context.game || null,
              child: context.child || ""
            })
          }
        ]
      : [
          { role: "system", content: SYSTEM_PROMPT },
          ...(Array.isArray(body.messages) ? body.messages : []).map((message) => ({
            role: message.role,
            content: message.content
          }))
        ];

    if (!intent && !Array.isArray(body.messages)) {
      return res.status(400).json({ error: "Berichten ontbreken." });
    }

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        think: false,
        messages,
        options: {
          temperature: 0.4
        }
      })
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || `Ollama error: ${response.status}`);
    }

    const data = await response.json();
    const parsed = readModel(data.message?.content);

    if (intent) {
      const line = acceptLine(parsed && parsed.line, intent, word) || fallbackLine(intent, word);
      return res.json({ line, intent });
    }

    res.json({
      reply: shapeReply(data.message?.content)
    });
  } catch (error) {
    console.error("Margit connection error:", error.message);
    const intent = INTENTS.includes(req.body?.intent) ? req.body.intent : null;
    if (intent) {
      const word = req.body?.context?.word || "";
      return res.json({ line: fallbackLine(intent, word), intent });
    }
    res.status(500).json({
      error: "Margit kan nu niet antwoorden. Probeer het zo nog eens."
    });
  }
});

const keyPath = path.join(__dirname, "certs", "dev-key.pem");
const certPath = path.join(__dirname, "certs", "dev-cert.pem");
const hasCert = fs.existsSync(keyPath) && fs.existsSync(certPath);

if (hasCert) {
  https
    .createServer(
      {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      },
      app
    )
    .listen(3001, "0.0.0.0", () => {
      console.log("Margit server draait op https://0.0.0.0:3001");
    });
} else {
  app.listen(3001, "0.0.0.0", () => {
    console.log("Margit server draait op http://0.0.0.0:3001");
  });
}
