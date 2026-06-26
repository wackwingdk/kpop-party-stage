// bridge-physics.js — pure platformer physics for the Bridge Rescue game.
//
// No browser, no canvas — just numbers, so the whole mechanic is unit-testable.
// Every walkable surface (floor chunk OR a player's hand) is a uniform
// "platform": { x1, x2, y } — a horizontal segment at height y spanning x1..x2.
// A "man" is { x, y, vy, state } where (x, y) is his feet (bottom-center).

export const GRAVITY = 1400;       // px/s^2
export const WALK_SPEED = 70;      // px/s to the right
export const SNAP_BAND = 26;       // how far below the feet a platform can be to "catch" him
export const MAX_FALL = 1200;      // terminal velocity (px/s)

// Find the highest platform currently supporting the man's feet.
// A platform supports him if his feet x is within [x1,x2] (with a little margin)
// and the platform is at, or just below, his feet (within SNAP_BAND), i.e. he is
// standing on top of it rather than under it. Returns the platform or null.
export function findSupport(man, platforms, margin = 6) {
  let best = null;
  for (const p of platforms) {
    if (man.x < p.x1 - margin || man.x > p.x2 + margin) continue;
    // platform must be below the feet (or essentially at them), within the band
    const dy = p.y - man.y;
    if (dy < -2) continue;            // platform is above the feet → not standing on it
    if (dy > SNAP_BAND) continue;     // too far below to catch this frame
    if (!best || p.y < best.y) best = p; // highest (smallest y) wins
  }
  return best;
}

// Advance one man by dt seconds given the platforms. Pure: returns a NEW man.
// Behavior: always walk right; if supported, stick to the platform top (y = p.y,
// vy = 0); else accelerate downward (fall). State becomes "falling" when no
// support, "walking" when supported.
export function stepMan(man, platforms, dt) {
  const next = { ...man };
  next.x = man.x + WALK_SPEED * dt;

  const support = findSupport(next, platforms);
  if (support) {
    next.y = support.y;
    next.vy = 0;
    next.state = "walking";
    next.standingOn = support.kind || "floor";
  } else {
    next.vy = Math.min(MAX_FALL, man.vy + GRAVITY * dt);
    next.y = man.y + next.vy * dt;
    next.state = "falling";
    next.standingOn = null;
  }
  return next;
}

// Has the man reached the goal (walked past goalX while not fallen)?
export function isRescued(man, goalX) {
  return man.state !== "lost" && man.x >= goalX;
}

// Has the man fallen off the bottom of the play area?
export function hasFallenOut(man, floorBottomY) {
  return man.y > floorBottomY;
}

// Build the floor layout (pure). Returns { floor:[{x1,x2,y}], gapWidth,
// handHalfWidth }. BALANCE RULE enforced here: a gap is sized as a fraction of
// the hand bridge width so a single hand always spans a hole with margin.
export function buildFloor(W, groundY, numGaps = 3) {
  const handHalfWidth = Math.round(W * 0.085);   // full hand ≈ 17% of width
  const handWidth = handHalfWidth * 2;
  const gap = Math.round(handWidth * 0.6);       // hole ≈ 0.6× a hand → coverable
  const startSolid = Math.round(W * 0.2);
  const endSolid = Math.round(W * 0.16);
  const middle = W - startSolid - endSolid;
  const chunk = Math.round((middle - numGaps * gap) / (numGaps + 1));

  const floor = [];
  floor.push({ x1: 0, x2: startSolid, y: groundY });
  let x = startSolid;
  for (let i = 0; i < numGaps; i++) {
    x += gap;
    floor.push({ x1: x, x2: x + chunk, y: groundY });
    x += chunk;
  }
  floor.push({ x1: W - endSolid, x2: W + 40, y: groundY });
  return { floor, gapWidth: gap, handHalfWidth, handWidth };
}

// Build platform objects from the floor segments + the dancers' hands.
// floorSegments: [{x1,x2,y}], dancers: engine dancer objects.
// handHalfWidth: half the width of a hand platform (px); kpMinScore gates hands.
export function buildPlatforms(floorSegments, dancers, handHalfWidth = 45, kpMinScore = 0.3) {
  const platforms = floorSegments.map((s) => ({ ...s, kind: "floor" }));
  for (const d of dancers) {
    for (const wristName of ["leftWrist", "rightWrist"]) {
      const w = d.keypoints[wristName];
      if (!w || w.score < kpMinScore) continue;
      platforms.push({
        x1: w.x - handHalfWidth,
        x2: w.x + handHalfWidth,
        y: w.y,
        kind: "hand",
        color: d.color,
      });
    }
  }
  return platforms;
}
