
const express = require("express");

const app = express();
app.use(express.json());

const OLLAMA_URL = "http://127.0.0.1:11434";
const MODEL = "margit:latest";

const INTENTS = ["praise", "mistake", "help", "hard", "offer", "spell", "chat"];

const FALLBACK = {
  praise: "Ja! Helemaal goed. Knap gedaan!",
  mistake: "Goed geprobeerd! Zullen we nog eens naar de eerste letter kijken?",
  help: "Ik help je wel! Luister eens goed naar de eerste klank.",
  hard: "Dat geeft helemaal niet. Misschien kunnen we iets anders proberen.",
  offer: "Dit is een lastig woord. Kies maar: memory, woordzoeker of één letter anders.",
  chat: "Wat fijn. Zullen we een woord spellen?"
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
Bij chat: reageer kort op wat het kind zei, zonder te counselen.
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

app.listen(3001, "127.0.0.1", () => {
  console.log("Margit server draait op http://127.0.0.1:3001");
});
