import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { nextListenTick } from "../src/speech.js";

const require = createRequire(import.meta.url);
const { usableTranscript } = require("./hear.cjs");

test("a quiet mic keeps recording and a phrase is sent once", () => {
  assert.equal(nextListenTick({ heard: false, loud: false, waitMs: 1000, speechMs: 0, quietMs: 0 }), "wait");
  assert.equal(nextListenTick({ heard: false, loud: true, waitMs: 1200, speechMs: 0, quietMs: 0 }), "speech");
  assert.equal(nextListenTick({ heard: true, loud: true, waitMs: 2000, speechMs: 500, quietMs: 0 }), "speech");
  assert.equal(nextListenTick({ heard: true, loud: false, waitMs: 2400, speechMs: 500, quietMs: 800 }), "send");
  assert.equal(nextListenTick({ heard: false, loud: false, waitMs: 15000, speechMs: 0, quietMs: 0 }), "again");
  assert.equal(nextListenTick({ heard: true, loud: true, waitMs: 9000, speechMs: 8000, quietMs: 0 }), "send");
});

test("whisper silence and the missed-hear line are not a reply", () => {
  assert.equal(usableTranscript("Ik wil memory spelen."), "Ik wil memory spelen.");
  assert.equal(usableTranscript("[00:00.000 --> 00:01.000]  Hoi daar"), "Hoi daar");
  assert.equal(usableTranscript("Bedankt voor het kijken!"), "");
  assert.equal(usableTranscript("Ik hoorde je niet."), "");
  assert.equal(usableTranscript("  "), "");
});
