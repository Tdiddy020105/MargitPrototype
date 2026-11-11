import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  LETTER_ROUNDS,
  MEMORY_WORDS,
  SEARCH_WORDS,
  judgeLetter,
  lineFromDrag,
  makeMemory,
  makeWordSearch,
  matchesPlaced
} from "./games.js";

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export function GameChoice({ onPick, disabled }) {
  return (
    <div className="choices">
      <button type="button" disabled={disabled} onClick={() => onPick("woordzoeker")}>
        Woordzoeker
      </button>
      <button type="button" disabled={disabled} onClick={() => onPick("letter")}>
        Eén letter anders
      </button>
      <button type="button" disabled={disabled} onClick={() => onPick("memory")}>
        Memory
      </button>
    </div>
  );
}

export function WordSearch({ onSuccess, onMistake, disabled }) {
  const puzzle = useMemo(() => makeWordSearch(SEARCH_WORDS), []);
  const [found, setFound] = useState([]);
  const [active, setActive] = useState([]);
  const drag = useRef(null);
  const activeRef = useRef([]);

  function cellFrom(target) {
    const cell = target?.closest?.(".cell");
    if (!cell || cell.disabled) return null;
    return { r: Number(cell.dataset.r), c: Number(cell.dataset.c) };
  }

  function cellAt(event) {
    const direct = cellFrom(event.target);
    if (direct) return direct;
    const stack = document.elementsFromPoint?.(event.clientX, event.clientY) || [];
    for (const node of stack) {
      const pos = cellFrom(node);
      if (pos) return pos;
    }
    return null;
  }

  function pointerDown(event) {
    if (disabled || event.isPrimary === false) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const pos = cellAt(event);
    if (!pos) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer can end before capture */
    }
    drag.current = pos;
    activeRef.current = [pos];
    setActive([pos]);
  }

  function pointerMove(event) {
    if (!drag.current || disabled || event.isPrimary === false) return;
    const pos = cellAt(event);
    if (!pos) return;
    const line = lineFromDrag(drag.current, pos);
    if (!line) return;
    activeRef.current = line;
    setActive(line);
  }

  function pointerUp() {
    if (!drag.current) return;
    const cells = activeRef.current;
    drag.current = null;
    activeRef.current = [];
    setActive([]);
    if (cells.length < 2) return;
    const hit = matchesPlaced(puzzle.placed, cells);
    if (hit) {
      if (found.includes(hit.word)) return;
      setFound((current) => [...current, hit.word]);
      onSuccess(`Woordzoeker. Het kind vond "${hit.word}". Eén korte blije zin, zonder les.`);
      return;
    }
    const letters = cells.map((cell) => puzzle.grid[cell.r][cell.c]).join("");
    onMistake(
      `Woordzoeker. De selectie was "${letters}". Dat is niet een van de woorden. Geef het woord niet prijs.`
    );
  }

  const foundCells = new Set(
    puzzle.placed
      .filter((item) => found.includes(item.word))
      .flatMap((item) => item.cells.map((cell) => `${cell.r},${cell.c}`))
  );
  const activeCells = new Set(active.map((cell) => `${cell.r},${cell.c}`));

  return (
    <div className="game">
      <ul className="word-list">
        {SEARCH_WORDS.map((word) => (
          <li key={word} className={found.includes(word) ? "found" : ""}>
            {word}
          </li>
        ))}
      </ul>
      <div
        className="grid"
        role="grid"
        aria-label="Woordzoeker"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={() => {
          drag.current = null;
          activeRef.current = [];
          setActive([]);
        }}
      >
        {puzzle.grid.map((row, r) =>
          row.map((letter, c) => {
            const id = `${r},${c}`;
            const marked = foundCells.has(id) || activeCells.has(id);
            return (
              <button
                key={id}
                type="button"
                role="gridcell"
                data-r={r}
                data-c={c}
                className={marked ? "cell on" : "cell"}
                disabled={disabled}
              >
                {letter}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export const LetterGame = forwardRef(function LetterGame(
  { onSuccess, onMistake, disabled },
  ref
) {
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState("");
  const submitRef = useRef(() => {});
  const round = LETTER_ROUNDS[index % LETTER_ROUNDS.length];

  function submit(raw) {
    const result = judgeLetter(round.start, raw, round.answers);
    if (result.reason === "empty") return;
    const word = raw.trim().toLowerCase();
    setAttempt("");
    if (result.ok) {
      setIndex((current) => current + 1);
      onSuccess(
        `Eén letter anders. Startwoord "${round.start}". Het kind maakte "${word}". Dat klopt. Eén korte blije zin. Spel het antwoord niet.`
      );
      return;
    }
    const hint =
      result.reason === "same"
        ? "Het kind veranderde geen letter."
        : result.reason === "length"
          ? "Het nieuwe woord moet even lang blijven."
          : "Het is niet één letter verschil met een echt woord.";
    onMistake(
      `Eén letter anders. Startwoord "${round.start}". Poging "${word}". ${hint} Geef het antwoord niet.`
    );
  }

  useEffect(() => {
    submitRef.current = submit;
  });

  useImperativeHandle(
    ref,
    () => ({
      tryWord(raw) {
        submitRef.current(raw);
      }
    }),
    []
  );

  return (
    <div className="game letter-game">
      <p className="prompt-word">{round.start}</p>
      <p className="attempt" aria-label="Jouw woord">
        {attempt || "…"}
      </p>
      <div className="keys">
        {KEY_ROWS.map((row) => (
          <div className="key-row" key={row}>
            {[...row].map((letter) => (
              <button
                key={letter}
                type="button"
                disabled={disabled}
                onClick={() => setAttempt((current) => (current + letter).slice(0, 8))}
              >
                {letter}
              </button>
            ))}
          </div>
        ))}
        <div className="key-row">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setAttempt((current) => current.slice(0, -1))}
          >
            weg
          </button>
          <button type="button" disabled={disabled} onClick={() => submit(attempt)}>
            klaar
          </button>
        </div>
      </div>
    </div>
  );
});

export function MemoryGame({ onSuccess, onMistake, disabled }) {
  const deck = useMemo(() => makeMemory(MEMORY_WORDS), []);
  const [up, setUp] = useState([]);
  const [matched, setMatched] = useState([]);
  const lock = useRef(false);
  const timer = useRef(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function flip(card) {
    if (disabled || lock.current) return;
    if (up.includes(card.id) || matched.includes(card.word)) return;
    const next = [...up, card.id];
    if (next.length > 2) return;
    setUp(next);
    if (next.length < 2) return;

    const [first, second] = next.map((id) => deck.find((item) => item.id === id));
    if (first.word === second.word) {
      setMatched((current) => [...current, first.word]);
      setUp([]);
      onSuccess(`Memory. Het kind vond het paar "${first.word}". Eén korte blije zin.`);
      return;
    }

    lock.current = true;
    onMistake(
      `Memory. Het kind draaide "${first.word}" en "${second.word}". Dat is geen paar. Eén bemoedigende zin, geen oordeel.`
    );
    timer.current = window.setTimeout(() => {
      setUp([]);
      lock.current = false;
    }, 1200);
  }

  return (
    <div className="game memory">
      {deck.map((card) => {
        const open = up.includes(card.id) || matched.includes(card.word);
        return (
          <button
            key={card.id}
            type="button"
            className={open ? "card open" : "card"}
            disabled={disabled || open}
            onClick={() => flip(card)}
            aria-label={open ? card.word : "Dichte kaart"}
          >
            {open ? card.word : ""}
          </button>
        );
      })}
    </div>
  );
}
