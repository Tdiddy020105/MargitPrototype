import { useEffect, useRef, useState } from "react";
import "./App.css";
import MargitFigure from "./MargitFigure.jsx";
import {
  CHAT_TIMEOUT_MS,
  DUTCH_VOICE_LINE,
  isAppleMobile,
  listensAfterReply,
  pickDutchVoice,
  recognitionSettings,
  voiceLangIsDutch
} from "./speech.js";
import { hearHelp, hearTooHard, spellingIsRight } from "./games.js";
import { poseForTurn } from "./clips.js";
import {
  LINES,
  SPELL_ORDER,
  hearSensitive,
  nextStep,
  spokenLine
} from "./turn.js";
import EenLetter from "./games/EenLetter.jsx";
import MemorySpel from "./games/MemorySpel.jsx";
import Woordzoeker from "./games/Woordzoeker.jsx";

const AVATARS = {
  idle: "/img/Margit%20Idle.png",
  talk: "/img/Margit%20Talking.png",
  talking: "/img/Margit%20Talking.png",
  cheer: "/img/Margit%20Encourage.png",
  encourage: "/img/Margit%20Encourage.png",
  wave: "/img/Margit%20Idle.png",
  celebrate: "/img/Margit%20Celebrate.png"
};

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

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

function recognitionSupported() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

function chatSignal() {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(CHAT_TIMEOUT_MS);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  return controller.signal;
}

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
        Klaar
      </button>
    </form>
  );
}

function MargitAvatar({ mode }) {
  const picture = AVATARS[mode] || AVATARS.idle;
  return (
    <div className={`avatar ${mode || "idle"}`}>
      <MargitFigure mode={mode || "idle"} src={picture} />
    </div>
  );
}

export default function App() {
  const [flow, setFlow] = useState("hello");
  const [game, setGame] = useState(null);
  const [keysOpen, setKeysOpen] = useState(false);
  const [spelled, setSpelled] = useState("");
  const [hearing, setHearing] = useState(false);
  const [micNote, setMicNote] = useState("");
  const [muted, setMuted] = useState(false);
  const [avatarMode, setAvatarMode] = useState("wave");
  const [voicesReady, setVoicesReady] = useState(false);
  const [femaleVoice, setFemaleVoice] = useState(false);

  const flowRef = useRef("hello");
  const gameRef = useRef(null);
  const wordIndex = useRef(0);
  const missesRef = useRef(0);
  const helpAsked = useRef(false);
  const flowEpoch = useRef(0);
  const startedRef = useRef(false);
  const beginSessionRef = useRef(() => {});
  const speakDone = useRef(null);
  const mutedRef = useRef(false);
  const voicesRef = useRef([]);
  const speakId = useRef(0);
  const speakTimer = useRef(null);
  const speechUnlocked = useRef(false);
  const listenRef = useRef(null);
  const listenId = useRef(0);
  const hearingRef = useRef(false);
  const phaseRef = useRef("idle");
  const listenWait = useRef(null);
  const heardDraft = useRef("");
  const pendingSpeak = useRef(null);
  const speakReplyRef = useRef(() => false);
  const replyEpoch = useRef(0);
  const speechOk = speechSupported();
  const canListen = recognitionSupported();

  const showKeys = flow === "spell" && keysOpen && !game;

  function setFlowBoth(next) {
    flowRef.current = next;
    setFlow(next);
  }

  function bump() {
    flowEpoch.current += 1;
    return flowEpoch.current;
  }

  function currentWord() {
    return SPELL_ORDER[wordIndex.current % SPELL_ORDER.length];
  }

  function lineContext(word, attempts, asked, child) {
    return {
      exercise: flowRef.current === "mood" || flowRef.current === "hello" ? "gesprek" : "spelling",
      word: word || "",
      attempts: attempts || 0,
      struggling: (attempts || 0) >= 2,
      helpAsked: Boolean(asked),
      game: gameRef.current,
      child: child || ""
    };
  }

  useEffect(() => {
    return () => {
      listenId.current += 1;
      if (listenWait.current) clearTimeout(listenWait.current);
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
      if (!chosen || mutedRef.current) return;
      const job = pendingSpeak.current;
      if (!job || job.epoch !== replyEpoch.current) return;
      pendingSpeak.current = null;
      speakReplyRef.current(job.text, job.mode, job.onDone, job.epoch);
    };
    loadVoices(false);
    if (!isAppleMobile()) beginSessionRef.current();
    const onVoices = () => loadVoices(true);
    synth.addEventListener("voiceschanged", onVoices);
    const giveUp = setTimeout(() => loadVoices(true), 1200);
    return () => {
      clearTimeout(giveUp);
      synth.removeEventListener("voiceschanged", onVoices);
      speakId.current += 1;
      if (speakTimer.current) clearTimeout(speakTimer.current);
      synth.cancel();
    };
  }, [speechOk]);

  useEffect(() => {
    const arm = () => beginSessionRef.current();
    window.addEventListener("pointerdown", arm, true);
    return () => window.removeEventListener("pointerdown", arm, true);
  }, []);

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

  function stopSpeaking() {
    speakId.current += 1;
    const job = pendingSpeak.current;
    pendingSpeak.current = null;
    if (speakTimer.current) {
      clearTimeout(speakTimer.current);
      speakTimer.current = null;
    }
    if (speechOk) window.speechSynthesis.cancel();
    setAvatarMode(flowRef.current === "hello" ? "wave" : "idle");
    const done = speakDone.current;
    speakDone.current = null;
    if (done) done();
    else if (job && job.onDone) job.onDone();
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

  function speakReply(text, mode, onDone, epoch = replyEpoch.current) {
    if (!speechOk || mutedRef.current || !text.trim()) return false;
    const synth = window.speechSynthesis;
    const voice = currentVoice();
    if (!voice) {
      pendingSpeak.current = { text, mode, onDone, epoch };
      return false;
    }
    if (epoch !== replyEpoch.current) return false;
    pendingSpeak.current = null;

    const shouldCancel = speakId.current > 0;
    const id = speakId.current + 1;
    speakId.current = id;
    if (speakTimer.current) {
      clearTimeout(speakTimer.current);
      speakTimer.current = null;
    }
    if (shouldCancel) synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    try {
      utterance.voice = voice;
    } catch {
      return false;
    }
    utterance.lang = "nl-NL";

    let started = false;
    let finished = false;
    let giveUp = 0;
    let cap = 0;
    const finish = () => {
      if (finished || speakId.current !== id) return;
      finished = true;
      window.clearTimeout(giveUp);
      window.clearTimeout(cap);
      setAvatarMode("idle");
      if (onDone) onDone();
    };
    utterance.onstart = () => {
      if (finished || speakId.current !== id) return;
      started = true;
      setAvatarMode(mode);
    };
    utterance.onend = finish;
    utterance.onerror = finish;

    const delay = shouldCancel ? (isAppleMobile() ? 160 : 60) : 0;
    speakTimer.current = setTimeout(() => {
      if (speakId.current !== id || mutedRef.current) return;
      setAvatarMode(mode);
      try {
        synth.resume();
        synth.speak(utterance);
      } catch {
        finish();
        return;
      }
      giveUp = window.setTimeout(() => {
        if (speakId.current !== id || finished || started) return;
        if (synth.speaking) {
          started = true;
          return;
        }
        finish();
      }, 1200);
      cap = window.setTimeout(() => {
        if (speakId.current !== id || finished) return;
        finish();
      }, Math.min(24000, 2500 + text.length * 90));
    }, delay);
    return true;
  }

  speakReplyRef.current = speakReply;

  function speak(text, mode) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (speakDone.current === finish) speakDone.current = null;
        resolve();
      };
      speakDone.current = finish;
      if (speakReply(text, mode, finish)) return;
      if (pendingSpeak.current && pendingSpeak.current.text === text) {
        const earlier = pendingSpeak.current.onDone;
        pendingSpeak.current.onDone = () => {
          if (earlier) earlier();
          finish();
        };
        window.setTimeout(() => {
          if (!settled && pendingSpeak.current && pendingSpeak.current.text === text) {
            pendingSpeak.current = null;
            finish();
          }
        }, 1800);
        return;
      }
      finish();
    });
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
    haltRecognition();
    heardDraft.current = "";
    const id = listenId.current;
    phaseRef.current = "listening";
    markHearing(false);
    const apple = isAppleMobile();
    const kick = () => {
      if (listenId.current !== id || phaseRef.current !== "listening") return;
      const synth = speechOk ? window.speechSynthesis : null;
      if (synth && (synth.speaking || synth.pending) && kick.spins < 25) {
        kick.spins += 1;
        listenWait.current = setTimeout(kick, 80);
        return;
      }
      if (synth && (synth.speaking || synth.pending)) {
        try {
          synth.cancel();
        } catch {
          // The engine stayed busy. Start the listen anyway.
        }
      }
      openRecognizer(Ctor, id);
    };
    kick.spins = 0;
    if (apple) {
      if (speechOk) {
        try {
          window.speechSynthesis.resume();
        } catch {
          // Resume is best-effort inside the tap.
        }
      }
      openRecognizer(Ctor, id);
      return;
    }
    if (!speechUnlocked.current) unlockSpeech();
    listenWait.current = setTimeout(kick, 220);
  }

  function handleSilence() {
    phaseRef.current = "idle";
    markHearing(false);
    if (flowRef.current === "mood" || flowRef.current === "spell") {
      setMicNote("Ik hoorde niets. Probeer nog eens.");
    }
  }

  function takePhrase(text) {
    const trimmed = String(text || "").trim();
    phaseRef.current = "idle";
    if (!trimmed) {
      handleSilence();
      return;
    }
    setMicNote("");
    if (hearSensitive(trimmed)) {
      pauseForResearch();
      return;
    }
    if (flowRef.current === "hello" || flowRef.current === "mood") {
      replyThenSpell(trimmed);
      return;
    }
    if (flowRef.current === "spell") {
      if (hearHelp(trimmed)) {
        onHelp();
        return;
      }
      if (hearTooHard(trimmed)) {
        onHard();
      }
    }
  }

  function openRecognizer(Ctor, id) {
    if (listenId.current !== id || phaseRef.current !== "listening") return;
    const rec = new Ctor();
    listenRef.current = rec;
    const settings = recognitionSettings();
    rec.lang = "nl-NL";
    rec.interimResults = settings.interimResults;
    rec.continuous = settings.continuous;
    rec.maxAlternatives = 1;

    let handled = false;
    let latest = "";
    let silence = null;
    let grace = null;
    let watchdog = null;
    const clearTimers = () => {
      if (silence) clearTimeout(silence);
      if (grace) clearTimeout(grace);
      if (watchdog) clearTimeout(watchdog);
      silence = null;
      grace = null;
      watchdog = null;
    };
    const close = () => {
      if (handled || listenId.current !== id) return;
      handled = true;
      clearTimers();
      heardDraft.current = latest;
      listenRef.current = null;
      markHearing(false);
      if (latest.trim()) takePhrase(latest);
      else handleSilence();
    };
    const armSilence = () => {
      if (!settings.continuous) return;
      if (silence) clearTimeout(silence);
      silence = setTimeout(() => {
        if (handled || listenId.current !== id) return;
        try {
          rec.stop();
        } catch {
          close();
        }
        grace = setTimeout(() => {
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
      heardDraft.current = latest;
      if (latest) armSilence();
    };
    rec.onerror = (event) => {
      if (handled || listenId.current !== id) return;
      const code = event.error || "";
      if ((code === "aborted" || code === "no-speech") && !latest.trim()) {
        grace = setTimeout(() => {
          if (!handled && listenId.current === id) close();
        }, 500);
        return;
      }
      if (code === "aborted" || code === "no-speech" || latest.trim()) {
        close();
        return;
      }
      handled = true;
      clearTimers();
      listenRef.current = null;
      markHearing(false);
      phaseRef.current = "idle";
      setMicNote("De microfoon doet het niet. Probeer nog eens.");
    };
    rec.onend = () => {
      if (handled || listenId.current !== id) return;
      if (latest.trim()) {
        close();
        return;
      }
      grace = setTimeout(() => {
        if (!handled && listenId.current === id) close();
      }, 500);
    };
    watchdog = setTimeout(() => {
      if (handled || listenId.current !== id) return;
      try {
        rec.stop();
      } catch {
        close();
      }
      grace = setTimeout(() => {
        if (!handled && listenId.current === id) close();
      }, 500);
    }, isAppleMobile() ? 12000 : 20000);
    try {
      rec.start();
      markHearing(true);
      setMicNote("");
    } catch {
      handled = true;
      clearTimers();
      phaseRef.current = "idle";
      markHearing(false);
      setMicNote("De microfoon doet het niet. Probeer nog eens.");
    }
  }

  function onMic() {
    if (flowRef.current === "hello" || flowRef.current === "mood") bump();
    stopSpeaking();
    const text = heardDraft.current.trim();
    const busy = hearingRef.current || phaseRef.current === "listening";
    if (busy && text) {
      stopListening();
      takePhrase(text);
      return;
    }
    if (busy) stopListening();
    beginListen();
  }

  async function askLine(intent, context) {
    const word = context.word || "";
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          context,
          messages: [
            {
              role: "user",
              content: `Bedoeling: ${intent}. Woord: ${word}. Hij zei: ${context.child || ""}. Eén vriendelijke Nederlandse zin, zoals "Hoi! Wat leuk dat je er bent!". Zeg niet "hé kind" of "hey kind".`
            }
          ]
        }),
        signal: chatSignal()
      });
      const data = await response.json().catch(() => ({}));
      return spokenLine(data, intent, word);
    } catch {
      return spokenLine(null, intent, word);
    }
  }

  async function offerGames(ticket, word) {
    setKeysOpen(false);
    const line = await askLine("offer", lineContext(word, missesRef.current, helpAsked.current));
    if (ticket !== flowEpoch.current) return;
    setFlowBoth("offer");
    await speak(line, poseForTurn({ moment: "offer" }));
    if (ticket !== flowEpoch.current) return;
    setAvatarMode("idle");
  }

  async function beginWord(index) {
    const ticket = bump();
    stopListening();
    stopSpeaking();
    wordIndex.current = index;
    missesRef.current = 0;
    helpAsked.current = false;
    gameRef.current = null;
    setGame(null);
    setSpelled("");
    setKeysOpen(false);
    setFlowBoth("spell");
    const word = SPELL_ORDER[index % SPELL_ORDER.length];
    const line = await askLine("spell", lineContext(word, 0, false));
    if (ticket !== flowEpoch.current) return;
    setKeysOpen(true);
    await speak(line, poseForTurn({ moment: "spell" }));
    if (ticket !== flowEpoch.current) return;
    setAvatarMode("idle");
  }

  async function replyThenSpell(child) {
    const ticket = bump();
    stopListening();
    stopSpeaking();
    const line = await askLine("chat", lineContext("", 0, false, child));
    if (ticket !== flowEpoch.current) return;
    await speak(line, poseForTurn({ moment: "chat" }));
    if (ticket !== flowEpoch.current) return;
    await beginWord(wordIndex.current);
  }

  async function onHelp() {
    const ticket = bump();
    stopListening();
    stopSpeaking();
    helpAsked.current = true;
    setKeysOpen(false);
    const word = currentWord();
    const line = await askLine("help", lineContext(word, missesRef.current, true));
    if (ticket !== flowEpoch.current) return;
    await speak(line, poseForTurn({ moment: "help" }));
    if (ticket !== flowEpoch.current) return;
    const again = await askLine("spell", lineContext(word, missesRef.current, true));
    if (ticket !== flowEpoch.current) return;
    setKeysOpen(true);
    await speak(again, poseForTurn({ moment: "spell" }));
    if (ticket !== flowEpoch.current) return;
    setAvatarMode("idle");
  }

  async function onHard() {
    const ticket = bump();
    stopListening();
    stopSpeaking();
    setKeysOpen(false);
    const word = currentWord();
    const step = nextStep({ hard: true, misses: missesRef.current });
    missesRef.current = step.misses;
    const line = await askLine("hard", lineContext(word, missesRef.current, helpAsked.current));
    if (ticket !== flowEpoch.current) return;
    await speak(line, poseForTurn({ moment: "hard" }));
    if (ticket !== flowEpoch.current) return;
    await offerGames(ticket, word);
  }

  function pauseForResearch() {
    bump();
    stopListening();
    stopSpeaking();
    setKeysOpen(false);
    setFlowBoth("pause");
    setAvatarMode("idle");
  }

  function resume() {
    if (flowRef.current !== "pause") return;
    beginWord(wordIndex.current);
  }

  async function runHello() {
    const ticket = bump();
    setFlowBoth("hello");
    setAvatarMode("wave");
    await speak(LINES.greet, poseForTurn({ moment: "spell" }));
    if (ticket !== flowEpoch.current) return;
    await speak(LINES.mood, poseForTurn({ moment: "chat" }));
    if (ticket !== flowEpoch.current) return;
    setFlowBoth("mood");
    setAvatarMode("idle");
    if (listensAfterReply()) beginListen();
  }

  function beginSession() {
    if (startedRef.current || flowRef.current === "pause") return;
    startedRef.current = true;
    unlockSpeech();
    runHello();
  }

  beginSessionRef.current = beginSession;

  function toggleMute() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) stopSpeaking();
  }

  async function sendSpelling(event) {
    event.preventDefault();
    const attempt = spelled.trim();
    if (!attempt || flowRef.current !== "spell") return;
    setSpelled("");
    setKeysOpen(false);
    stopListening();
    const word = currentWord();
    const step = nextStep({
      correct: spellingIsRight(word, attempt),
      misses: missesRef.current
    });
    missesRef.current = step.misses;
    const ticket = bump();
    stopSpeaking();
    if (step.offer) {
      await offerGames(ticket, word);
      return;
    }
    const moment = step.intent === "praise" ? "success" : "mistake";
    const line = await askLine(step.intent, lineContext(word, step.misses, helpAsked.current, attempt));
    if (ticket !== flowEpoch.current) return;
    await speak(line, poseForTurn({ moment }));
    if (ticket !== flowEpoch.current) return;
    if (step.advance) {
      await beginWord(wordIndex.current + 1);
      return;
    }
    const again = await askLine("spell", lineContext(word, step.misses, helpAsked.current));
    if (ticket !== flowEpoch.current) return;
    setKeysOpen(true);
    await speak(again, poseForTurn({ moment: "spell" }));
    if (ticket !== flowEpoch.current) return;
    setAvatarMode("idle");
  }

  function chooseGame(name) {
    if (flowRef.current !== "offer") return;
    bump();
    stopListening();
    stopSpeaking();
    setKeysOpen(false);
    gameRef.current = name;
    setGame(name);
    setFlowBoth("game");
    setAvatarMode("idle");
  }

  function leaveGame() {
    gameRef.current = null;
    setGame(null);
    beginWord(wordIndex.current + 1);
  }

  function reactToGame(kind) {
    if (flowRef.current !== "game") return;
    if (kind === "celebrate") {
      speak(LINES.praise, poseForTurn({ moment: "success" }));
      return;
    }
    if (kind === "encourage") speak("Kijk nog eens.", poseForTurn({ moment: "mistake" }));
  }

  const showMic = !game && (flow === "hello" || flow === "mood" || flow === "spell");

  return (
    <div className="tablet">
      <div className="screen">
        <div className="app">
          <div className="stage">
            <div className="presence">
              <div className="intro">
                <div className="voice">
                  {!speechOk ? (
                    <p className="stem-note">Stem is niet beschikbaar</p>
                  ) : voicesReady && !femaleVoice ? (
                    <p className="stem-note">{DUTCH_VOICE_LINE}</p>
                  ) : femaleVoice ? (
                    <button type="button" className="stem" onClick={toggleMute} aria-pressed={muted}>
                      {muted ? "Stem aan" : "Stem uit"}
                    </button>
                  ) : null}
                </div>
              </div>
              <MargitAvatar mode={avatarMode} />
            </div>
            <section className="talk">
              {game === "zoek" && <Woordzoeker onBack={leaveGame} onReact={reactToGame} />}
              {game === "letter" && <EenLetter onBack={leaveGame} onReact={reactToGame} />}
              {game === "memory" && <MemorySpel onBack={leaveGame} onReact={reactToGame} />}
              {flow === "pause" && !game && (
                <div className="pause-panel">
                  <p className="pause-title">Pauze</p>
                  <button type="button" className="pause-go" onClick={resume}>
                    Verder
                  </button>
                </div>
              )}
              {showKeys && (
                <SpellPad
                  value={spelled}
                  disabled={hearing}
                  onType={(letter) => setSpelled((current) => `${current}${letter}`)}
                  onErase={() => setSpelled((current) => current.slice(0, -1))}
                  onSend={sendSpelling}
                />
              )}
              {flow === "offer" && !game && (
                <div className="choices">
                  <button type="button" className="choice" onClick={() => chooseGame("memory")}>
                    Memory
                  </button>
                  <button type="button" className="choice" onClick={() => chooseGame("zoek")}>
                    Woordzoeker
                  </button>
                  <button type="button" className="choice" onClick={() => chooseGame("letter")}>
                    Eén letter anders
                  </button>
                </div>
              )}
              {showMic && (
                <div className="converse">
                  {micNote ? (
                    <p className="listen-state" role="status">
                      {micNote}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="listen"
                    onClick={onMic}
                    disabled={!canListen}
                    aria-pressed={hearing}
                  >
                    {hearing ? "Ik luister…" : "Praat met Margit"}
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
