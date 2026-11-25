const GRID = 8;

export const SEARCH_WORDS = ["kat", "zon", "vis", "boom"];

export const MEMORY_WORDS = ["kat", "zon", "vis"];

export const LETTER_ROUNDS = [
  { start: "kat", answers: ["kar", "rat", "kot", "kam", "kas", "lat"] },
  { start: "zon", answers: ["zot", "ton", "zin", "kon"] },
  { start: "vis", answers: ["vos", "vin", "wis"] },
  { start: "bos", answers: ["bot", "bol", "los", "bes", "bus"] },
  { start: "maan", answers: ["laan", "maar", "maas"] },
  { start: "boom", answers: ["boos", "boor", "room", "boog"] },
  { start: "peer", answers: ["beer", "pier", "pees"] },
  { start: "huis", answers: ["huid", "muis", "ruis"] }
];

export const GAME_NAMES = {
  woordzoeker: "woordzoeker",
  letter: "één letter anders",
  memory: "memory"
};

const MISS_LIMIT = 3;

export function missLimit() {
  return MISS_LIMIT;
}

export function hearTooHard(text) {
  return /te moeilijk|te lastig|niet meer|kan dit niet|iets anders|ander spel/.test(
    text.toLowerCase()
  );
}

export function hearHelp(text) {
  return /help|ik weet het niet|zeg jij het maar/.test(text.toLowerCase());
}

export function hearGame(text) {
  const t = text.toLowerCase();
  if (t.includes("woordzoeker") || t.includes("woord zoeker")) return "woordzoeker";
  if (t.includes("memory") || t.includes("geheugen")) return "memory";
  if (/een letter|één letter|letter anders/.test(t)) return "letter";
  return null;
}

export function wantsGame(text) {
  const game = hearGame(text);
  if (!game || hearTooHard(text)) return null;
  const words = text.trim().split(/\s+/);
  if (words.length <= 4) return game;
  if (/wil |kies |doen|spel/.test(text.toLowerCase())) return game;
  return null;
}

export function judgeLetter(start, attempt, answers) {
  const word = attempt.trim().toLowerCase();
  if (!word) return { ok: false, reason: "empty" };
  if (word === start) return { ok: false, reason: "same" };
  if (word.length !== start.length) return { ok: false, reason: "length" };
  if (answers.includes(word)) return { ok: true };
  return { ok: false, reason: "not-one" };
}

function canPlace(grid, letters, row, col, horizontal) {
  for (let i = 0; i < letters.length; i += 1) {
    const r = row + (horizontal ? 0 : i);
    const c = col + (horizontal ? i : 0);
    if (r < 0 || c < 0 || r >= GRID || c >= GRID) return false;
    const have = grid[r][c];
    if (have && have !== letters[i]) return false;
  }
  return true;
}

function writeWord(grid, letters, row, col, horizontal) {
  const cells = [];
  for (let i = 0; i < letters.length; i += 1) {
    const r = row + (horizontal ? 0 : i);
    const c = col + (horizontal ? i : 0);
    grid[r][c] = letters[i];
    cells.push({ r, c });
  }
  return cells;
}

function placeWord(grid, word, random) {
  const letters = [...word];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const horizontal = random() < 0.65;
    const row = horizontal
      ? Math.floor(random() * GRID)
      : Math.floor(random() * (GRID - letters.length + 1));
    const col = horizontal
      ? Math.floor(random() * (GRID - letters.length + 1))
      : Math.floor(random() * GRID);
    if (canPlace(grid, letters, row, col, horizontal)) {
      return writeWord(grid, letters, row, col, horizontal);
    }
  }

  for (const horizontal of [true, false]) {
    for (let row = 0; row < GRID; row += 1) {
      for (let col = 0; col < GRID; col += 1) {
        if (canPlace(grid, letters, row, col, horizontal)) {
          return writeWord(grid, letters, row, col, horizontal);
        }
      }
    }
  }

  return null;
}

export function makeWordSearch(words, random = Math.random) {
  const grid = Array.from({ length: GRID }, () => Array(GRID).fill(""));
  const placed = [];

  for (const word of words) {
    const cells = placeWord(grid, word, random);
    if (cells) placed.push({ word, cells });
  }

  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  for (let r = 0; r < GRID; r += 1) {
    for (let c = 0; c < GRID; c += 1) {
      if (!grid[r][c]) {
        grid[r][c] = alphabet[Math.floor(random() * alphabet.length)];
      }
    }
  }

  return { grid, placed };
}

export function lineFromDrag(start, end) {
  const dr = end.r - start.r;
  const dc = end.c - start.c;
  if (dr !== 0 && dc !== 0) return null;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  const sr = Math.sign(dr);
  const sc = Math.sign(dc);
  const cells = [];
  for (let i = 0; i <= steps; i += 1) {
    cells.push({ r: start.r + sr * i, c: start.c + sc * i });
  }
  return cells;
}

export function matchesPlaced(placed, cells) {
  if (!cells || cells.length < 2) return null;
  const key = cells.map((cell) => `${cell.r},${cell.c}`).join("|");
  return (
    placed.find((item) => {
      const forward = item.cells.map((cell) => `${cell.r},${cell.c}`).join("|");
      const backward = [...item.cells]
        .reverse()
        .map((cell) => `${cell.r},${cell.c}`)
        .join("|");
      return key === forward || key === backward;
    }) || null
  );
}

function foldActivity(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/é/g, "e")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lineAsksToSpell(text) {
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
  if (/\b(tik|typ)\b/.test(value) && /\bletters?\b/.test(value)) return true;
  return false;
}

function namedGames(value) {
  const found = [];
  if (value.includes("woordzoeker") || value.includes("woord zoeker")) found.push("zoek");
  if (value.includes("letter anders") || value.includes("andere letter")) found.push("letter");
  if (/\bmemory\b/.test(value)) found.push("memory");
  return found;
}

function refusesNamedGame(value, game) {
  const name = game === "zoek" ? "woordzoeker" : game === "memory" ? "memory" : "letter anders";
  return new RegExp(`${name} is te (moeilijk|lastig)`).test(value);
}

const LEAD_ORDER = ["zoek", "letter", "memory"];

const LEAD_LINE = {
  zoek: "We doen woordzoeker.",
  letter: "We doen één letter anders.",
  memory: "We doen memory."
};

export const SPELL_WORDS = ["kat", "zon", "vis", "boom"];

export const OPENING_LINE = "Hoi! Ik ben Margit.";

export function spellPrompt(word) {
  return `Spel het woord ${word}.`;
}

export function spellTargetFrom(text) {
  const value = foldActivity(text);
  const match = value.match(/\bwoord\s+([a-z]{2,})\b/);
  if (!match) return null;
  const word = match[1];
  if (word === "zoeken" || word === "zoeker" || word === "spel") return null;
  return word;
}

// The keyboard is only there while her latest line asks him to spell.
export function showsSpellPad(line, game) {
  return !game && activityFromText(line) === "spell";
}

export function spellingIsRight(target, attempt) {
  const wanted = foldActivity(target);
  const given = foldActivity(attempt);
  return Boolean(wanted) && wanted === given;
}

export function spellPraise(word) {
  return `Ja! Spel het woord ${word}.`;
}

// She picks the next game herself. Skip the one already open.
export function leadGame(current, step = 0) {
  const choices = LEAD_ORDER.filter((name) => name !== current);
  const list = choices.length ? choices : LEAD_ORDER;
  const index = ((step % list.length) + list.length) % list.length;
  return list[index];
}

export function gameLeadLine(name) {
  return LEAD_LINE[name] || LEAD_LINE.zoek;
}

// She leads. One named game opens that game. A list is not a menu.
// "Ik pak de kaartjes" does nothing until she names woordzoeker, één letter anders, or memory.
export function activityFromText(text) {
  const value = foldActivity(text);
  if (!value) return null;

  const found = namedGames(value);
  if (found.length === 1 && !refusesNamedGame(value, found[0])) return found[0];
  if (found.length > 0) return null;
  if (lineAsksToSpell(text)) return "spell";
  return null;
}

export function hearPlayMode(text) {
  const value = foldActivity(text);
  if (!value) return null;
  const against = /tegen (mij|jou|je|haar|elkaar)/.test(value);
  const together = /\bsamen\b/.test(value) || /tegen de klok|\bklok\b/.test(value);
  if (against && together) return null;
  if (against) return "tegen";
  if (together) return "samen";
  return null;
}

export function wantsToPlay(text) {
  const value = foldActivity(text);
  if (!value || hearTooHard(text) || hearPlayMode(text)) return false;
  return /\b(spel|spelen|spelletje|gamen)\b/.test(value);
}

export function margitPick(cards, known, taken, random = Math.random) {
  const closed = [];
  for (let index = 0; index < cards.length; index += 1) {
    if (!taken.includes(index)) closed.push(index);
  }
  const groups = new Map();
  for (const index of closed) {
    const word = known[index];
    if (!word) continue;
    const list = groups.get(word) || [];
    list.push(index);
    groups.set(word, list);
  }
  for (const indexes of groups.values()) {
    if (indexes.length >= 2) return [indexes[0], indexes[1]];
  }
  if (closed.length < 2) return closed.slice();
  const first = closed[Math.floor(random() * closed.length)];
  const word = known[first];
  if (word) {
    const match = closed.find((index) => index !== first && known[index] === word);
    if (match !== undefined) return [first, match];
  }
  const rest = closed.filter((index) => index !== first);
  return [first, rest[Math.floor(random() * rest.length)]];
}

export function makeMemory(words, random = Math.random) {
  const cards = words.flatMap((word) => [
    { id: `${word}-a`, word },
    { id: `${word}-b`, word }
  ]);

  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return cards;
}
