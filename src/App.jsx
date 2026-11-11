import { useEffect, useRef, useState } from "react";
import "./App.css";
import MargitFigure from "./MargitFigure.jsx";
import { DUTCH_VOICE_LINE, pickDutchVoice, voiceLangIsDutch } from "./speech.js";
import EenLetter from "./games/EenLetter.jsx";
import MemorySpel from "./games/MemorySpel.jsx";
import Woordzoeker from "./games/Woordzoeker.jsx";

const AVATARS = {
  idle: "/img/Margit%20Idle.png",
  talking: "/img/Margit%20Talking.png",
  celebrate: "/img/Margit%20Celebrate.png",
  encourage: "/img/Margit%20Encourage.png"
};

const CELEBRATE_PHRASES = [
  "goed gedaan",
  "goed zo",
  "wat knap",
  "knap gedaan",
  "knap van je",
  "mooi gedaan",
  "super gedaan",
  "wat goed",
  "het is gelukt",
  "helemaal goed",
  "helemaal juist",
  "precies goed",
  "goed gespeld",
  "trots op je",
  "gefeliciteerd",
  "hoera",
  "goed van je",
  "fijn gedaan",
  "goed uitgesproken",
  "mooi gedaan"
];

const ENCOURAGE_PHRASES = [
  "je kunt het",
  "je kan het",
  "probeer het nog",
  "probeer nog een keer",
  "probeer opnieuw",
  "niet erg",
  "het geeft niet",
  "geen probleem",
  "goed bezig",
  "blijf proberen",
  "je doet je best",
  "niet opgeven",
  "stap voor stap",
  "bijna goed",
  "je bent dichtbij",
  "rustig aan",
  "we doen het samen",
  "nog een keertje",
  "ik geloof in je",
  "goed geprobeerd",
  "je doet al"
];

function replyMood(text) {
  const value = text.toLowerCase();

  if (CELEBRATE_PHRASES.some((phrase) => value.includes(phrase))) {
    return "celebrate";
  }

  if (ENCOURAGE_PHRASES.some((phrase) => value.includes(phrase))) {
    return "encourage";
  }

  return "talking";
}

function voiceName(voice) {
  return (voice.name || "").toLowerCase();
}

function chooseVoice(voices) {
  const list = voices || [];
  const fenna = list.find(
    (voice) => voiceLangIsDutch(voice.lang) && voiceName(voice).includes("fenna")
  );
  return fenna || pickDutchVoice(list);
}

function speechSupported() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

function spokenText(text) {
  return text.replace(/[*_#]/g, " ").replace(/\s+/g, " ").trim();
}

function asksToSpell(text) {
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

  return false;
}

function gameFromSpeech(text) {
  const value = String(text || "")
    .toLowerCase()
    .replace(/é/g, "e")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) return null;
  if (value.includes("woordzoeker") || value.includes("woord zoeker")) return "zoek";
  if (value.includes("memory")) return "memory";
  if (
    value.includes("letter anders")
    || value.includes("een letter")
    || value.includes("1 letter")
    || value.includes("andere letter")
  ) {
    return "letter";
  }

  return null;
}

function isEcho(text) {
  const value = String(text || "").toLowerCase();
  return value.includes("wat wil je doen") || value.includes("wil je een ander spel");
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

function SpellPad({ value, disabled, onType, onErase, onSend }) {
  return (
    <form className="spell" onSubmit={onSend}>
      <p className={`spell-word${value ? "" : " empty"}`} aria-live="polite">
        {value || "tik de letters"}
      </p>
      <div className="keys">
        {LETTERS.map((letter) => (
          <button
            key={letter}
            type="button"
            className="key"
            disabled={disabled}
            onClick={() => onType(letter)}
          >
            {letter}
          </button>
        ))}
        <button type="button" className="key wis" disabled={disabled || !value} onClick={onErase}>
          wis
        </button>
      </div>
      <button type="submit" className="spell-send" disabled={disabled || !value.trim()}>
        Stuur mijn woord
      </button>
    </form>
  );
}

const OFFER = "Wat wil je doen? We kunnen woordzoeker, één letter anders, of memory spelen.";
const SWITCH_LINE = "Wil je een ander spel? Zeg woordzoeker, één letter anders, of memory.";

function recognitionSupported() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

function calmError(err) {
  const message = (err && err.message) || "";
  if (message && !/fetch|network|json|ollama|failed|unexpected/i.test(message)) {
    return message;
  }
  return "Margit kan nu niet antwoorden. Probeer het zo nog eens.";
}

function MargitAvatar({ mode, thinking }) {
  const pose = AVATARS[mode] ? mode : "idle";
  const figureMode = thinking && pose === "idle" ? "think" : pose;

  return (
    <div className={`avatar ${pose}`}>
      <MargitFigure mode={figureMode} src={AVATARS[pose]} />
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: OFFER
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [avatarMode, setAvatarMode] = useState("idle");
  const [voicesReady, setVoicesReady] = useState(false);
  const [femaleVoice, setFemaleVoice] = useState(false);
  const [game, setGame] = useState(null);
  const [hearing, setHearing] = useState(false);
  const [micNote, setMicNote] = useState("");
  const [spelled, setSpelled] = useState("");

  const mutedRef = useRef(false);
  const voicesRef = useRef([]);
  const speakId = useRef(0);
  const speakTimer = useRef(null);
  const reactionTimer = useRef(null);
  const speechUnlocked = useRef(false);
  const listenRef = useRef(null);
  const listenId = useRef(0);
  const gameRef = useRef(null);
  const loadingRef = useRef(false);
  const missesRef = useRef(0);
  const switchAskRef = useRef(false);
  const offeredRef = useRef(false);
  const childSpokeRef = useRef(false);
  const hearingRef = useRef(false);
  const phaseRef = useRef("idle");
  const listenWait = useRef(null);
  const messagesRef = useRef(messages);
  const speechOk = speechSupported();
  const canListen = recognitionSupported();

  const latestReply = [...messages].reverse().find((message) => message.role === "assistant");
  const spelling = Boolean(!game && latestReply && asksToSpell(latestReply.content));
  gameRef.current = game;
  loadingRef.current = loading;
  messagesRef.current = messages;
  hearingRef.current = hearing;

  useEffect(() => {
    setSpelled("");
  }, [latestReply && latestReply.content]);

  useEffect(() => {
    return () => {
      listenId.current += 1;
      if (listenWait.current) {
        clearTimeout(listenWait.current);
        listenWait.current = null;
      }
      const rec = listenRef.current;
      listenRef.current = null;
      if (!rec) return;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        // The page is already going away.
      }
    };
  }, []);

  useEffect(() => {
    if (!speechOk) return undefined;

    const synth = window.speechSynthesis;

    const loadVoices = (force) => {
      const voices = synth.getVoices();
      if (!voices.length && !force) return;

      voicesRef.current = voices;
      const chosen = chooseVoice(voices);
      setFemaleVoice(Boolean(chosen));
      setVoicesReady(true);
    };

    loadVoices(false);
    const onVoices = () => loadVoices(true);
    synth.addEventListener("voiceschanged", onVoices);
    const giveUp = setTimeout(() => loadVoices(true), 1200);

    return () => {
      clearTimeout(giveUp);
      synth.removeEventListener("voiceschanged", onVoices);
      speakId.current += 1;
      if (speakTimer.current) {
        clearTimeout(speakTimer.current);
        speakTimer.current = null;
      }
      if (reactionTimer.current) {
        clearTimeout(reactionTimer.current);
        reactionTimer.current = null;
      }
      synth.cancel();
    };
  }, [speechOk]);

  function haltRecognition() {
    listenId.current += 1;
    const rec = listenRef.current;
    listenRef.current = null;
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.abort();
    } catch {
      try {
        rec.stop();
      } catch {
        // The browser already closed this listen.
      }
    }
  }

  function clearListenWait() {
    if (listenWait.current) {
      clearTimeout(listenWait.current);
      listenWait.current = null;
    }
  }

  function markHearing(next) {
    hearingRef.current = next;
    setHearing(next);
  }

  function stopListening() {
    phaseRef.current = "idle";
    clearListenWait();
    haltRecognition();
    markHearing(false);
  }

  function beginListen() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      phaseRef.current = "idle";
      markHearing(false);
      setMicNote("Deze browser heeft geen microfoon.");
      return;
    }

    clearListenWait();
    stopSpeaking();
    haltRecognition();
    const id = listenId.current;
    phaseRef.current = "listening";
    markHearing(false);

    const kick = () => {
      if (listenId.current !== id || phaseRef.current !== "listening") return;
      const synth = speechOk ? window.speechSynthesis : null;
      if (synth && (synth.speaking || synth.pending)) {
        listenWait.current = setTimeout(kick, 80);
        return;
      }
      if (loadingRef.current) {
        phaseRef.current = "thinking";
        return;
      }
      openRecognizer(Ctor, id);
    };

    if (!speechUnlocked.current) unlockSpeech();
    listenWait.current = setTimeout(kick, 220);
  }

  function handleSilence(echo) {
    phaseRef.current = "idle";
    markHearing(false);
    if (switchAskRef.current) {
      switchAskRef.current = false;
      if (!echo) setMicNote("Ik hoorde niets. Probeer nog eens.");
      return;
    }
    if (!childSpokeRef.current && !offeredRef.current && !gameRef.current) {
      offeredRef.current = true;
      setMicNote("");
      askThenListen(OFFER);
      return;
    }
    if (!echo) setMicNote("Ik hoorde niets. Probeer nog eens.");
  }

  function takePhrase(text) {
    const trimmed = text.trim();
    if (!trimmed || isEcho(trimmed)) {
      handleSilence(!trimmed ? false : true);
      return;
    }

    childSpokeRef.current = true;
    phaseRef.current = "thinking";
    setMicNote("");

    const chosen = gameFromSpeech(trimmed);
    if (chosen) {
      switchAskRef.current = false;
      openGame(chosen);
      return;
    }

    if (gameRef.current || switchAskRef.current) {
      switchAskRef.current = false;
      phaseRef.current = "idle";
      return;
    }

    sendText(trimmed);
  }

  function openRecognizer(Ctor, id) {
    if (listenId.current !== id || phaseRef.current !== "listening") return;

    const rec = new Ctor();
    listenRef.current = rec;
    rec.lang = "nl-NL";
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    let handled = false;
    let latest = "";
    let silence = null;

    const close = () => {
      if (handled || listenId.current !== id) return;
      handled = true;
      if (silence) clearTimeout(silence);
      listenRef.current = null;
      markHearing(false);
      takePhrase(latest);
    };

    const armSilence = () => {
      if (silence) clearTimeout(silence);
      silence = setTimeout(() => {
        if (handled || listenId.current !== id) return;
        try {
          rec.stop();
        } catch {
          close();
        }
        setTimeout(() => {
          if (!handled && listenId.current === id) close();
        }, 400);
      }, 1100);
    };

    rec.onresult = (event) => {
      if (handled || listenId.current !== id) return;
      let finalText = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const piece = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += `${piece} `;
        else interim += piece;
      }
      latest = `${finalText}${interim}`.trim();
      if (latest) armSilence();
    };

    rec.onerror = (event) => {
      if (handled || listenId.current !== id) return;
      const code = event.error || "";
      if (code === "aborted") return;
      handled = true;
      if (silence) clearTimeout(silence);
      listenRef.current = null;
      markHearing(false);
      if (code === "no-speech") {
        handleSilence();
        return;
      }
      phaseRef.current = "idle";
      setMicNote("De microfoon doet het niet.");
    };

    rec.onend = () => {
      if (listenId.current !== id) return;
      close();
    };

    try {
      rec.start();
      markHearing(true);
      setMicNote("");
    } catch {
      handled = true;
      phaseRef.current = "idle";
      markHearing(false);
      setMicNote("De microfoon doet het niet.");
    }
  }

  function askThenListen(line) {
    clearListenWait();
    stopListening();
    speechUnlocked.current = true;
    phaseRef.current = "speaking";
    const spoke = speakReply(line, "talking", () => {
      if (phaseRef.current === "listening") return;
      beginListen();
    });
    if (!spoke) beginListen();
  }

  function onMic() {
    if (hearingRef.current) return;
    beginListen();
  }

  function stopSpeaking() {
    speakId.current += 1;
    if (speakTimer.current) {
      clearTimeout(speakTimer.current);
      speakTimer.current = null;
    }
    if (speechOk) window.speechSynthesis.cancel();
    setAvatarMode("idle");
  }

  function currentVoice() {
    const synth = window.speechSynthesis;
    const loaded = synth.getVoices();
    return chooseVoice(loaded.length ? loaded : voicesRef.current);
  }

  function unlockSpeech() {
    if (!speechOk || mutedRef.current || speechUnlocked.current) return;

    const voice = currentVoice();
    if (!voice) return;

    try {
      const primer = new SpeechSynthesisUtterance(" ");
      primer.volume = 0;
      primer.voice = voice;
      primer.lang = "nl-NL";
      window.speechSynthesis.speak(primer);
      speechUnlocked.current = true;
    } catch {
      speechUnlocked.current = false;
    }
  }

  function speakReply(text, mode, onDone) {
    if (!speechOk || mutedRef.current || !text.trim()) return false;

    const synth = window.speechSynthesis;
    const voice = currentVoice();
    if (!voice) return false;

    const shouldCancel = speakId.current > 0;
    const id = speakId.current + 1;
    speakId.current = id;

    if (speakTimer.current) {
      clearTimeout(speakTimer.current);
      speakTimer.current = null;
    }

    if (shouldCancel) {
      synth.cancel();
      setAvatarMode("idle");
    }

    const utterance = new SpeechSynthesisUtterance(text);

    try {
      utterance.voice = voice;
    } catch {
      return false;
    }

    utterance.lang = "nl-NL";

    let started = false;
    let finished = false;

    const finish = () => {
      if (finished || speakId.current !== id) return;
      finished = true;
      setAvatarMode("idle");
      if (onDone) onDone();
    };

    utterance.onstart = () => {
      if (speakId.current !== id) return;
      started = true;
      setAvatarMode(mode);
    };
    utterance.onend = finish;
    utterance.onerror = finish;

    // After cancel(), Chrome often drops a speak() call in the same turn.
    const delay = shouldCancel ? 60 : 0;

    speakTimer.current = setTimeout(() => {
      if (speakId.current !== id || mutedRef.current) return;

      setAvatarMode(mode);

      try {
        synth.speak(utterance);
      } catch {
        finish();
        return;
      }

      window.setTimeout(() => {
        if (speakId.current !== id || started) return;
        if (!synth.speaking && !synth.pending) finish();
      }, 1000);
    }, delay);

    return true;
  }

  function toggleMute() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) stopSpeaking();
  }

  async function sendText(text) {
    const trimmed = text.trim();
    if (!trimmed || loadingRef.current) return;

    unlockSpeech();
    loadingRef.current = true;

    const conversation = [
      ...messagesRef.current,
      { role: "user", content: trimmed }
    ];
    messagesRef.current = conversation;

    setMessages(conversation);
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ messages: conversation })
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.error || "Margit kan nu niet antwoorden. Probeer het zo nog eens.");
      }

      const reply = data.reply || "";

      const next = [
        ...conversation,
        { role: "assistant", content: reply }
      ];
      messagesRef.current = next;
      setMessages(next);

      const again = () => {
        if (phaseRef.current === "listening") return;
        if (gameRef.current) return;
        if (asksToSpell(reply)) {
          phaseRef.current = "idle";
          return;
        }
        beginListen();
      };

      try {
        const spoken = spokenText(reply);
        phaseRef.current = "speaking";
        if (spoken && speakReply(spoken, replyMood(reply), again)) return;
        stopSpeaking();
        again();
      } catch {
        stopSpeaking();
        again();
      }
    } catch (err) {
      phaseRef.current = "idle";
      setError(calmError(err));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  function sendSpelling(e) {
    e.preventDefault();
    const word = spelled.trim();
    if (!word || loading) return;
    stopListening();
    setSpelled("");
    sendText(word);
  }

  function clearReactionTimer() {
    if (reactionTimer.current) {
      clearTimeout(reactionTimer.current);
      reactionTimer.current = null;
    }
  }

  function endGameMoment() {
    clearReactionTimer();
    stopSpeaking();
  }

  function reactToGame(kind, line) {
    clearReactionTimer();

    if (!kind || !line) {
      missesRef.current = 0;
      endGameMoment();
      return;
    }

    if (kind === "celebrate") missesRef.current = 0;

    let spoken = line;
    let mode = kind;
    let follow = null;

    if (kind === "encourage") {
      missesRef.current += 1;
      if (missesRef.current >= 3) {
        missesRef.current = 0;
        switchAskRef.current = true;
        spoken = SWITCH_LINE;
        mode = "talking";
        follow = () => {
          if (gameRef.current && switchAskRef.current) beginListen();
        };
      }
    }

    unlockSpeech();

    if (speakReply(spoken, mode, follow || undefined)) return;

    if (follow) follow();
    setAvatarMode(mode);
    reactionTimer.current = setTimeout(() => {
      reactionTimer.current = null;
      setAvatarMode("idle");
    }, 2400);
  }

  function openGame(name) {
    stopListening();
    endGameMoment();
    missesRef.current = 0;
    switchAskRef.current = false;
    gameRef.current = name;
    setGame(name);
  }

  function leaveGame() {
    stopListening();
    endGameMoment();
    missesRef.current = 0;
    switchAskRef.current = false;
    gameRef.current = null;
    setGame(null);
    offeredRef.current = true;
    askThenListen(OFFER);
  }

  return (
    <div className="tablet">
      <div className="screen">
        <div className="app">
          <div className="stage">
        <div className="presence">
          <div className="intro">
            <h1>Margit</h1>
            <div className="voice">
              {!speechOk ? (
                <p className="stem-note">Stem is niet beschikbaar</p>
              ) : voicesReady && !femaleVoice ? (
                <p className="stem-note">{DUTCH_VOICE_LINE}</p>
              ) : femaleVoice ? (
                <button
                  type="button"
                  className="stem"
                  onClick={toggleMute}
                  aria-pressed={muted}
                >
                  {muted ? "Stem aan" : "Stem uit"}
                </button>
              ) : null}
            </div>
          </div>
          <MargitAvatar mode={avatarMode} thinking={loading} />
          {!game && spelling && (
            <SpellPad
              value={spelled}
              disabled={loading}
              onType={(letter) => setSpelled((current) => `${current}${letter}`)}
              onErase={() => setSpelled((current) => current.slice(0, -1))}
              onSend={sendSpelling}
            />
          )}
        </div>

        <section className="talk">
          {game === "zoek" && <Woordzoeker onBack={leaveGame} onReact={reactToGame} />}
          {game === "letter" && <EenLetter onBack={leaveGame} onReact={reactToGame} />}
          {game === "memory" && <MemorySpel onBack={leaveGame} onReact={reactToGame} />}

          <div className="converse">
            <button
              type="button"
              className="listen"
              onClick={onMic}
              disabled={!canListen}
              aria-pressed={hearing}
            >
              Praat met Margit
            </button>
            {!hearing && !canListen ? (
              <p className="listen-state">Deze browser heeft geen microfoon.</p>
            ) : !hearing && micNote ? (
              <p className="listen-state" role="status">{micNote}</p>
            ) : null}
            {error ? <p className="error" role="alert">{error}</p> : null}
          </div>
        </section>
          </div>
        </div>
      </div>
    </div>
  );
}
