import { useEffect, useRef, useState } from "react";

const WORD_CARDS = [
  { pair: "zon", label: "zon" },
  { pair: "boom", label: "boom" },
  { pair: "kat", label: "kat" },
  { pair: "vis", label: "vis" },
  { pair: "zon", label: "zon" },
  { pair: "kat", label: "kat" },
  { pair: "vis", label: "vis" },
  { pair: "boom", label: "boom" }
];

const MEANING_CARDS = [
  { pair: "zon", label: "zon" },
  { pair: "boom", label: "plant" },
  { pair: "zon", label: "licht" },
  { pair: "vis", label: "vis" },
  { pair: "kat", label: "dier" },
  { pair: "boom", label: "boom" },
  { pair: "vis", label: "water" },
  { pair: "kat", label: "kat" }
];

export default function MemorySpel({ onBack, onReact }) {
  const [mode, setMode] = useState("woord");
  const [open, setOpen] = useState([]);
  const [matched, setMatched] = useState([]);
  const [locked, setLocked] = useState(false);
  const timer = useRef(null);

  const cards = mode === "woord" ? WORD_CARDS : MEANING_CARDS;
  const finished = matched.length === cards.length;

  useEffect(() => () => clearTimeout(timer.current), []);

  function clearBoard() {
    clearTimeout(timer.current);
    setOpen([]);
    setMatched([]);
    setLocked(false);
    if (onReact) onReact();
  }

  function switchMode(next) {
    setMode(next);
    clearBoard();
  }

  function pick(index) {
    if (locked || matched.includes(index) || open.includes(index)) return;

    const nextOpen = [...open, index];
    if (nextOpen.length < 2) {
      setOpen(nextOpen);
      return;
    }

    setOpen(nextOpen);
    const same = cards[nextOpen[0]].pair === cards[nextOpen[1]].pair;

    if (same) {
      const nextMatched = [...matched, ...nextOpen];
      setMatched(nextMatched);
      setOpen([]);
      if (onReact) {
        onReact(
          "celebrate",
          nextMatched.length === cards.length
            ? "Knap gedaan! Alle paren gevonden."
            : "Goed zo! Een paar."
        );
      }
      return;
    }

    setLocked(true);
    if (onReact) onReact("encourage", "Nog niet. Probeer nog een keer.");
    timer.current = setTimeout(() => {
      setOpen([]);
      setLocked(false);
    }, 800);
  }

  return (
    <div className="game">
      <button type="button" className="starter" onClick={onBack}>Terug naar praten</button>
      <h2>Memory</h2>
      <p className="hint">
        {mode === "woord"
          ? "Zoek twee kaarten met hetzelfde woord."
          : "Zoek het woord en wat het betekent."}
      </p>
      <div className="starter-row mode-row">
        <button
          type="button"
          className="starter"
          aria-pressed={mode === "woord"}
          onClick={() => switchMode("woord")}
        >
          Zelfde woord
        </button>
        <button
          type="button"
          className="starter"
          aria-pressed={mode === "betekenis"}
          onClick={() => switchMode("betekenis")}
        >
          Woord en betekenis
        </button>
      </div>
      <div className="pairs">
        {cards.map((card, index) => {
          const shown = open.includes(index) || matched.includes(index);
          const className = `card${open.includes(index) ? " open" : ""}${matched.includes(index) ? " matched" : ""}`;
          return (
            <button
              key={`${mode}-${card.pair}-${card.label}-${index}`}
              type="button"
              className={className}
              onClick={() => pick(index)}
            >
              {shown ? card.label : "?"}
            </button>
          );
        })}
      </div>
      <p className="game-note" role="status">
        {finished ? "Goed gedaan! Je hebt alle paren gevonden." : "Draai twee kaarten om."}
      </p>
      <button type="button" className="starter" onClick={clearBoard}>Opnieuw</button>
    </div>
  );
}
