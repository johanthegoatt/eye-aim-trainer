import test from "node:test";
import assert from "node:assert/strict";
import { createOneEuro } from "../src/oneEuro.js";

// The settings app.js uses for gaze.
const GAZE = { minCutoff: 0.5, beta: 0.0007 };

// Deterministic noise so the test does not flake.
function noise(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296 - 0.5;
  };
}

function spread(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

test("1€ filter calms jitter while the gaze rests", () => {
  const f = createOneEuro(GAZE);
  const rnd = noise(7);
  const raw = [];
  const out = [];
  for (let i = 0; i < 120; i++) {
    const v = 400 + rnd() * 120; // ±60 px of jitter around a fixed point
    raw.push(v);
    out.push(f.filter(v, i * 33));
  }
  // Ignore the first half second while it settles.
  assert.ok(spread(out.slice(15)) < spread(raw.slice(15)) / 4);
});

test("1€ filter follows a jump to a new target quickly", () => {
  const f = createOneEuro(GAZE);
  for (let i = 0; i < 30; i++) f.filter(100, i * 33);
  let v = 100;
  let t = 30 * 33;
  let frames = 0;
  while (Math.abs(v - 700) > 60 && frames < 60) {
    t += 33;
    v = f.filter(700, t);
    frames++;
  }
  // Within about a fifth of a second at 30 fps.
  assert.ok(frames <= 6, `took ${frames} frames`);
});
