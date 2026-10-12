import test from "node:test";
import assert from "node:assert/strict";
import {
  createTrainerState,
  spawnTarget,
  isCursorInsideTarget,
  registerShot,
  scoreFromReaction,
  stepTrainer,
  accuracyPercent,
} from "../src/targetEngine.js";

test("spawnTarget keeps target inside arena margin", () => {
  const initial = createTrainerState({ width: 500, height: 300 });
  const next = spawnTarget(initial, () => 0.5);

  assert.ok(next.target.x > 40 && next.target.x < 460);
  assert.ok(next.target.y > 40 && next.target.y < 260);
});

test("cursor inside target check works", () => {
  const state = createTrainerState();
  state.target.x = 300;
  state.target.y = 200;
  state.target.radius = 25;

  assert.equal(isCursorInsideTarget(state, 300, 200), true);
  assert.equal(isCursorInsideTarget(state, 400, 200), false);
});

test("scoreFromReaction rewards faster reaction", () => {
  const fast = scoreFromReaction(300, 3);
  const slow = scoreFromReaction(1500, 3);
  assert.ok(fast > slow);
});

test("registerShot updates counters and respawns target", () => {
  const state = createTrainerState();
  const hit = registerShot(state, { didHit: true, reactionMs: 500, randomFn: () => 0.4 });
  assert.equal(hit.hits, 1);
  assert.equal(hit.misses, 0);
  assert.ok(hit.score > 0);

  const miss = registerShot(hit, { didHit: false, randomFn: () => 0.6 });
  assert.equal(miss.misses, 1);
  assert.equal(miss.streak, 0);
});

test("stepTrainer expires old targets into misses", () => {
  const state = createTrainerState();
  state.target.ageMs = state.targetLifetimeMs - 10;

  const next = stepTrainer(state, 20, () => 0.2);
  assert.equal(next.misses, 1);
});

test("accuracyPercent is computed from attempts", () => {
  const state = createTrainerState();
  state.hits = 3;
  state.misses = 1;
  assert.equal(accuracyPercent(state), 75);
});

test("gaze slack widens the hit circle", () => {
  const state = createTrainerState();
  state.target.x = 300;
  state.target.y = 200;
  state.target.radius = 30;

  assert.equal(isCursorInsideTarget(state, 355, 200), false);
  assert.equal(isCursorInsideTarget(state, 355, 200, 34), true);
});
