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
