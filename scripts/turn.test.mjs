import assert from "node:assert/strict";
import test from "node:test";
import { LINES, acceptLine, fallbackLine, hearSensitive, nextStep, spokenLine, spellLine } from "../src/turn.js";

test("the app counts misses and the child gets the choice", () => {
  assert.deepEqual(nextStep({ correct: false, misses: 0 }), {
    intent: "mistake",
    misses: 1,
    offer: false,
    advance: false
  });
  assert.equal(nextStep({ correct: false, misses: 1 }).intent, "mistake");
  assert.deepEqual(nextStep({ correct: false, misses: 2 }), {
    intent: "offer",
    misses: 3,
    offer: true,
    advance: true
  });
  assert.equal(nextStep({ correct: true, misses: 2 }).intent, "praise");
  assert.equal(nextStep({ help: true, misses: 2 }).offer, false);
  assert.equal(nextStep({ hard: true, misses: 0 }).offer, true);
});

test("raw model text cannot choose the activity or reveal the word", () => {
  const step = nextStep({ correct: false, misses: 0 });
  assert.equal(step.intent, "mistake");
  assert.equal(spokenLine({ reply: "We doen memory." }, step.intent, "boom"), LINES.mistake);
  assert.equal(spokenLine({ line: "Het woord is boom.", intent: "mistake" }, "mistake", "boom"), LINES.mistake);
  assert.equal(spokenLine({ reply: "Kies memory." }, "offer", "boom"), LINES.offer);
  assert.equal(
    spokenLine(
      { line: "Dit is een lastig woord. Kies memory, woordzoeker of één letter anders.", intent: "offer" },
      "offer",
      "boom"
    ).includes("woordzoeker"),
    true
  );
  assert.equal(spokenLine({ reply: "nog eens" }, "spell", "boom"), spellLine("boom"));
  assert.equal(spokenLine(null, "praise", "boom"), LINES.praise);
  assert.equal(spokenLine({ reply: "Hé kind, hoe gaat het?" }, "chat", ""), LINES.chat);
  assert.equal(acceptLine("Hey kind!", "chat", ""), null);
  assert.match(LINES.greet, /^Hoi! Wat leuk dat je er bent!/);
  assert.match(LINES.chat, /^Hoi! Wat leuk dat je er bent!/);
  assert.equal(acceptLine("Ja! Helemaal goed. Knap gedaan!", "praise", "boom"), LINES.praise);
  assert.equal(fallbackLine("help"), LINES.help);
});

test("a sensitive share is a pause, not an exercise", () => {
  assert.equal(hearSensitive("ik ben zo verdrietig"), true);
  assert.equal(hearSensitive("mama slaat me"), true);
  assert.equal(hearSensitive("ik wil dood"), true);
  assert.equal(hearSensitive("ik word gepest"), true);
  assert.equal(hearSensitive("dit is te moeilijk"), false);
  assert.equal(hearSensitive("boom"), false);
  assert.equal(hearSensitive("ik ben blij"), false);
});
