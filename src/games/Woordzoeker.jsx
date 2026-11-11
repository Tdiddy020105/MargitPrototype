import { useState } from "react";

const WORDS = ["zon", "kat", "boom", "vis"];

// Rij 1 zon, rij 2 kat, rij 4 boom, vis recht naar beneden in de laatste kolom.
const GRID = [
  ["Z", "O", "N", "L", "P", "E"],
  ["K", "A", "T", "R", "D", "V"],
  ["M", "U", "L", "E", "N", "I"],
  ["B", "O", "O", "M", "P", "S"],
  ["D", "E", "N", "L", "A", "R"],
  ["P", "U", "R", "I", "S", "T"]
];

function lineBetween(start, end) {
  const rowStep = end.row - start.row;
  const colStep = end.col - start.col;
  const steps = Math.max(Math.abs(rowStep), Math.abs(colStep));

  if (steps === 0) return null;
  if (rowStep !== 0 && colStep !== 0 && Math.abs(rowStep) !== Math.abs(colStep)) {
    return null;
  }

  const rowMove = rowStep === 0 ? 0 : rowStep / steps;
  const colMove = colStep === 0 ? 0 : colStep / steps;
  const cells = [];

  for (let step = 0; step <= steps; step += 1) {
    cells.push({
      row: start.row + rowMove * step,
      col: start.col + colMove * step
    });
  }

  return cells;
}

function readWord(cells) {
  return cells.map((cell) => GRID[cell.row][cell.col]).join("").toLowerCase();
}

function cellKey(cell) {
  return `${cell.row}-${cell.col}`;
}

export default function Woordzoeker({ onBack, onReact }) {
  const [foundWords, setFoundWords] = useState([]);
  const [foundCells, setFoundCells] = useState([]);
  const [start, setStart] = useState(null);
  const [note, setNote] = useState("Kies de eerste en de laatste letter.");

  function reset() {
    setFoundWords([]);
    setFoundCells([]);
    setStart(null);
    setNote("Kies de eerste en de laatste letter.");
    if (onReact) onReact();
  }

  function choose(row, col) {
    if (foundWords.length === WORDS.length) return;

    const cell = { row, col };
    if (!start) {
      setStart(cell);
      setNote("Kies nu de laatste letter.");
      return;
    }

    if (start.row === row && start.col === col) {
      setStart(null);
      setNote("Kies de eerste en de laatste letter.");
      return;
    }

    const line = lineBetween(start, cell);
    setStart(null);

    if (!line) {
      setNote("Kies een rechte lijn.");
      if (onReact) onReact("encourage", "Nog niet. Kies een rechte lijn.");
      return;
    }

    const forward = readWord(line);
    const backward = forward.split("").reverse().join("");
    const word = WORDS.find((item) => item === forward || item === backward);

    if (!word) {
      setNote("Dat staat niet in de lijst.");
      if (onReact) onReact("encourage", "Nog niet. Zoek een ander woord.");
      return;
    }

    if (foundWords.includes(word)) {
      setNote("Die heb je al.");
      if (onReact) onReact("encourage", "Die heb je al. Zoek verder.");
      return;
    }

    const nextWords = [...foundWords, word];
    setFoundWords(nextWords);
    setFoundCells([...foundCells, ...line.map(cellKey)]);
    const finished = nextWords.length === WORDS.length;
    setNote(
      finished
        ? "Goed gedaan! Je hebt alle woorden gevonden."
        : `Gevonden: ${word}.`
    );
    if (onReact) {
      onReact(
        "celebrate",
        finished ? "Knap gedaan! Alle woorden gevonden." : `Ja! Je vond ${word}.`
      );
    }
  }

  const found = new Set(foundCells);

  return (
    <div className="game">
      <button type="button" className="starter" onClick={onBack}>Terug naar praten</button>
      <h2>Woordzoeker</h2>
      <p className="hint">Zoek de woorden in een rechte lijn. Horizontaal, verticaal of schuin.</p>
      <ul className="word-list">
        {WORDS.map((word) => (
          <li key={word} className={foundWords.includes(word) ? "got" : ""}>{word}</li>
        ))}
      </ul>
      <div className="letter-grid">
        {GRID.flatMap((letters, row) => letters.map((letter, col) => {
          const key = `${row}-${col}`;
          const picked = start && start.row === row && start.col === col;
          return (
            <button
              key={key}
              type="button"
              className={`cell${picked ? " picked" : ""}${found.has(key) ? " found" : ""}`}
              onClick={() => choose(row, col)}
            >
              {letter}
            </button>
          );
        }))}
      </div>
      <p className="game-note" role="status">{note}</p>
      <button type="button" className="starter" onClick={reset}>Opnieuw</button>
    </div>
  );
}
