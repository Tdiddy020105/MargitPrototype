export const MISTAKE_LINES = [
  "Bijna. Kijk nog eens en probeer het opnieuw.",
  "Dat mag. Probeer het nog een keer.",
  "Je bent goed bezig. Kijk nog eens."
];

export const PREPARED = {
  greeting:
    "Hoi! Ik ben Margit. Welk spel wil je: woordzoeker, één letter anders of memory?",
  success: "Ja! Goed gedaan.",
  mistake: MISTAKE_LINES[0],
  "too-hard":
    "Dit is lastig. Welk spel wil je nu: woordzoeker, één letter anders of memory?",
  help: "Goed dat je het vraagt. Probeer de eerste letter.",
  chat: "Zullen we verdergaan met het spel?",
  "start-game": "Goed, we beginnen."
};

export const DUTCH_VOICE_LINE =
  "Installeer een Nederlandse stem: Instellingen, Toegankelijkheid, Gesproken inhoud, Stemmen, Nederlands.";

export function voiceLangIsDutch(lang) {
  const tag = String(lang || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  return tag === "nl" || tag.startsWith("nl-");
}

export function pickDutchVoice(voices) {
  const dutch = (voices || []).filter((voice) => voiceLangIsDutch(voice?.lang));
  const named = (pattern) => dutch.find((voice) => pattern.test(voice?.name || ""));
  return (
    named(/claire/i) ||
    named(/ellen/i) ||
    named(/female|vrouw|saskia|fenna|femma|lisa|hanna|naomi|femke|linda/i) ||
    dutch.find((voice) => !/male|xander|frank|bart|david/i.test(voice?.name || "")) ||
    dutch[0] ||
    null
  );
}

export function dutchSpeechRequest(text, voice) {
  if (!text || !voice || !voiceLangIsDutch(voice.lang)) return null;
  return { text, lang: "nl-NL", voice, rate: 0.95 };
}

export function isAppleMobile(nav = globalThis.navigator) {
  if (!nav) return false;
  const ua = String(nav.userAgent || "");
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (nav.platform === "MacIntel" && Number(nav.maxTouchPoints) > 1) return true;
  return false;
}

export function needsChromePulse(nav = globalThis.navigator) {
  if (!nav) return true;
  return !isAppleMobile(nav);
}

// iOS ends a continuous session with no result and never fires onend.
export function recognitionSettings(nav = globalThis.navigator) {
  if (isAppleMobile(nav)) return { continuous: false, interimResults: false };
  return { continuous: true, interimResults: true };
}

// Starting another listen after the reply is outside the tap, so iOS drops it.
export function listensAfterReply(nav = globalThis.navigator) {
  return !isAppleMobile(nav);
}

export const CHAT_TIMEOUT_MS = 45000;

// The hello wav is about 13s. An 8s cutoff resolves while it is still playing,
// the next line swaps the audio src, and play() rejects.
export function playbackWaitMs(durationSec) {
  const seconds = Number(durationSec);
  if (!Number.isFinite(seconds) || seconds <= 0) return 70000;
  return Math.ceil(seconds * 1000) + 500;
}

// One empty end may restart the same recognizer. A second empty end stops.
export function emptyListenShouldRestart(attempts) {
  return Number(attempts) < 1;
}

// "speech" starts an utterance, "send" ends one, "again" drops a silent take.
export function nextListenTick({ heard, loud, waitMs, speechMs, quietMs }) {
  if (heard && speechMs >= 8000) return "send";
  if (!heard) {
    if (loud) return "speech";
    if (waitMs >= 15000) return "again";
    return "wait";
  }
  if (loud) return "speech";
  if (quietMs >= 700 && speechMs >= 400) return "send";
  return "wait";
}

export function dutchBody(text, fallback) {
  const raw = String(text || "").trim();
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw);
    if (data && typeof data.error === "string" && data.error.trim()) return data.error.trim();
  } catch {
    // The body was not JSON.
  }
  return fallback;
}

export function calmChatError(err) {
  const message = String((err && err.message) || "");
  const name = String((err && err.name) || "");
  if (
    name === "TimeoutError" ||
    name === "AbortError" ||
    /abort|timeout|timed out|fetch|network|json|ollama|failed|unexpected|load failed/i.test(message)
  ) {
    return "Margit kan nu niet antwoorden. Probeer het zo nog eens.";
  }
  if (message.trim()) return message.trim();
  return "Margit kan nu niet antwoorden. Probeer het zo nog eens.";
}

export function visibleReply(text) {
  const value = String(text || "")
    .replace(/[*_#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return value || "Ik ben er. Zeg het nog eens.";
}

export function canListen() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function voicesReady() {
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      const next = window.speechSynthesis.getVoices();
      if (!next.length) return;
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      resolve(next);
    };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    window.setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
  });
}

let speakGeneration = 0;

export function stopSpeaking() {
  speakGeneration += 1;
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function unlockSpeech() {
  if (!window.speechSynthesis) return;
  const voice = pickDutchVoice(window.speechSynthesis.getVoices());
  window.speechSynthesis.resume();
  if (!voice) return;
  const primer = new SpeechSynthesisUtterance(" ");
  primer.volume = 0;
  primer.lang = "nl-NL";
  primer.voice = voice;
  window.speechSynthesis.speak(primer);
}

export async function speakDutch(text) {
  if (!window.speechSynthesis || !text) return false;
  const generation = ++speakGeneration;
  const voices = await voicesReady();
  const request = dutchSpeechRequest(text, pickDutchVoice(voices));
  if (!request || generation !== speakGeneration) return false;

  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(request.text);
    utter.lang = request.lang;
    utter.rate = request.rate;
    utter.voice = request.voice;

    let settled = false;
    let pulse = 0;
    let timer = 0;
    let delay = 0;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pulse);
      window.clearTimeout(timer);
      window.clearTimeout(delay);
      resolve(ok);
    };
    const synth = window.speechSynthesis;
    const nudge = needsChromePulse();
    if (nudge) {
      // Chrome sometimes never fires onend unless speech is nudged.
      // The same pause/resume pulse chops the voice on iOS.
      pulse = window.setInterval(() => {
        if (!synth.speaking) return;
        synth.pause();
        synth.resume();
      }, 4000);
    }
    timer = window.setTimeout(() => finish(false), Math.min(7000, 900 + text.length * 55));
    utter.onend = () => finish(true);
    utter.onerror = () => finish(false);
    try {
      synth.cancel();
    } catch {
      // Drop a queued English utterance before the Dutch voice speaks.
    }
    const start = () => {
      if (settled || generation !== speakGeneration) return;
      synth.speak(utter);
      if (nudge) synth.resume();
    };
    delay = window.setTimeout(start, isAppleMobile() ? 160 : 60);
  });
}

export function listenDutch({ onResult, onError }) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) {
    onError?.("unsupported");
    return () => {};
  }

  const rec = new Rec();
  rec.lang = "nl-NL";
  rec.interimResults = false;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  rec.onresult = (event) => {
    const text = event.results?.[0]?.[0]?.transcript || "";
    if (text.trim()) onResult(text.trim());
  };
  rec.onerror = (event) => {
    if (event.error === "aborted" || event.error === "no-speech") return;
    onError?.(event.error);
  };
  try {
    rec.start();
  } catch {
    onError?.("start");
  }

  return () => {
    try {
      rec.abort();
    } catch {
      /* already stopped */
    }
  };
}
