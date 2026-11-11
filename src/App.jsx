import { useEffect, useRef, useState } from "react";
import "./App.css";
import Avatar from "./Avatar.jsx";
import { GameChoice, LetterGame, MemoryGame, WordSearch } from "./Games.jsx";
import { GAME_NAMES, hearHelp, hearTooHard, missLimit, wantsGame } from "./games.js";
import {
  MISTAKE_LINES,
  PREPARED,
  canListen,
  listenDutch,
  speakDutch,
  stopSpeaking,
  unlockSpeech
} from "./speech.js";

export default function App() {
  const [started, setStarted] = useState(false);
  const [pose, setPose] = useState("wave");
  const [phase, setPhase] = useState("choose");
  const [game, setGame] = useState(null);
  const [board, setBoard] = useState(0);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState("");
  const [visibleLine, setVisibleLine] = useState("");
  const [spoken, setSpoken] = useState("");
  const [pcOnline, setPcOnline] = useState(null);
  const [note, setNote] = useState("");

  const history = useRef([]);
  const misses = useRef(0);
  const turn = useRef(0);
  const handsFree = useRef(false);
  const stopListen = useRef(() => {});
  const letterRef = useRef(null);
  const onChild = useRef(() => {});
  const mistakeLine = useRef(0);

  useEffect(() => {
    let gone = false;
    fetch("/api/health")
      .then((response) => {
        if (!gone) setPcOnline(response.ok);
      })
      .catch(() => {
        if (!gone) setPcOnline(false);
      });
    return () => {
      gone = true;
      stopSpeaking();
      stopListen.current();
    };
  }, []);

  function closeMic() {
    stopListen.current();
    stopListen.current = () => {};
    setListening(false);
  }

  function openMic() {
    closeMic();
    if (!canListen()) {
      setNote("Deze browser heeft geen spraakherkenning. Typen kan nog.");
      handsFree.current = false;
      return;
    }
    setListening(true);
    stopListen.current = listenDutch({
      onResult: (text) => {
        closeMic();
        onChild.current(text);
      },
      onError: (error) => {
        closeMic();
        handsFree.current = false;
        if (error === "not-allowed") {
          setNote("De browser blokkeert de microfoon. Typen kan nog.");
        } else if (error === "network" || error === "unsupported" || error === "start") {
          setNote("Spraakherkenning lukt in deze browser niet. Typen kan nog.");
        }
      }
    });
  }

  async function react(moment, detail) {
    const mine = ++turn.current;
    closeMic();
    stopSpeaking();
    setBusy(true);
    setPose(moment === "greeting" ? "wave" : moment === "success" ? "cheer" : "talk");
    setVisibleLine("");

    const user = { role: "user", content: detail };
    const messages = [...history.current, user].slice(-8);
    let reply = PREPARED[moment] || PREPARED.chat;
    let fromPc = false;
    if (moment === "mistake") {
      reply = MISTAKE_LINES[mistakeLine.current % MISTAKE_LINES.length];
      mistakeLine.current += 1;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, moment }),
        signal: AbortSignal.timeout(8000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error(data.error || "geen antwoord");
      }
      reply = data.reply.trim();
      fromPc = true;
    } catch {
      fromPc = false;
    }

    if (mine !== turn.current) return;

    history.current = [...messages, { role: "assistant", content: reply }].slice(-8);
    setPcOnline(fromPc);
    setSpoken(reply);
    const voiced = await speakDutch(reply);
    if (mine !== turn.current) return;

    setVisibleLine(voiced ? "" : reply);
    if (!voiced) {
      await new Promise((resolve) => window.setTimeout(resolve, 900));
    }
    if (mine !== turn.current) return;

    setPose("idle");
    setBusy(false);
    if (handsFree.current) {
      window.setTimeout(() => {
        if (mine === turn.current && handsFree.current) openMic();
      }, 350);
    }
  }

  async function offerChoice(detail) {
    misses.current = 0;
    setGame(null);
    setPhase("choose");
    await react(
      "too-hard",
      `${detail} Eén bemoedigende zin, en vraag welk spel: woordzoeker, één letter anders of memory.`
    );
  }

  async function onMistake(detail) {
    misses.current += 1;
    if (misses.current >= missLimit()) {
      await offerChoice(`${detail} Dit is de derde keer.`);
      return;
    }
    await react("mistake", detail);
  }

  async function onSuccess(detail) {
    misses.current = 0;
    await react("success", detail);
  }

  async function startGame(id) {
    if (busy) return;
    misses.current = 0;
    setGame(id);
    setPhase("play");
    setBoard((current) => current + 1);
    await react(
      "start-game",
      `Het kind kiest ${GAME_NAMES[id]}. Eén korte zin om te beginnen. Geen uitleg.`
    );
  }

  async function onChildText(text) {
    const clean = text.trim();
    if (!clean || busy) return;
    const picked = wantsGame(clean);
    if (picked) {
      await startGame(picked);
      return;
    }
    if (hearTooHard(clean)) {
      await offerChoice(`Het kind zegt: "${clean}".`);
      return;
    }
    if (hearHelp(clean)) {
      await react(
        "help",
        `Het kind zegt: "${clean}". Spel: ${GAME_NAMES[game] || "nog geen"}. Eén kleine hint, niet het antwoord.`
      );
      return;
    }
    if (game === "letter" && phase === "play" && /^[a-z]+$/i.test(clean)) {
      letterRef.current?.tryWord(clean);
      return;
    }
    await react(
      "chat",
      `Het kind zegt: "${clean}". Spel: ${GAME_NAMES[game] || "nog geen keuze"}. Blijf in het spel. Eén korte zin.`
    );
  }

  useEffect(() => {
    onChild.current = onChildText;
  });

  async function begin() {
    unlockSpeech();
    setStarted(true);
    await react(
      "greeting",
      "Het kind is er. Eén korte begroeting en vraag welk spel: woordzoeker, één letter anders of memory."
    );
  }

  function onMic() {
    if (listening) {
      handsFree.current = false;
      closeMic();
      return;
    }
    turn.current += 1;
    stopSpeaking();
    unlockSpeech();
    setBusy(false);
    setPose("idle");
    handsFree.current = true;
    setNote("");
    openMic();
  }

  function onType(event) {
    event.preventDefault();
    const text = draft.trim();
    setDraft("");
    if (!text) return;
    handsFree.current = false;
    closeMic();
    onChildText(text);
  }

  const status =
    pcOnline === false
      ? "Ollama op deze PC reageert niet. Margit zegt een voorbereide zin."
      : "";

  let boardView = null;
  if (!started) {
    boardView = (
      <button className="begin" type="button" onClick={begin}>
        Begin
      </button>
    );
  } else if (phase === "choose" || !game) {
    boardView = <GameChoice onPick={startGame} disabled={busy} />;
  } else if (game === "woordzoeker") {
    boardView = (
      <WordSearch key={board} disabled={busy} onSuccess={onSuccess} onMistake={onMistake} />
    );
  } else if (game === "letter") {
    boardView = (
      <LetterGame
        key={board}
        ref={letterRef}
        disabled={busy}
        onSuccess={onSuccess}
        onMistake={onMistake}
      />
    );
  } else {
    boardView = (
      <MemoryGame key={board} disabled={busy} onSuccess={onSuccess} onMistake={onMistake} />
    );
  }

  return (
    <div className="demo">
      <p className="demo-status">{status}</p>
      {note && <p className="demo-note">{note}</p>}
      <div className="ipad">
        <div className="screen">
          <Avatar pose={pose} listening={listening} />
          <p className="sr-only" aria-live="polite">
            {spoken}
          </p>
          {visibleLine && <p className="visible-line">{visibleLine}</p>}
          {boardView}
          {started && (
            <form className="talk" onSubmit={onType}>
              <button type="button" onClick={onMic} aria-pressed={listening}>
                {listening ? "Stop" : "Microfoon"}
              </button>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Of typ een zin"
                aria-label="Of typ een zin"
              />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
