import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_TIMEOUT_MS,
  DUTCH_VOICE_LINE,
  calmChatError,
  dutchSpeechRequest,
  isAppleMobile,
  listensAfterReply,
  needsChromePulse,
  pickDutchVoice,
  recognitionSettings,
  visibleReply
} from "../src/speech.js";
import {
  LETTER_ROUNDS,
  SEARCH_WORDS,
  hearGame,
  hearHelp,
  hearTooHard,
  judgeLetter,
  lineFromDrag,
  makeMemory,
  makeWordSearch,
  matchesPlaced,
  activityFromText,
  gameLeadLine,
  leadGame,
  spellPraise,
  spellingIsRight,
  wantsGame
} from "../src/games.js";

test("word search places every word on a straight line", () => {
  const puzzle = makeWordSearch(SEARCH_WORDS, () => 0.2);
  assert.equal(puzzle.placed.length, SEARCH_WORDS.length);
  for (const item of puzzle.placed) {
    const read = item.cells.map((cell) => puzzle.grid[cell.r][cell.c]).join("");
    assert.equal(read, item.word);
    assert.equal(matchesPlaced(puzzle.placed, item.cells)?.word, item.word);
    assert.equal(
      matchesPlaced(puzzle.placed, [...item.cells].reverse())?.word,
      item.word
    );
  }
});

test("drag stays on a row or a column", () => {
  assert.deepEqual(lineFromDrag({ r: 1, c: 1 }, { r: 1, c: 3 }), [
    { r: 1, c: 1 },
    { r: 1, c: 2 },
    { r: 1, c: 3 }
  ]);
  assert.equal(lineFromDrag({ r: 0, c: 0 }, { r: 2, c: 2 }), null);
});

test("one letter apart accepts only a listed neighbour", () => {
  const round = LETTER_ROUNDS[0];
  assert.equal(judgeLetter(round.start, "kar", round.answers).ok, true);
  assert.equal(judgeLetter(round.start, "kat", round.answers).reason, "same");
  assert.equal(judgeLetter(round.start, "hond", round.answers).reason, "length");
  assert.equal(judgeLetter(round.start, "kaa", round.answers).reason, "not-one");
});

test("memory deck is pairs", () => {
  const cards = makeMemory(["kat", "zon", "vis"], () => 0);
  assert.equal(cards.length, 6);
  const counts = {};
  for (const card of cards) counts[card.word] = (counts[card.word] || 0) + 1;
  assert.deepEqual(counts, { kat: 2, zon: 2, vis: 2 });
});

test("a Dutch female voice is preferred", () => {
  const voice = pickDutchVoice([
    { lang: "en-US", name: "Samantha" },
    { lang: "nl-NL", name: "Xander" },
    { lang: "nl-NL", name: "Saskia" }
  ]);
  assert.equal(voice.name, "Saskia");
});

test("speech stays silent without a Dutch voice and keeps nl-NL", () => {
  const english = { lang: "en-US", name: "Samantha" };
  const dutchRegion = { lang: "en-NL", name: "Ellen" };
  assert.equal(pickDutchVoice([english, dutchRegion]), null);
  assert.equal(dutchSpeechRequest("Hoi", english), null);
  assert.equal(dutchSpeechRequest("Hoi", null), null);

  const xander = { lang: "nl-NL", name: "Xander" };
  const flemish = { lang: "nl_BE", name: "Saskia" };
  assert.equal(pickDutchVoice([xander]).name, "Xander");
  assert.equal(pickDutchVoice([english, xander, flemish]).name, "Saskia");
  assert.deepEqual(dutchSpeechRequest("Hoi", xander), {
    text: "Hoi",
    lang: "nl-NL",
    voice: xander,
    rate: 0.95
  });
  assert.match(
    DUTCH_VOICE_LINE,
    /Instellingen, Toegankelijkheid, Gesproken inhoud, Stemmen, Nederlands/
  );
});

test("iPhone listens once per tap and still shows a reply", () => {
  const iphone = {
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
    platform: "iPhone",
    maxTouchPoints: 5
  };
  assert.equal(isAppleMobile(iphone), true);
  assert.deepEqual(recognitionSettings(iphone), {
    continuous: false,
    interimResults: false
  });
  assert.equal(listensAfterReply(iphone), false);
  assert.equal(needsChromePulse(iphone), false);
  assert.equal(listensAfterReply({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    platform: "Win32",
    maxTouchPoints: 0
  }), true);
  assert.deepEqual(recognitionSettings({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    platform: "Win32",
    maxTouchPoints: 0
  }), { continuous: true, interimResults: true });
  assert.equal(visibleReply(""), "Ik ben er. Zeg het nog eens.");
  assert.equal(visibleReply("  Hoi *daar*  "), "Hoi daar");
  assert.equal(
    calmChatError({ name: "TimeoutError", message: "The operation was aborted." }),
    "Margit kan nu niet antwoorden. Probeer het zo nog eens."
  );
  assert.equal(
    calmChatError({ name: "AbortError", message: "The user aborted a request." }),
    "Margit kan nu niet antwoorden. Probeer het zo nog eens."
  );
  assert.equal(calmChatError(new Error("Berichten ontbreken.")), "Berichten ontbreken.");
  assert.ok(CHAT_TIMEOUT_MS >= 1000);
});

test("the Chrome speech pulse stays off on iPhone", () => {
  const iphone = {
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    platform: "iPhone",
    maxTouchPoints: 5
  };
  const chrome = {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    platform: "Win32",
    maxTouchPoints: 0
  };
  assert.equal(needsChromePulse(iphone), false);
  assert.equal(needsChromePulse(chrome), true);
  assert.equal(
    needsChromePulse({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      platform: "MacIntel",
      maxTouchPoints: 5
    }),
    false
  );
});

test("a wrong spelling makes her name one game", () => {
  assert.equal(spellingIsRight("kat", "kat"), true);
  assert.equal(spellingIsRight("kat", "Kat!"), true);
  assert.equal(spellingIsRight("kat", "ka"), false);
  assert.equal(leadGame(null, 0), "zoek");
  assert.equal(leadGame("zoek", 0), "letter");
  assert.equal(leadGame("letter", 0), "zoek");
  assert.equal(leadGame("letter", 1), "memory");
  assert.equal(leadGame("memory", 0), "zoek");
  for (const name of ["zoek", "letter", "memory"]) {
    const line = gameLeadLine(name);
    assert.equal(activityFromText(line), name);
    assert.equal(line.split(/[.!?]/).filter(Boolean).length, 1);
  }
  assert.match(spellPraise("zon"), /Spel het woord zon/);
  assert.equal(activityFromText(spellPraise("zon")), "spell");
});

test("she opens one named game, and a card line is not a menu", () => {
  assert.equal(activityFromText("Ik pak de kaartjes."), null);
  assert.equal(activityFromText("Ik leg de kaarten klaar."), null);
  assert.equal(activityFromText("Ik pak de kaartjes. We doen memory."), "memory");
  assert.equal(activityFromText("Laten we woordzoeker doen."), "zoek");
  assert.equal(activityFromText("We doen één letter anders."), "letter");
  assert.equal(activityFromText("Spel het woord kat."), "spell");
  assert.equal(activityFromText("Schrijf het woord eens op."), "spell");
  assert.equal(
    activityFromText("Wat wil je doen? We kunnen woordzoeker, één letter anders, of memory spelen."),
    null
  );
  assert.equal(activityFromText("Hoi, hoe gaat het?"), null);
  assert.equal(activityFromText("memory is te moeilijk"), null);
  assert.equal(activityFromText("Dit is lastig. We doen memory."), "memory");
});

test("speech cues pick a game, help, or too hard", () => {
  assert.equal(wantsGame("memory"), "memory");
  assert.equal(wantsGame("ik wil woordzoeker"), "woordzoeker");
  assert.equal(wantsGame("een letter anders"), "letter");
  assert.equal(hearGame("de letter a"), null);
  assert.equal(wantsGame("memory is te moeilijk"), null);
  assert.equal(hearTooHard("Dit is te moeilijk"), true);
  assert.equal(hearHelp("Kun je me helpen?"), true);
  assert.equal(hearTooHard("Kun je me helpen?"), false);
});
