// Tests for the pure helpers behind the SVG princess outfit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { boneTransform, shoulderTilt } from "../js/games/lib.js";
import { __test as dress } from "../js/games/dress-assets.js";

test("boneTransform: horizontal bone has angle 0 and correct length", () => {
  const t = boneTransform({ x: 0, y: 0, score: 1 }, { x: 50, y: 0, score: 1 });
  assert.ok(Math.abs(t.angle - 0) < 1e-9);
  assert.ok(Math.abs(t.length - 50) < 1e-9);
  assert.equal(t.x, 0); assert.equal(t.y, 0);
});

test("boneTransform: straight-down bone has angle +90° (PI/2)", () => {
  const t = boneTransform({ x: 10, y: 10, score: 1 }, { x: 10, y: 60, score: 1 });
  assert.ok(Math.abs(t.angle - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(t.length - 50) < 1e-9);
});

test("boneTransform: returns null for low-confidence points", () => {
  assert.equal(boneTransform({ x: 0, y: 0, score: 0.1 }, { x: 1, y: 1, score: 1 }), null);
  assert.equal(boneTransform(null, { x: 1, y: 1, score: 1 }), null);
});

test("shoulderTilt: level shoulders → 0", () => {
  const kp = { leftShoulder: { x: 0, y: 100, score: 1 }, rightShoulder: { x: 80, y: 100, score: 1 } };
  assert.ok(Math.abs(shoulderTilt(kp)) < 1e-9);
});

test("shoulderTilt: right shoulder lower → positive tilt", () => {
  const kp = { leftShoulder: { x: 0, y: 100, score: 1 }, rightShoulder: { x: 80, y: 120, score: 1 } };
  assert.ok(shoulderTilt(kp) > 0);
});

test("shoulderTilt: missing shoulders → 0 (safe default)", () => {
  assert.equal(shoulderTilt({ leftShoulder: { x: 0, y: 0, score: 0 }, rightShoulder: { x: 1, y: 1, score: 0 } }), 0);
});

test("darken: reduces each channel and returns rgb()", () => {
  const out = dress.darken("#ffffff", 0.5);
  assert.match(out, /^rgb\(\s*128,\s*128,\s*128\s*\)$/);
});

test("gownSVG/sleeveSVG: produce valid-looking SVG markup with the color", () => {
  const g = dress.gownSVG("#ff3ec8", "rgb(100,20,80)");
  assert.match(g, /^<svg[\s\S]*<\/svg>$/);
  assert.ok(g.includes("#ff3ec8"), "gown should include the main color");
  const s = dress.sleeveSVG("#3ee0ff", "rgb(20,90,100)");
  assert.match(s, /^<svg[\s\S]*<\/svg>$/);
  assert.ok(s.includes("#3ee0ff"), "sleeve should include the main color");
});
