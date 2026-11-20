import assert from "node:assert/strict";
import test from "node:test";
import { classifyClip, poseForTurn, poseName, resolveClips } from "../src/clips.js";

const MESHY_NAMES = [
  "Wave",
  "Idle",
  "Talking",
  "Motivational Cheer",
  "Victory Cheer",
  "Head Scratch"
];

test("victory is not the cheer clip, even when it is listed first", () => {
  const found = resolveClips([
    { name: "Victory" },
    { name: "Cheer" },
    { name: "Idle" },
    { name: "Talk" },
    { name: "Wave" },
    { name: "Confused" }
  ]);

  assert.equal(found.cheer, "Cheer");
  assert.equal(found.victory, "Victory");
  assert.equal(found.confused, "Confused");
  assert.notEqual(found.cheer, found.victory);
});

test("meshy clip names land on wave, idle, talk, cheer, victory and scratch", () => {
  const found = resolveClips(MESHY_NAMES.map((name) => ({ name })));

  assert.deepEqual(found, {
    wave: "Wave",
    idle: "Idle",
    talk: "Talking",
    cheer: "Motivational Cheer",
    victory: "Victory Cheer",
    confused: "Head Scratch"
  });
});

test("scratch and confused are the same pose", () => {
  assert.equal(poseName("scratch"), "confused");
  assert.equal(poseName("confused"), "confused");
  assert.equal(classifyClip("HeadScratch"), "confused");
  assert.equal(resolveClips(["scratch"]).confused, "scratch");
});

test("a right answer cheers, and a mistake does not cheer or scratch", () => {
  assert.equal(poseForTurn({ moment: "success" }), "cheer");
  assert.equal(poseForTurn({ moment: "greeting" }), "wave");

  for (const moment of ["mistake", "too-hard", "help", "chat", "start-game"]) {
    const pose = poseForTurn({ moment });
    assert.equal(pose, "talk");
    assert.notEqual(pose, "cheer");
    assert.notEqual(pose, "victory");
    assert.notEqual(pose, "confused");
  }
});

test("waiting to spell stays idle, and the answer picks the clip", () => {
  assert.equal(poseForTurn({ spelling: true }), "idle");
  assert.equal(poseForTurn({ moment: "spell-wait" }), "idle");
  assert.equal(poseForTurn({ moment: "listen" }), "idle");
  assert.equal(poseForTurn({ moment: "success" }), "cheer");
  assert.notEqual(poseForTurn({ moment: "success" }), "victory");
  assert.equal(poseForTurn({ moment: "mistake" }), "talk");
  assert.equal(poseForTurn({ moment: "offer" }), "talk");
  assert.notEqual(poseForTurn({ moment: "mistake" }), "cheer");
  assert.notEqual(poseForTurn({ moment: "mistake" }), "victory");
  assert.notEqual(poseForTurn({ moment: "mistake" }), "confused");
});

test("an unknown moment waits", () => {
  assert.equal(poseForTurn({ moment: "goodbye" }), "idle");
  assert.equal(poseName("dance"), "idle");
});
