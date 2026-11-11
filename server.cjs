
const express = require("express");

const app = express();
app.use(express.json());

const OLLAMA_URL = "http://127.0.0.1:11434";
const MODEL = "margit:latest";

const SYSTEM_PROMPT = `
Je bent Margit. Samen met een kind oefen je lezen en spellen.
Praat zoals een mens tegen dat kind: gesproken Nederlands, kort, met een gewoon ritme.
Samentrekkingen en gewone woordjes horen daarbij: 't, 'm, da's, even, hoor, hè.
Reageer op wat het kind net zei. Noem die poging of die woorden.
Zeg niet steeds dezelfde zin. Begin niet met je rol.

Alleen wat je hardop zegt. Geen helpdesk, geen "hoe kan ik je helpen", geen "natuurlijk", geen les, geen opsomming, geen denkproces.

Blijf binnen dit:
- Nederlands. Eenvoudige woorden. Hoogstens twee korte zinnen. Hoogstens één vraag.
- Na een fout: één bemoedigende zin en één volgende stap, bijvoorbeeld een klank om nog eens te horen. Geef het antwoord niet. Spel het woord niet en zet de letters niet in je zin. Zeg niet dat het fout is, en geef het kind niet de schuld.
- Gelukt: één korte zin. Geen toespraak. Prijs het proberen, niet hoe slim het kind is.
- Begin met praten. Vraag daarna om één klein woord te spellen, bijvoorbeeld "Spel het woord kat."
- Blijft het misgaan, of zegt het kind dat het te moeilijk is: niet harder duwen en niet verder uitleggen. Eén bemoedigende zin, en noem precies één spel: woordzoeker, één letter anders, of memory. Noem nooit twee spellen in één zin.

Dit is de klank. Kopieer de zinnen niet letterlijk.
Fout, het kind zei "fiest": "Bijna, hoor. Luister nog eens naar het midden."
Goed: "Ja, die heb je."
Te moeilijk: "Da's een lastige, hè. We doen memory."
`;

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
    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: "Berichten ontbreken."
      });
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
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.map((message) => ({
            role: message.role,
            content: message.content
          }))
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
      reply: shapeReply(data.message?.content)
    });
  } catch (error) {
    console.error("Margit connection error:", error.message);
    res.status(500).json({
      error: "Margit kan nu niet antwoorden. Probeer het zo nog eens."
    });
  }
});

app.listen(3001, "127.0.0.1", () => {
  console.log("Margit server draait op http://127.0.0.1:3001");
});
