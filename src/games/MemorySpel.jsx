import { useEffect, useRef, useState } from "react";
import { margitPick } from "../games.js";

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

function shuffleCards(list) {
  const next = list.map((card) => ({ ...card }));
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

function LessonMemory({ play, onBack, onReact }) {
  const [cards, setCards] = useState(() => shuffleCards(WORD_CARDS));
  const [open, setOpen] = useState([]);
  const [matched, setMatched] = useState([]);
  const [locked, setLocked] = useState(false);
  const [turn, setTurn] = useState("jij");
  const [scores, setScores] = useState({ jij: 0, margit: 0 });
  const [phase, setPhase] = useState(play === "samen" ? "samen" : "tegen");
  const [left, setLeft] = useState(20);
  const clockStarted = useRef(false);
  const waitRef = useRef(null);
  const knownRef = useRef({});
  const matchedRef = useRef([]);
  const cardsRef = useRef(cards);
  const phaseRef = useRef(phase);
  const applyRef = useRef(() => {});

  function startClock() {
    const nextCards = shuffleCards(WORD_CARDS);
    phaseRef.current = "klok";
    cardsRef.current = nextCards;
    matchedRef.current = [];
    knownRef.current = {};
    setPhase("klok");
    setCards(nextCards);
    setMatched([]);
    setOpen([]);
    setLocked(false);
    setLeft(20);
    if (onReact) onReact("clock");
  }

  useEffect(() => {
    applyRef.current = (first, second, who) => {
    const deck = cardsRef.current;
    const same = deck[first].pair === deck[second].pair;
    knownRef.current = {
      ...knownRef.current,
      [first]: deck[first].pair,
      [second]: deck[second].pair
    };
    setOpen([first, second]);
    if (same) {
      const nextMatched = [...matchedRef.current, first, second];
      matchedRef.current = nextMatched;
      setMatched(nextMatched);
      setScores((current) => ({ ...current, [who]: current[who] + 1 }));
      setOpen([]);
      const boardDone = nextMatched.length === deck.length;
      const startTimed = play === "samen" && phaseRef.current === "samen" && boardDone && !clockStarted.current;
      if (who === "jij" && onReact && !startTimed) onReact("celebrate");
      if (startTimed) {
        clockStarted.current = true;
        startClock();
      }
      return;
    }
    setLocked(true);
    if (who === "jij" && onReact) onReact("encourage");
    window.clearTimeout(waitRef.current);
    waitRef.current = window.setTimeout(() => {
      setOpen([]);
      setLocked(false);
      if (play === "tegen") setTurn(who === "jij" ? "margit" : "jij");
    }, 700);
    };
  });

  useEffect(() => () => window.clearTimeout(waitRef.current), []);

  useEffect(() => {
    cardsRef.current = cards;
    phaseRef.current = phase;
  }, [cards, phase]);

  useEffect(() => {
    if (play !== "tegen" || turn !== "margit" || locked || open.length) return undefined;
    if (matched.length >= cards.length) return undefined;
    const timer = window.setTimeout(() => {
      const pick = margitPick(cardsRef.current, knownRef.current, matchedRef.current, Math.random);
      if (pick.length < 2) return;
      applyRef.current(pick[0], pick[1], "margit");
    }, 800);
    return () => window.clearTimeout(timer);
  }, [play, turn, locked, open.length, matched.length, cards.length]);

  useEffect(() => {
    if (phase !== "klok" || left <= 0) return undefined;
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, left]);

  function pick(index) {
    if (locked || matched.includes(index) || open.includes(index)) return;
    if (play === "tegen" && turn !== "jij") return;
    if (phase === "klok" && left <= 0) return;
    const next = [...open, index];
    if (next.length < 2) {
      setOpen(next);
      knownRef.current = { ...knownRef.current, [index]: cards[index].pair };
      return;
    }
    applyRef.current(next[0], next[1], "jij");
  }

  const clockLabel = `0:${String(Math.max(left, 0)).padStart(2, "0")}`;

  return (
    <div className="game">
      <button type="button" className="starter" onClick={onBack}>
        Terug
      </button>
      <div className="score-row">
        {play === "tegen" ? (
          <>
            <span className={turn === "jij" ? "on" : ""}>Jij {scores.jij}</span>
            <span className={turn === "margit" ? "on" : ""}>Margit {scores.margit}</span>
          </>
        ) : phase === "klok" ? (
          <span className="on">{clockLabel}</span>
        ) : (
          <span className="on">Samen {scores.jij}</span>
        )}
      </div>
      <div className="pairs">
        {cards.map((card, index) => {
          const shown = open.includes(index) || matched.includes(index);
          const className = `card${open.includes(index) ? " open" : ""}${matched.includes(index) ? " matched" : ""}`;
          return (
            <button key={`${phase}-${card.pair}-${index}`} type="button" className={className} onClick={() => pick(index)}>
              {shown ? card.label : "?"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OpenMemory({ onBack, onReact }) {
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
        {finished ? "Klaar" : "Draai twee kaarten om."}
      </p>
      <button type="button" className="starter" onClick={clearBoard}>Opnieuw</button>
    </div>
  );
}

export default function MemorySpel({ onBack, onReact, play }) {
  if (play === "tegen" || play === "samen") {
    return <LessonMemory play={play} onBack={onBack} onReact={onReact} />;
  }
  return <OpenMemory onBack={onBack} onReact={onReact} />;
}
