// Unit tests for Bridge Rescue physics (pure, no browser).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findSupport, stepMan, isRescued, hasFallenOut, buildPlatforms, buildFloor,
  GRAVITY, WALK_SPEED, SNAP_BAND,
} from "../js/games/bridge-physics.js";

const floor = (x1, x2, y) => ({ x1, x2, y, kind: "floor" });

test("findSupport: man standing on a platform finds it", () => {
  const man = { x: 50, y: 100, vy: 0 };
  const p = floor(0, 100, 100);
  assert.equal(findSupport(man, [p]), p);
});

test("findSupport: man over a gap (no platform under feet) finds nothing", () => {
  const man = { x: 200, y: 100, vy: 0 };
  const p = floor(0, 100, 100); // platform ends at x=100, man at 200
  assert.equal(findSupport(man, [p]), null);
});

test("findSupport: platform above the feet does NOT support (can't stand under it)", () => {
  const man = { x: 50, y: 100, vy: 0 };
  const above = floor(0, 100, 60); // y=60 is above feet at y=100
  assert.equal(findSupport(man, [above]), null);
});

test("findSupport: platform too far below is not caught", () => {
  const man = { x: 50, y: 100, vy: 0 };
  const farBelow = floor(0, 100, 100 + SNAP_BAND + 10);
  assert.equal(findSupport(man, [farBelow]), null);
});

test("findSupport: platform just below within snap band IS caught", () => {
  const man = { x: 50, y: 100, vy: 0 };
  const justBelow = floor(0, 100, 100 + SNAP_BAND - 1);
  assert.equal(findSupport(man, [justBelow]), justBelow);
});

test("findSupport: picks the highest platform when several overlap", () => {
  const man = { x: 50, y: 100, vy: 0 };
  const low = floor(0, 100, 120);
  const high = floor(0, 100, 105);
  assert.equal(findSupport(man, [low, high]), high);
});

test("stepMan: supported man walks right and stays on the platform", () => {
  const man = { x: 50, y: 100, vy: 0, state: "walking" };
  const p = floor(0, 200, 100);
  const next = stepMan(man, [p], 0.1);
  assert.ok(next.x > man.x, "should move right");
  assert.equal(next.y, 100, "should stick to platform top");
  assert.equal(next.vy, 0);
  assert.equal(next.state, "walking");
});

test("stepMan: man over a gap falls (y increases, vy grows)", () => {
  const man = { x: 300, y: 100, vy: 0, state: "walking" };
  const p = floor(0, 100, 100); // gap from 100 onward
  const next = stepMan(man, [p], 0.1);
  assert.ok(next.y > 100, "should fall down");
  assert.ok(next.vy > 0, "should gain downward velocity");
  assert.equal(next.state, "falling");
});

test("stepMan: a falling man lands when he reaches a lower platform", () => {
  // start just above a platform, falling
  const p = floor(0, 200, 130);
  let man = { x: 50, y: 110, vy: 100, state: "falling" };
  man = stepMan(man, [p], 0.1); // should drop ~10-14px and land within snap band
  assert.equal(man.state, "walking");
  assert.equal(man.y, 130);
});

test("isRescued: true once past the goal x", () => {
  assert.equal(isRescued({ x: 610, y: 100, state: "walking" }, 600), true);
  assert.equal(isRescued({ x: 500, y: 100, state: "walking" }, 600), false);
});

test("hasFallenOut: true when below the floor bottom", () => {
  assert.equal(hasFallenOut({ x: 0, y: 800 }, 720), true);
  assert.equal(hasFallenOut({ x: 0, y: 700 }, 720), false);
});

test("buildPlatforms: turns confident wrists into hand platforms", () => {
  const dancers = [{
    color: "#ff3ec8",
    keypoints: {
      leftWrist: { x: 300, y: 250, score: 1 },
      rightWrist: { x: 500, y: 260, score: 0.1 }, // low confidence → skipped
    },
  }];
  const floors = [floor(0, 100, 400)];
  const plats = buildPlatforms(floors, dancers, 40, 0.3);
  // 1 floor + 1 hand (left wrist only)
  assert.equal(plats.length, 2);
  const hand = plats.find((p) => p.kind === "hand");
  assert.equal(hand.x1, 260);
  assert.equal(hand.x2, 340);
  assert.equal(hand.y, 250);
  assert.equal(hand.color, "#ff3ec8");
});

// BALANCE: every hole must be smaller than a hand bridge, at every canvas size,
// so a single hand can always span a gap. This is the bug the user hit.
test("buildFloor: every gap is smaller than a hand bridge (all sizes)", () => {
  for (const W of [480, 640, 960, 1280, 1920]) {
    const { floor, gapWidth, handWidth } = buildFloor(W, 400, 3);
    assert.ok(gapWidth < handWidth,
      `W=${W}: gap ${gapWidth} should be < hand bridge ${handWidth}`);
    // verify the actual gaps between consecutive floor chunks match gapWidth
    for (let i = 0; i < floor.length - 1; i++) {
      const realGap = floor[i + 1].x1 - floor[i].x2;
      // last chunk extends past the edge; only check interior gaps
      if (floor[i + 1].x1 < W) {
        assert.ok(realGap <= handWidth,
          `W=${W}: a real gap (${realGap}) exceeds hand bridge (${handWidth})`);
      }
    }
  }
});

test("buildFloor: a hand centered on a gap bridges it (man crosses, doesn't fall)", () => {
  const W = 640, groundY = 400;
  const { floor, handHalfWidth } = buildFloor(W, groundY, 3);
  // a hand centered on the first interior gap
  const gapCenter = (floor[0].x2 + floor[1].x1) / 2;
  const dancers = [{ color: "#ff3ec8", keypoints: {
    leftWrist: { x: gapCenter, y: groundY, score: 1 },
    rightWrist: { x: 0, y: 0, score: 0 },
  } }];
  const platforms = buildPlatforms(floor, dancers, handHalfWidth);
  // a man standing right at the gap center should be supported by the hand
  const man = { x: gapCenter, y: groundY, vy: 0, state: "walking" };
  const next = stepMan(man, platforms, 0.05);
  assert.equal(next.state, "walking", "man should be held up by the hand bridge");
});

test("buildPlatforms: a man can stand on a hand platform", () => {
  const dancers = [{ color: "#3ee0ff", keypoints: { leftWrist: { x: 300, y: 250, score: 1 }, rightWrist: { x: 0, y: 0, score: 0 } } }];
  const plats = buildPlatforms([], dancers, 45, 0.3);
  const man = { x: 300, y: 248, vy: 5, state: "falling" };
  const next = stepMan(man, plats, 0.05);
  assert.equal(next.state, "walking");
  assert.equal(next.standingOn, "hand");
});
