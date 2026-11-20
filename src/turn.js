import { missLimit } from "./games.js";

export const SPELL_ORDER = ["boom", "kat", "zon", "vis"];

export const LINES = {
  greet:
    "Hoi! Wat leuk dat je er bent! Ik ben Margit. Ik ben een computerprogramma waarmee je kunt oefenen met lezen en spellen. Zullen we samen iets leuks doen?",
  mood: "Hoe gaat het met je?",
  praise: "Ja! Helemaal goed. Knap gedaan!",
  mistake: "Goed geprobeerd! Zullen we nog eens naar de eerste letter kijken?",
  help: "Ik help je wel! Luister eens goed naar de eerste klank.",
  hard: "Dat geeft helemaal niet. Misschien kunnen we iets anders proberen.",
  offer: "Dit is een lastig woord. Kies maar: memory, woordzoeker of één letter anders.",
  chat: "Hoi! Wat leuk dat je er bent!"
};

const INTENTS = ["praise", "mistake", "help", "hard", "offer", "spell", "chat"];

export function spellLine(word) {
  return `Spel het woord ${word}.`;
}

export function fallbackLine(intent, word) {
  if (intent === "spell") return spellLine(word || SPELL_ORDER[0]);
  return LINES[intent] || LINES.chat;
}

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

function namesAGame(line) {
  const value = fold(line);
  return (
    value.includes("memory") ||
    value.includes("woordzoeker") ||
    value.includes("letter anders") ||
    value.includes("een letter")
  );
}

function namesAllGames(line) {
  const value = fold(line);
  return value.includes("memory") && value.includes("woordzoeker") && value.includes("letter");
}

function counsels(line) {
  return /gevoelens|erover praten|ik ben er voor je|dat klinkt zwaar|hulpverlener|therap/i.test(
    line
  );
}

function weirdGreeting(line) {
  return /\b(he|hey|hee) kind\b/.test(fold(line));
}

export function acceptLine(text, intent, word) {
  const line = String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!line || line.length > 280) return null;
  if (/[{}<>]|\bintent\b|\bjson\b/i.test(line)) return null;
  if (counsels(line) || weirdGreeting(line)) return null;
  const sentences = line.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 3) return null;
  if ((intent === "mistake" || intent === "help" || intent === "hard" || intent === "praise") && mentionsWord(line, word)) {
    return null;
  }
  if (intent === "spell" && !mentionsWord(line, word)) return null;
  if (intent === "offer") return namesAllGames(line) ? line : null;
  if (namesAGame(line)) return null;
  return line;
}

// The app already chose the intent. A model payload can only supply the line.
export function spokenLine(payload, intent, word) {
  const data = payload && typeof payload === "object" ? payload : {};
  if (data.intent === intent && typeof data.line === "string") {
    const line = acceptLine(data.line, intent, word);
    if (line) return line;
  }
  if (!data.intent && typeof data.reply === "string") {
    const line = acceptLine(data.reply, intent, word);
    if (line) return line;
  }
  if (!INTENTS.includes(intent)) return fallbackLine("chat", word);
  return fallbackLine(intent, word);
}

export function nextStep({ correct = false, help = false, hard = false, misses = 0 } = {}) {
  if (help) return { intent: "help", misses, offer: false, advance: false };
  if (hard) return { intent: "hard", misses, offer: true, advance: true };
  if (correct) return { intent: "praise", misses: 0, offer: false, advance: true };
  const next = misses + 1;
  if (next >= missLimit()) return { intent: "offer", misses: next, offer: true, advance: true };
  return { intent: "mistake", misses: next, offer: false, advance: false };
}

const SENSITIVE = [
  /\bik ben zo verdrietig\b/,
  /\bik ben heel verdrietig\b/,
  /\bniemand houdt van mi?j\b/,
  /\b(ik word gepest|ze pesten me|ik word gepest)\b/,
  /\b(slaat me|slaat mij|doet me pijn|doet mij pijn|mishandel)\b/,
  /\b(ik wil dood|niet meer leven|zelfmoord)\b/,
  /\b(misbruik|seksueel|aanrand)\b/,
  /\bik ben bang voor\b/
];

export function hearSensitive(text) {
  const value = fold(text);
  if (!value) return false;
  return SENSITIVE.some((pattern) => pattern.test(value));
}
