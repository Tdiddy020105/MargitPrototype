
const express = require("express");

const app = express();
app.use(express.json());

const OLLAMA_URL = "http://127.0.0.1:11434";
const MODEL = "margit:latest";

const SYSTEM_PROMPT = `
Je bent Margit, een warm Nederlands leermaatje.
Je praat hardop met een kind over lezen en spellen.

- Praat Nederlands, in één of twee korte zinnen.
- Praat zoals je tegen een kind praat. Geen opstel en geen brief.
- Gebruik gewone, korte woorden.
- Prijs de inzet, ook als het nog niet lukt.
- Geef één kleine hint. Geef niet meteen het antwoord.
- Stel hoogstens één vraag.
- Als je het kind letters wilt laten proberen, vraag dat met een van deze woorden: spellen, schrijf, of welke letters. Zeg bijvoorbeeld: "Kun je zon spellen?" of "Schrijf kat." of "Welke letters zitten in vis?"
- Vraag wat het kind wil doen. Noem alleen woordzoeker, één letter anders, en memory.
- Geen preek, geen les en geen lange uitleg.
- Geen diagnose, geen therapie en geen medische claims.
- Alleen je antwoord, zonder denkproces.
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
