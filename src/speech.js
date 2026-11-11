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

export function pickDutchVoice(voices) {
  const dutch = voices.filter((voice) => /nl/i.test(voice.lang));
  const female = dutch.find((voice) =>
    /female|vrouw|saskia|claire|ellen|femma|lisa|hanna|naomi|femke|linda/i.test(voice.name)
  );
  if (female) return female;
  const notMale = dutch.find((voice) => !/male|xander|frank|bart|david/i.test(voice.name));
  return notMale || dutch[0] || null;
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

export function stopSpeaking() {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function unlockSpeech() {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.resume();
  const primer = new SpeechSynthesisUtterance(" ");
  primer.volume = 0;
  window.speechSynthesis.speak(primer);
}

export async function speakDutch(text) {
  if (!window.speechSynthesis || !text) return false;
  const voices = await voicesReady();
  const voice = pickDutchVoice(voices);
  if (!voice) return false;

  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "nl-NL";
    utter.rate = 0.95;
    if (voice) utter.voice = voice;

    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pulse);
      window.clearTimeout(timer);
      resolve(ok);
    };
    // Chrome sometimes never fires onend unless speech is nudged.
    const pulse = window.setInterval(() => {
      if (!window.speechSynthesis.speaking) return;
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 4000);
    const timer = window.setTimeout(() => finish(false), Math.min(7000, 900 + text.length * 55));
    utter.onend = () => finish(true);
    utter.onerror = () => finish(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    window.speechSynthesis.resume();
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
