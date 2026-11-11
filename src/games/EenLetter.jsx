import { useState } from "react";

const ROUNDS = [
  {
    word: "kat",
    choices: ["kam", "hond", "boom"],
    answers: ["kam", "kap", "kas", "lat", "mat", "rat", "zat"]
  },
  {
    word: "zon",
    choices: ["ton", "huis", "kat"],
    answers: ["ton", "bon", "zin", "zot"]
  },
  {
    word: "boom",
    choices: ["boon", "vis", "zon"],
    answers: ["boon", "boos", "room"]
  }
];

function oneLetterApart(left, right) {
  if (left.length !== right.length) return false;

  let changes = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) changes += 1;
  }

  return changes === 1;
}

export default function EenLetter({ onBack, onReact }) {
  const [round, setRound] = useState(0);
  const [guess, setGuess] = useState("");
  const [note, setNote] = useState("Maak een nieuw woord. Verander precies één letter.");
  const [solved, setSolved] = useState(false);
  const [done, setDone] = useState(false);

  const current = ROUNDS[round];

  function reset() {
    setRound(0);
    setGuess("");
    setNote("Maak een nieuw woord. Verander precies één letter.");
    setSolved(false);
    setDone(false);
    if (onReact) onReact();
  }

  function judge(value) {
    if (done || solved) return;

    const word = value.trim().toLowerCase();
    if (!word) return;

    if (word === current.word) {
      setNote("Verander precies één letter.");
      if (onReact) onReact("encourage", "Verander precies één letter.");
      return;
    }

    const oneAway = oneLetterApart(current.word, word);
    if (!oneAway || !current.answers.includes(word)) {
      setNote(oneAway
        ? "Bijna. Dat woord ken ik hier niet."
        : "Nog niet. Verander precies één letter.");
      if (onReact) {
        onReact(
          "encourage",
          oneAway ? "Bijna. Probeer nog een woord." : "Nog niet. Verander één letter."
        );
      }
      return;
    }

    setGuess("");
    setSolved(true);
    const last = round === ROUNDS.length - 1;
    setNote(last
      ? "Klaar! Je hebt drie woorden gemaakt."
      : "Ja! Eén letter anders.");
    if (last) setDone(true);
    if (onReact) {
      onReact(
        "celebrate",
        last ? "Knap gedaan! Drie woorden gemaakt." : "Ja! Eén letter anders."
      );
    }
  }

  function nextRound() {
    setRound(round + 1);
    setSolved(false);
    setGuess("");
    setNote("Maak een nieuw woord. Verander precies één letter.");
    if (onReact) onReact();
  }

  return (
    <div className="game">
      <button type="button" className="starter" onClick={onBack}>Terug naar praten</button>
      <h2>Eén letter anders</h2>
      <p className="hint">Ronde {Math.min(round + 1, ROUNDS.length)} van {ROUNDS.length}. Verander één letter, zodat er een nieuw woord staat.</p>

      {!done && (
        <>
          <p className="puzzle-word">{current.word}</p>
          <div className="starter-row">
            {current.choices.map((choice) => (
              <button
                key={choice}
                type="button"
                className="starter"
                disabled={solved}
                onClick={() => judge(choice)}
              >
                {choice}
              </button>
            ))}
          </div>
          <form
            className="guess"
            onSubmit={(event) => {
              event.preventDefault();
              judge(guess);
            }}
          >
            <input
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              placeholder="Of typ een woord..."
              autoComplete="off"
              disabled={solved}
            />
            <button type="submit" disabled={solved || !guess.trim()}>Probeer</button>
          </form>
        </>
      )}

      <p className="game-note" role="status">{note}</p>

      {solved && !done && (
        <button type="button" className="starter" onClick={nextRound}>Volgende</button>
      )}
      {done && (
        <button type="button" className="starter" onClick={reset}>Opnieuw</button>
      )}
    </div>
  );
}
