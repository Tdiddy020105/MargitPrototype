const express = require("express");
const os = require("os");

const app = express();
app.use(express.json());

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const MODEL = "margit:latest";
const PORT = Number(process.env.PORT || 3001);
const lan = process.argv.includes("--lan");
const host = lan ? "0.0.0.0" : "127.0.0.1";

const SYSTEM_PROMPT = `
Je bent Margit, een vriendelijke Nederlandse AI-leermaatje
voor kinderen met dyslexie. Je helpt met lezen en spellen.

- Spreek altijd Nederlands.
- Gebruik eenvoudige woorden en korte zinnen.
- Reageer vriendelijk op fouten, zonder oordeel.
- Moedig inzet en doorzettingsvermogen aan, niet alleen goede antwoorden.
- Geef bij een fout een kleine hint in plaats van direct het antwoord.
- Als een kind gefrustreerd raakt, erken dat en maak de taak kleiner.
- Vier echte vooruitgang op een rustige, oprechte manier.
- Herhaal niet steeds dezelfde vraag.
- Stel maximaal één vraag per antwoord.
- Geef alleen je uiteindelijke antwoord, geen denkproces.
`;

const MOMENTS = {
  greeting:
    "Het kind komt net binnen. Zeg één korte begroeting en vraag welk spel: woordzoeker, één letter anders, of memory. Geen uitleg.",
  "start-game":
    "Het kind heeft een spel gekozen. Zeg één korte zin om te beginnen. Geen uitleg.",
  success:
    "Het kind heeft het net goed. Eén korte blije zin. Geen les. Spel het antwoord niet. Hoogstens één vraag.",
  mistake:
    "Het kind heeft het net mis. Eén bemoedigende zin en één kleine volgende stap. Geef het antwoord niet. Geen oordeel. Zeg niet dat het fout is.",
  "too-hard":
    "Het kind loopt vast of zegt dat het te moeilijk is. Eén bemoedigende zin, en vraag welk spel: woordzoeker, één letter anders, of memory. Geen uitleg.",
  help:
    "Het kind vraagt om hulp. Eén vriendelijke zin en één kleine hint. Geef het hele antwoord niet.",
  chat:
    "Blijf in het spel. Eén korte Nederlandse zin. Geen uitleg."
};

if (lan) {
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
}

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
    const { messages, moment } = req.body || {};

    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: "Berichten ontbreken."
      });
    }

    const safeMessages = messages
      .filter(
        (message) =>
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string"
      )
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: message.content.slice(0, 1000)
      }));

    if (!safeMessages.length) {
      return res.status(400).json({
        error: "Berichten ontbreken."
      });
    }

    const momentHint = typeof moment === "string" ? MOMENTS[moment] : "";

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        think: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...(momentHint ? [{ role: "system", content: momentHint }] : []),
          ...safeMessages
        ],
        options: {
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || `Ollama error: ${response.status}`);
    }

    const data = await response.json();

    res.json({
      reply: data.message?.content || "Ik weet even niet wat ik moet zeggen."
    });
  } catch (error) {
    console.error("Margit connection error:", error.message);
    res.status(500).json({
      error: "Ik kan Ollama niet bereiken. Controleer of Ollama draait."
    });
  }
});

function lanAddresses() {
  const addresses = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      const family = net.family;
      if ((family === "IPv4" || family === 4) && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

const server = app.listen(PORT, host, () => {
  if (!lan) {
    console.log(`Margit server draait op http://127.0.0.1:${PORT}`);
    return;
  }

  const addresses = lanAddresses();
  console.log(`Margit-API op poort ${PORT}. Ollama blijft op deze PC.`);
  for (const address of addresses) {
    console.log(`http://${address}:${PORT}`);
  }
});

server.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
