import { useEffect, useRef, useState } from "react";
import "./App.css";
import { apiUrl, publicUrl } from "./api.js";
import MargitFigure from "./MargitFigure.jsx";
import { CHAT_TIMEOUT_MS, dutchBody, isAppleMobile, nextListenTick, playbackWaitMs } from "./speech.js";
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
  idle: publicUrl("/img/Margit%20Idle.png"),
  talk: publicUrl("/img/Margit%20Talking.png"),
  talking: publicUrl("/img/Margit%20Talking.png"),
  cheer: publicUrl("/img/Margit%20Encourage.png"),
  encourage: publicUrl("/img/Margit%20Encourage.png"),
  wave: publicUrl("/img/Margit%20Idle.png"),
  celebrate: publicUrl("/img/Margit%20Celebrate.png")
};

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

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

function recorderMime() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return "";
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
  const [muted, setMuted] = useState(false);
  const [avatarMode, setAvatarMode] = useState("wave");

  function setMicNote() {
    // Her lines are only played. They are not written on the screen.
  }

  const flowRef = useRef("hello");
  const gameRef = useRef(null);
  const wordIndex = useRef(0);
  const missesRef = useRef(0);
  const helpAsked = useRef(false);
  const flowEpoch = useRef(0);
  const startedRef = useRef(false);
  const tapStamp = useRef(0);
  const beginSessionRef = useRef(() => {});
  const speakDone = useRef(null);
  const mutedRef = useRef(false);
  const speakId = useRef(0);
  const playerRef = useRef(null);
  const micState = useRef("unknown");
  const micStream = useRef(null);
  const micAsk = useRef(null);
  const micOnce = useRef(false);
  const listenRef = useRef(null);
  const meterRef = useRef(null);
  const listenId = useRef(0);
  const hearingRef = useRef(false);
  const phaseRef = useRef("idle");
  const listenWait = useRef(null);
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
      if (listenWait.current) {
        clearTimeout(listenWait.current);
        clearInterval(listenWait.current);
      }
      const rec = listenRef.current;
      listenRef.current = null;
      if (rec && typeof rec.abort === "function") rec.abort();
      releaseMic();
    };
  }, []);

  useEffect(() => {
    if (!isAppleMobile()) beginSessionRef.current();
  }, []);

  function haltRecognition() {
    listenId.current += 1;
    const rec = listenRef.current;
    listenRef.current = null;
    if (!rec || typeof rec.abort !== "function") return;
    try {
      rec.abort();
    } catch {
      // The capture was already closed.
    }
  }

  function clearListenWait() {
    if (listenWait.current) {
      clearTimeout(listenWait.current);
      clearInterval(listenWait.current);
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
    setMicEnabled(true);
  }

  function ensurePlayer() {
    if (!playerRef.current) {
      const audio = new Audio();
      audio.setAttribute("playsinline", "true");
      playerRef.current = audio;
    }
    return playerRef.current;
  }

  function unlockAudio() {
    const audio = ensurePlayer();
    if (audio.dataset.unlocked === "1") return;
    const existing = audio.getAttribute("src") || "";
    if (!existing) {
      audio.src = SILENT_WAV;
      const played = audio.play();
      if (played && typeof played.catch === "function") played.catch(() => {});
    }
    audio.dataset.unlocked = "1";
  }

  function stopSpeaking() {
    speakId.current += 1;
    const audio = playerRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      try {
        audio.load();
      } catch {
        // The player was already idle.
      }
    }
    setAvatarMode(flowRef.current === "hello" ? "wave" : "idle");
    const done = speakDone.current;
    speakDone.current = null;
    if (done) done();
  }

  function speakReply(text, mode, onDone) {
    const line = String(text || "").trim();
    if (!line) return false;
    const id = speakId.current + 1;
    speakId.current = id;
    if (mutedRef.current) {
      setMicNote("De stem staat uit.");
      if (onDone) onDone(false);
      return true;
    }
    const audio = ensurePlayer();
    let playbackCap = 0;
    let closed = false;
    const clearPlayback = () => window.clearTimeout(playbackCap);
    const succeed = () => {
      if (closed || speakId.current !== id) return;
      closed = true;
      clearPlayback();
      setAvatarMode(flowRef.current === "hello" ? "wave" : "idle");
      if (onDone) onDone(true);
    };
    const fail = (note) => {
      if (closed || speakId.current !== id) return;
      closed = true;
      clearPlayback();
      try {
        audio.pause();
      } catch {
        // The player was already idle.
      }
      setMicNote(note);
      if (onDone) onDone(false);
    };
    fetch(apiUrl("/api/speak"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: line })
    })
      .then(async (response) => {
        if (speakId.current !== id) return;
        if (!response.ok) {
          fail(dutchBody(await response.text(), "De stem doet het niet."));
          return;
        }
        const blob = await response.blob();
        if (speakId.current !== id) return;
        const url = URL.createObjectURL(blob);
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          URL.revokeObjectURL(url);
        };
        let armed = false;
        let started = false;
        const armWait = () => {
          if (!started) return;
          const wait = playbackWaitMs(audio.duration);
          if (wait >= 70000) return;
          clearPlayback();
          playbackCap = window.setTimeout(() => {
            succeed();
            release();
          }, wait);
        };
        audio.onended = () => {
          if (!armed || closed || speakId.current !== id) return;
          succeed();
          release();
        };
        audio.onerror = () => {
          if (!armed || closed || speakId.current !== id) return;
          fail("De stem wil niet afspelen.");
          release();
        };
        audio.onloadedmetadata = armWait;
        audio.ondurationchange = armWait;
        audio.src = url;
        armed = true;
        setAvatarMode(mode);
        const markStarted = () => {
          if (speakId.current !== id) return;
          started = true;
          armWait();
        };
        let played;
        try {
          played = audio.play();
        } catch {
          release();
          fail("De stem wil niet afspelen.");
          return;
        }
        if (played && typeof played.then === "function") {
          played.then(markStarted).catch((error) => {
            if (!armed || speakId.current !== id) return;
            if (error && error.name === "AbortError") return;
            release();
            fail("De stem wil niet afspelen.");
          });
        } else {
          markStarted();
        }
      })
      .catch(() => {
        fail("De stem doet het niet.");
      });
    return true;
  }

  function speak(text, mode) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(cap);
        if (speakDone.current === finish) speakDone.current = null;
        resolve(ok !== false);
      };
      const cap = window.setTimeout(() => {
        setMicNote("De stem wil niet afspelen.");
        finish(false);
      }, 70000);
      speakDone.current = finish;
      if (!speakReply(text, mode, finish)) finish(true);
    });
  }

  function denyMic() {
    stopListening();
    setMicNote("De microfoon mag niet.");
  }

  function micWasDenied(error) {
    const name = String((error && error.name) || "");
    return name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError";
  }

  function releaseMic() {
    const stream = micStream.current;
    if (!stream) return;
    for (const track of stream.getAudioTracks()) {
      try {
        track.stop();
      } catch {
        // The capture was already closed.
      }
    }
  }

  function askMicOnce() {
    if (micOnce.current) {
      if (micState.current === "allowed") return Promise.resolve(true);
      if (micAsk.current) return micAsk.current;
      return Promise.resolve(micState.current === "allowed");
    }
    micOnce.current = true;
    if (micState.current === "allowed") return Promise.resolve(true);
    if (micState.current === "denied") return Promise.resolve(false);
    if (micAsk.current) return micAsk.current;
    const media = navigator.mediaDevices;
    if (!media || typeof media.getUserMedia !== "function") {
      micState.current = "denied";
      denyMic();
      return Promise.resolve(false);
    }
    micState.current = "pending";
    let pending;
    try {
      pending = media.getUserMedia({ audio: true });
    } catch {
      micState.current = "denied";
      denyMic();
      return Promise.resolve(false);
    }
    micAsk.current = pending
      .then((stream) => {
        micStream.current = stream;
        micState.current = "allowed";
        return true;
      })
      .catch((error) => {
        micState.current = "denied";
        if (micWasDenied(error)) denyMic();
        else setMicNote("De microfoon doet het niet.");
        return false;
      });
    return micAsk.current;
  }

  function setMicEnabled(enabled) {
    const stream = micStream.current;
    if (!stream) return;
    for (const track of stream.getAudioTracks()) {
      if (track.readyState === "live") track.enabled = enabled;
    }
  }

  function liveMic() {
    const stream = micStream.current;
    if (!stream) return null;
    const live = stream.getAudioTracks().some((track) => track.readyState === "live");
    return live ? stream : null;
  }

  function prepareMeter() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!meterRef.current) {
      meterRef.current = { ctx: new Ctx(), analyser: null, data: null, stream: null };
    }
    const ctx = meterRef.current.ctx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return meterRef.current;
  }

  function connectMeter(stream) {
    const meter = prepareMeter();
    if (!meter) return null;
    if (meter.stream === stream && meter.analyser) return meter;
    const source = meter.ctx.createMediaStreamSource(stream);
    const analyser = meter.ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    meter.analyser = analyser;
    meter.data = new Uint8Array(analyser.fftSize);
    meter.stream = stream;
    return meter;
  }

  function meterIsLoud(meter) {
    if (!meter?.analyser || !meter.data) return false;
    meter.analyser.getByteTimeDomainData(meter.data);
    let sum = 0;
    const data = meter.data;
    for (let i = 0; i < data.length; i += 1) {
      const value = (data[i] - 128) / 128;
      sum += value * value;
    }
    return Math.sqrt(sum / data.length) >= 0.03;
  }

  function beginListen() {
    const stream = liveMic();
    clearListenWait();
    haltRecognition();
    const id = listenId.current;
    if (!stream || typeof MediaRecorder === "undefined") {
      phaseRef.current = "idle";
      markHearing(false);
      return;
    }
    phaseRef.current = "listening";
    markHearing(true);
    recordUntilWords(stream, id);
  }

  function recordUntilWords(stream, id) {
    if (listenId.current !== id || phaseRef.current !== "listening") return;
    const mime = recorderMime();
    let recorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      phaseRef.current = "idle";
      markHearing(false);
      return;
    }
    const chunks = [];
    let deliver = true;
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size) chunks.push(event.data);
    };
    const stopped = new Promise((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || mime || "application/octet-stream";
        resolve(deliver ? new Blob(chunks, { type }) : null);
      };
      recorder.onerror = () => resolve(null);
    });
    const stopRecorder = () => {
      if (recorder.state === "inactive") return;
      try {
        recorder.stop();
      } catch {
        // The capture was already closed.
      }
    };
    listenRef.current = {
      abort() {
        deliver = false;
        stopRecorder();
      }
    };
    const meter = connectMeter(stream);
    try {
      recorder.start(200);
    } catch {
      listenRef.current = null;
      phaseRef.current = "idle";
      markHearing(false);
      return;
    }
    const started = Date.now();
    let heard = false;
    let speechAt = started;
    let quietAt = started;
    const timer = window.setInterval(() => {
      if (listenId.current !== id) {
        window.clearInterval(timer);
        deliver = false;
        stopRecorder();
        return;
      }
      const loud = meter ? meterIsLoud(meter) : false;
      const now = Date.now();
      const decision = nextListenTick({
        heard,
        loud,
        waitMs: now - started,
        speechMs: heard ? now - speechAt : 0,
        quietMs: heard && !loud ? now - quietAt : 0
      });
      if (decision === "speech") {
        if (!heard) speechAt = now;
        heard = true;
        quietAt = now;
        return;
      }
      if (decision === "again") {
        window.clearInterval(timer);
        deliver = false;
        stopRecorder();
        stopped.then(() => {
          if (listenId.current === id && phaseRef.current === "listening") recordUntilWords(stream, id);
        });
        return;
      }
      if (decision === "send") {
        window.clearInterval(timer);
        stopRecorder();
        stopped.then((blob) => hearBlob(blob, stream, id));
      }
    }, 80);
    listenWait.current = timer;
  }

  async function hearBlob(blob, stream, id) {
    if (listenId.current !== id || phaseRef.current !== "listening") return;
    if (!blob || blob.size < 800) {
      recordUntilWords(stream, id);
      return;
    }
    let text = "";
    try {
      const response = await fetch(apiUrl("/api/hear"), {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
        signal: AbortSignal.timeout(60000)
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        text = String(data.text || "").trim();
      }
    } catch {
      text = "";
    }
    if (listenId.current !== id || phaseRef.current !== "listening") return;
    if (!text) {
      window.setTimeout(() => {
        if (listenId.current === id && phaseRef.current === "listening") recordUntilWords(stream, id);
      }, 400);
      return;
    }
    takePhrase(text);
  }

  function takePhrase(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;
    phaseRef.current = "idle";
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
        return;
      }
    }
    answerChild(trimmed);
  }

  function onMic() {
    const now = Date.now();
    if (now - tapStamp.current < 700) return;
    tapStamp.current = now;
    unlockAudio();
    prepareMeter();
    if (!startedRef.current) {
      setAvatarMode("wave");
      const ready = askMicOnce();
      beginSession(ready);
      return;
    }
    if (flowRef.current === "hello") return;
    if (hearingRef.current || phaseRef.current === "listening") return;
    beginListen();
  }

  async function askLine(intent, context) {
    const word = context.word || "";
    const child = context.child || "";
    try {
      const response = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          context,
          messages: [
            {
              role: "user",
              content: `Bedoeling: ${intent}. Woord: ${word}. Hij zei: ${child}. Eén vriendelijke Nederlandse zin, zoals "Hoi! Wat leuk dat je er bent!". Zeg niet "hé kind" of "hey kind".`
            }
          ]
        }),
        signal: chatSignal()
      });
      if (!response.ok) {
        setMicNote(dutchBody(await response.text(), "Margit kan nu niet antwoorden."));
        return spokenLine(null, intent, word);
      }
      const data = await response.json().catch(() => ({}));
      return spokenLine(data, intent, word);
    } catch {
      setMicNote("Margit kan nu niet antwoorden.");
      return spokenLine(null, intent, word);
    }
  }

  async function answerChild(child) {
    const ticket = bump();
    stopListening();
    stopSpeaking();
    const line = await askLine("chat", lineContext("", 0, false, child));
    if (ticket !== flowEpoch.current) return;
    await speak(line, poseForTurn({ moment: "chat" }));
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
    await speak(line, poseForTurn({ moment: "spell" }));
    if (ticket !== flowEpoch.current) return;
    setKeysOpen(true);
    setAvatarMode("idle");
  }

  async function replyThenSpell(child) {
    const ticket = bump();
    stopListening();
    stopSpeaking();
    const line = await askLine("chat", lineContext("", 0, false, child));
    if (ticket !== flowEpoch.current) return;
    const said = await speak(line, poseForTurn({ moment: "chat" }));
    if (!said || ticket !== flowEpoch.current) return;
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
    await speak(again, poseForTurn({ moment: "spell" }));
    if (ticket !== flowEpoch.current) return;
    setKeysOpen(true);
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

  async function runHello(ready) {
    const ticket = bump();
    setKeysOpen(false);
    setFlowBoth("hello");
    setAvatarMode("wave");
    const allowed = ready && typeof ready.then === "function" ? await ready : true;
    if (ticket !== flowEpoch.current) return;
    const greeted = await speak(LINES.greet, poseForTurn({ moment: "greeting" }));
    if (!greeted || ticket !== flowEpoch.current) return;
    const asked = await speak(LINES.mood, poseForTurn({ moment: "chat" }));
    if (!asked || ticket !== flowEpoch.current) return;
    setFlowBoth("mood");
    setAvatarMode("idle");
    if (allowed) beginListen();
  }

  function beginSession(ready) {
    if (startedRef.current || flowRef.current === "pause") return;
    startedRef.current = true;
    runHello(ready);
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
    await speak(again, poseForTurn({ moment: "spell" }));
    if (ticket !== flowEpoch.current) return;
    setKeysOpen(true);
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
          <div
            className={[
              "stage",
              showKeys ? "spelling" : "",
              !game && flow === "offer" ? "choosing" : "",
              game ? "playing" : ""
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="presence">
              <div className="intro">
                <div className="voice">
                  <button type="button" className="stem" onClick={toggleMute} aria-pressed={muted}>
                    {muted ? "Stem aan" : "Stem uit"}
                  </button>
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
                  <button
                    type="button"
                    className="listen"
                    onPointerUp={onMic}
                    onClick={onMic}
                    aria-pressed={hearing}
                  >
                    {hearing ? "Ik luister" : "Praat met Margit"}
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
