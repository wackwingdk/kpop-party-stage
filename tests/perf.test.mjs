// Unit tests for the adaptive-performance hysteresis logic.
// Uses PoseEngine.computeNextQuality, a pure static function (no browser).
import { test } from "node:test";
import assert from "node:assert/strict";
import { PoseEngine } from "../js/engine.js";

const start = { level: 1, lowSince: null, highSince: null };

test("stays put at healthy fps", () => {
  const next = PoseEngine.computeNextQuality(start, 35, 1000);
  assert.equal(next.level, 1);
});

test("low fps for <2s does not step down yet", () => {
  let s = PoseEngine.computeNextQuality(start, 18, 1000); // marks lowSince=1000
  s = PoseEngine.computeNextQuality(s, 18, 2500);          // 1.5s later, not yet
  assert.equal(s.level, 1);
});

test("low fps sustained >=2s steps down one level", () => {
  let s = PoseEngine.computeNextQuality(start, 18, 1000); // lowSince=1000
  s = PoseEngine.computeNextQuality(s, 18, 3000);          // 2s later → step down
  assert.equal(s.level, 2);
});

test("high fps sustained >=5s steps up one level", () => {
  const lowState = { level: 2, lowSince: null, highSince: null };
  let s = PoseEngine.computeNextQuality(lowState, 60, 1000); // highSince=1000
  s = PoseEngine.computeNextQuality(s, 60, 6000);            // 5s later → step up
  assert.equal(s.level, 1);
});

test("does not step below level 0", () => {
  const top = { level: 0, lowSince: null, highSince: null };
  let s = PoseEngine.computeNextQuality(top, 90, 1000);
  s = PoseEngine.computeNextQuality(s, 90, 7000);
  assert.equal(s.level, 0);
});

test("does not step above the safe bottom level", () => {
  const bottom = { level: 3, lowSince: null, highSince: null };
  let s = PoseEngine.computeNextQuality(bottom, 5, 1000);
  s = PoseEngine.computeNextQuality(s, 5, 4000);
  assert.equal(s.level, 3);
});

test("mid-range fps resets the timers (no flapping)", () => {
  let s = PoseEngine.computeNextQuality(start, 18, 1000); // lowSince set
  s = PoseEngine.computeNextQuality(s, 35, 1500);          // healthy → reset
  assert.equal(s.lowSince, null);
  assert.equal(s.highSince, null);
});
