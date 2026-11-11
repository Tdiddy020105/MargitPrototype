import assert from "node:assert/strict";
import test from "node:test";
import { pickDutchVoice } from "../src/speech.js";
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
