// Tests for the Copy-Pose preview fix: the whole figure must fit in its box
// for EVERY pose, so the "you can only see half the pose" bug can't return.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fitToBox } from "../js/games/lib.js";
import { buildPoseFigure, __test as cp } from "../js/games/copy-pose.js";

test("fitToBox: all returned points fall within the box bounds", () => {
  const pts = [
    { x: -100, y: -50 }, { x: 100, y: 50 }, { x: 0, y: 200 }, { x: -300, y: 10 },
  ];
  const box = { x: 500, y: 20, w: 160, h: 200 };
  const { points } = fitToBox(pts, box, 0.12);
  for (const p of points) {
    assert.ok(p.x >= box.x && p.x <= box.x + box.w, `x ${p.x} out of [${box.x}, ${box.x + box.w}]`);
    assert.ok(p.y >= box.y && p.y <= box.y + box.h, `y ${p.y} out of [${box.y}, ${box.y + box.h}]`);
  }
});

test("fitToBox: preserves aspect ratio (uniform scale on x and y)", () => {
  const pts = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
  const box = { x: 0, y: 0, w: 200, h: 400 }; // taller than wide
  const { points } = fitToBox(pts, box, 0);
  const dx = points[1].x - points[0].x;
  const dy = points[1].y - points[0].y;
  // square input → square output (dx ≈ dy) because scale is uniform
  assert.ok(Math.abs(dx - dy) < 1e-6, `expected uniform scale, dx=${dx} dy=${dy}`);
});

test("fitToBox: empty input is handled gracefully", () => {
  const { points } = fitToBox([], { x: 0, y: 0, w: 10, h: 10 });
  assert.deepEqual(points, []);
});

// The real regression test: EVERY pose's figure must fit inside the box.
test("every Copy-Pose figure fits entirely within the preview box", () => {
  const box = { x: 1000, y: 24, w: 200, h: 250 };
  for (const pose of cp.POSES) {
    const fig = buildPoseFigure(pose.angles);
    const all = [];
    for (const [a, b] of fig.bones) all.push(a, b);
    all.push(fig.head);
    const { points } = fitToBox(all, box, 0.16);
    for (const p of points) {
      assert.ok(
        p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h,
        `Pose "${pose.name}" has a point outside the box: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`
      );
    }
  }
});

test("buildPoseFigure: produces distinct figures for distinct poses", () => {
  // Arms-up vs T-pose should differ (the bug made them look the same/clipped).
  const armsUp = buildPoseFigure({ leftShoulder: 160, rightShoulder: 160, leftElbow: 175, rightElbow: 175 });
  const tPose = buildPoseFigure({ leftShoulder: 90, rightShoulder: 90, leftElbow: 175, rightElbow: 175 });
  // compare left wrist y (last point of the left-arm forearm bone)
  const armsUpWristY = armsUp.bones.find((_, i) => i === 7)[1].y; // [ls,elbow]=6, [elbow,wrist]=7
  const tPoseWristY = tPose.bones.find((_, i) => i === 7)[1].y;
  assert.ok(armsUpWristY < tPoseWristY,
    `arms-up wrist (${armsUpWristY}) should be higher (smaller y) than T-pose wrist (${tPoseWristY})`);
});
