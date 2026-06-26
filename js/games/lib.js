// games/lib.js — pure helpers shared by the games.
//
// Everything here is side-effect-free and browser-free so it can be unit
// tested directly with synthetic dancer data. The games import these and add
// only drawing + state on top.

export const KP_MIN = 0.3;

// Distance between two keypoints (ignores low-confidence points → returns null).
export function dist(a, b) {
  if (!a || !b) return null;
  if (a.score < KP_MIN || b.score < KP_MIN) return null;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Angle (degrees) at vertex b formed by points a-b-c. Null if any point weak.
export function angleAt(a, b, c) {
  if (!a || !b || !c) return null;
  if (a.score < KP_MIN || b.score < KP_MIN || c.score < KP_MIN) return null;
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return null;
  let cos = dot / (m1 * m2);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

// The joint angles we use to describe/compare a pose. Size- and position-
// invariant, so a small kid far away scores the same as a big kid up close.
export function poseAngles(kp) {
  return {
    leftElbow: angleAt(kp.leftShoulder, kp.leftElbow, kp.leftWrist),
    rightElbow: angleAt(kp.rightShoulder, kp.rightElbow, kp.rightWrist),
    leftShoulder: angleAt(kp.leftElbow, kp.leftShoulder, kp.leftHip),
    rightShoulder: angleAt(kp.rightElbow, kp.rightShoulder, kp.rightHip),
    leftKnee: angleAt(kp.leftHip, kp.leftKnee, kp.leftAnkle),
    rightKnee: angleAt(kp.rightHip, kp.rightKnee, kp.rightAnkle),
  };
}

// Compare a dancer's angles to a target. Returns a 0..100 score. Missing
// angles (occluded limbs) are skipped, not penalised — forgiving for kids.
// `tolerance` is the angle difference (deg) that still scores ~full marks.
export function poseScore(currentAngles, targetAngles, tolerance = 35) {
  let total = 0;
  let counted = 0;
  for (const key of Object.keys(targetAngles)) {
    const target = targetAngles[key];
    const cur = currentAngles[key];
    if (target == null || cur == null) continue;
    const diff = Math.abs(target - cur);
    // linear falloff: 0 diff → 1.0, >= 2*tolerance → 0.0
    const s = Math.max(0, 1 - diff / (2 * tolerance));
    total += s;
    counted++;
  }
  if (counted === 0) return 0;
  return Math.round((total / counted) * 100);
}

// Motion score for freeze detection: average movement of tracked keypoints
// between two frames for the same dancer. Higher = moved more.
export function motionScore(prevKp, curKp) {
  let total = 0;
  let counted = 0;
  for (const name of Object.keys(curKp)) {
    const a = prevKp?.[name];
    const b = curKp[name];
    const d = dist(a, b);
    if (d == null) continue;
    total += d;
    counted++;
  }
  if (counted === 0) return 0;
  return total / counted;
}

// Is point (px,py) within `radius` of either wrist of any dancer?
export function wristHit(dancers, px, py, radius) {
  for (const d of dancers) {
    for (const wristName of ["leftWrist", "rightWrist"]) {
      const w = d.keypoints[wristName];
      if (!w || w.score < KP_MIN) continue;
      if (Math.hypot(w.x - px, w.y - py) <= radius) return d;
    }
  }
  return null;
}

// --- Sparkle particle system (tiny, for pop/celebration effects) -----------
export function makeSparkles() {
  return [];
}
export function spawnSparkles(list, x, y, color, n = 12) {
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + Math.random();
    const speed = 60 + Math.random() * 140;
    list.push({
      x, y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      life: 1,
      color,
    });
  }
}
export function updateSparkles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 200 * dt; // gravity
    p.life -= dt * 1.6;
    if (p.life <= 0) list.splice(i, 1);
  }
}
export function drawSparkles(ctx, list) {
  for (const p of list) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + 4 * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Centroid of a dancer's torso (for placing crowns / labels above them).
export function headPoint(kp) {
  const n = kp.nose;
  if (n && n.score >= KP_MIN) return { x: n.x, y: n.y };
  // fall back to shoulder midpoint
  const ls = kp.leftShoulder, rs = kp.rightShoulder;
  if (ls && rs && ls.score >= KP_MIN && rs.score >= KP_MIN) {
    return { x: (ls.x + rs.x) / 2, y: Math.min(ls.y, rs.y) - 40 };
  }
  return null;
}

// Distance between the shoulders — our unit for scaling decorations so a girl
// closer to the camera (bigger on screen) gets proportionally bigger crown/gown.
// Returns null if shoulders aren't both confidently detected.
export function shoulderWidth(kp) {
  const d = dist(kp.leftShoulder, kp.rightShoulder);
  return d;
}

// Scale-and-center a set of {x,y} points to fit inside a box {x,y,w,h} with
// padding, preserving aspect ratio. Pure — used by the Copy-Pose preview so the
// whole figure always fits and can't be clipped. Returns new points + the
// transform (scale, offset) in case the caller needs it.
export function fitToBox(points, box, pad = 0.12) {
  if (!points.length) return { points: [], scale: 1, ox: box.x, oy: box.y };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const srcW = Math.max(1e-6, maxX - minX);
  const srcH = Math.max(1e-6, maxY - minY);
  const padX = box.w * pad, padY = box.h * pad;
  const availW = box.w - 2 * padX;
  const availH = box.h - 2 * padY;
  const scale = Math.min(availW / srcW, availH / srcH);
  // center the scaled figure within the box
  const drawnW = srcW * scale, drawnH = srcH * scale;
  const ox = box.x + padX + (availW - drawnW) / 2 - minX * scale;
  const oy = box.y + padY + (availH - drawnH) / 2 - minY * scale;
  const out = points.map((p) => ({ x: p.x * scale + ox, y: p.y * scale + oy, tag: p.tag }));
  return { points: out, scale, ox, oy };
}
