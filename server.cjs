
const express = require("express");

const app = express();
app.use(express.json());

const OLLAMA_URL = "http://127.0.0.1:11434";
const MODEL = "margit:latest";

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
      reply: data.message?.content || "Ik weet even niet wat ik moet zeggen."
    });
  } catch (error) {
    console.error("Margit connection error:", error.message);
    res.status(500).json({
      error: "Ik kan Ollama niet bereiken. Controleer of Ollama draait."
    });
  }
});

app.listen(3001, "127.0.0.1", () => {
  console.log("Margit server draait op http://127.0.0.1:3001");
});
