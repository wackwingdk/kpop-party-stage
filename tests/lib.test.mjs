// Unit tests for the pure game logic in js/games/lib.js.
// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  angleAt, poseAngles, poseScore, motionScore, wristHit,
} from "../js/games/lib.js";
import { neutralDancer, armsUpDancer, makeDancer } from "./helpers.mjs";

test("angleAt: straight line is 180 degrees", () => {
  const a = { x: 0, y: 0, score: 1 };
  const b = { x: 10, y: 0, score: 1 };
  const c = { x: 20, y: 0, score: 1 };
  assert.ok(Math.abs(angleAt(a, b, c) - 180) < 0.001);
});

test("angleAt: right angle is 90 degrees", () => {
  const a = { x: 0, y: 10, score: 1 };
  const b = { x: 0, y: 0, score: 1 };
  const c = { x: 10, y: 0, score: 1 };
  assert.ok(Math.abs(angleAt(a, b, c) - 90) < 0.001);
});

test("angleAt: returns null when a point is low-confidence", () => {
  const a = { x: 0, y: 0, score: 0.1 };
  const b = { x: 10, y: 0, score: 1 };
  const c = { x: 20, y: 0, score: 1 };
  assert.equal(angleAt(a, b, c), null);
});

test("poseScore: identical pose scores 100", () => {
  const target = { leftShoulder: 90, rightShoulder: 90 };
  assert.equal(poseScore({ leftShoulder: 90, rightShoulder: 90 }, target), 100);
});

test("poseScore: far-off pose scores low", () => {
  const target = { leftShoulder: 160, rightShoulder: 160 };
  const score = poseScore({ leftShoulder: 20, rightShoulder: 20 }, target);
  assert.ok(score < 30, `expected low score, got ${score}`);
});

test("poseScore: arms-up dancer scores well on Arms-Up target", () => {
  const d = armsUpDancer();
  const target = { leftShoulder: 160, rightShoulder: 160, leftElbow: 175, rightElbow: 175 };
  const score = poseScore(poseAngles(d.keypoints), target);
  assert.ok(score >= 60, `arms-up should match arms-up target, got ${score}`);
});

test("poseScore: neutral dancer scores poorly on Arms-Up target", () => {
  const d = neutralDancer();
  const target = { leftShoulder: 160, rightShoulder: 160, leftElbow: 175, rightElbow: 175 };
  const score = poseScore(poseAngles(d.keypoints), target);
  const upScore = poseScore(poseAngles(armsUpDancer().keypoints), target);
  assert.ok(score < upScore, `neutral (${score}) should score below arms-up (${upScore})`);
});

test("motionScore: identical frames = 0 motion", () => {
  const d = neutralDancer();
  assert.equal(motionScore(d.keypoints, d.keypoints), 0);
});

test("motionScore: shifting all keypoints by D gives exactly D", () => {
  // Move EVERY one of the 17 keypoints by 50px so the average is exact.
  const d1 = neutralDancer(0, 480, 360);
  const d2 = { keypoints: {} };
  for (const [name, p] of Object.entries(d1.keypoints)) {
    d2.keypoints[name] = { x: p.x + 50, y: p.y, score: 1 };
  }
  const m = motionScore(d1.keypoints, d2.keypoints);
  assert.ok(Math.abs(m - 50) < 0.001, `expected exactly 50, got ${m}`);
});

test("motionScore: a partial shift is positive but averaged over all points", () => {
  // neutralDancer only sets 13 of 17 points; the 4 unset ones don't move,
  // so the average is (13*50)/17 ≈ 38.2 — confirms averaging semantics.
  const d1 = neutralDancer(0, 480, 360);
  const d2 = neutralDancer(0, 530, 360);
  const m = motionScore(d1.keypoints, d2.keypoints);
  assert.ok(m > 0, "motion should be positive");
  assert.ok(Math.abs(m - (13 * 50) / 17) < 0.001, `expected ~38.2, got ${m}`);
});

test("wristHit: detects a wrist within radius", () => {
  const d = makeDancer(0, { leftWrist: { x: 100, y: 100 }, rightWrist: { x: 800, y: 600 } });
  const hit = wristHit([d], 110, 105, 40);
  assert.equal(hit?.id, 0);
});

test("wristHit: returns null when no wrist is near", () => {
  const d = makeDancer(0, { leftWrist: { x: 100, y: 100 }, rightWrist: { x: 800, y: 600 } });
  assert.equal(wristHit([d], 400, 300, 40), null);
});

test("wristHit: ignores low-confidence wrists", () => {
  const d = makeDancer(0, {
    leftWrist: { x: 100, y: 100, score: 0.05 },
    rightWrist: { x: 800, y: 600, score: 0.05 },
  });
  assert.equal(wristHit([d], 100, 100, 40), null);
});
