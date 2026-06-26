// copy-pose.js — Game 3.
//
// A target idol pose appears (described by joint angles + a simple stick-figure
// preview drawn from those angles) with a countdown. Each dancer strikes it;
// we score them by comparing their limb ANGLES to the target — invariant to
// body size and screen position, and forgiving so everyone scores well.

import {
  poseAngles, poseScore, headPoint, fitToBox,
  makeSparkles, spawnSparkles, updateSparkles, drawSparkles,
} from "./lib.js";

// Target poses as joint angles (degrees). Angles roughly: 180 = straight limb,
// 90 = right angle. Defined so they're achievable and fun for kids.
const POSES = [
  {
    name: "Arms Up! 🙌",
    angles: { leftShoulder: 160, rightShoulder: 160, leftElbow: 175, rightElbow: 175 },
  },
  {
    name: "T-Pose ✈️",
    angles: { leftShoulder: 90, rightShoulder: 90, leftElbow: 175, rightElbow: 175 },
  },
  {
    name: "Heart Hands 💖",
    angles: { leftShoulder: 45, rightShoulder: 45, leftElbow: 60, rightElbow: 60 },
  },
  {
    name: "One Arm Wave 👋",
    angles: { rightShoulder: 150, rightElbow: 150, leftShoulder: 20, leftElbow: 160 },
  },
  {
    name: "Star Jump ⭐",
    angles: { leftShoulder: 130, rightShoulder: 130, leftKnee: 160, rightKnee: 160 },
  },
];

const PHASE = { SHOW: "show", STRIKE: "strike", SCORE: "score" };
const GOOD_SCORE = 70;

export default {
  id: "copy-pose",
  title: "Copy the Pose",
  emoji: "🕺",

  start() {
    this.index = 0;
    this.sparkles = makeSparkles();
    this._enterShow();
  },

  update(ctx, dancers, dt) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const pose = POSES[this.index];

    // Always draw the target preview (top-right corner) so kids can see it.
    drawTargetPreview(ctx, pose, W, H);
    drawTitle(ctx, pose.name, W, H);

    this.phaseElapsed += dt;

    if (this.phase === PHASE.SHOW) {
      const remaining = Math.ceil(3 - this.phaseElapsed);
      drawBigCount(ctx, remaining > 0 ? String(remaining) : "STRIKE!", W, H);
      if (this.phaseElapsed >= 3) this._enterStrike();
    } else if (this.phase === PHASE.STRIKE) {
      // live scoring feedback per dancer
      for (const d of dancers) {
        const score = poseScore(poseAngles(d.keypoints), pose.angles);
        this._scoreById[d.id] = score;
        drawDancerScore(ctx, d, score);
      }
      if (this.phaseElapsed >= 4) this._enterScore(dancers);
    } else if (this.phase === PHASE.SCORE) {
      for (const d of dancers) {
        const score = this._scoreById[d.id] ?? 0;
        drawDancerScore(ctx, d, score, true);
        const head = headPoint(d.keypoints);
        if (head && score >= GOOD_SCORE && Math.random() < 0.25) {
          spawnSparkles(this.sparkles, head.x, head.y, d.color, 6);
        }
      }
      if (this.phaseElapsed >= 2.6) this._next();
    }

    updateSparkles(this.sparkles, dt);
    drawSparkles(ctx, this.sparkles);
  },

  stop() { this.sparkles = []; },

  _enterShow() { this.phase = PHASE.SHOW; this.phaseElapsed = 0; this._scoreById = {}; },
  _enterStrike() { this.phase = PHASE.STRIKE; this.phaseElapsed = 0; },
  _enterScore() { this.phase = PHASE.SCORE; this.phaseElapsed = 0; },
  _next() { this.index = (this.index + 1) % POSES.length; this._enterShow(); },
};

// --- pose figure builder (pure) --------------------------------------------

// Build a stick figure from target joint angles in an abstract coordinate
// space (y grows downward). Returns { head, bones: [[p1,p2], ...] }. The figure
// is later scaled into the preview box by fitToBox, so absolute sizes here are
// arbitrary — only proportions/angles matter.
//
// Angle convention (matches lib.poseAngles): for a shoulder, the angle is at
// the shoulder vertex between the elbow and the hip; ~20° = arm down by side,
// ~90° = arm straight out (T), ~160° = arm up. We map that to an elevation.
export function buildPoseFigure(angles) {
  const SHOULDER_Y = 0;
  const HALF = 30;     // half shoulder width
  const TORSO = 70;
  const UPPER = 34;    // upper-arm / thigh length
  const FORE = 30;     // forearm / shin length

  const neck = { x: 0, y: SHOULDER_Y };
  const head = { x: 0, y: SHOULDER_Y - 34 };
  const ls = { x: -HALF, y: SHOULDER_Y };
  const rs = { x: HALF, y: SHOULDER_Y };
  const lh = { x: -HALF * 0.7, y: SHOULDER_Y + TORSO };
  const rh = { x: HALF * 0.7, y: SHOULDER_Y + TORSO };

  // Arm: elevation from shoulder angle. side = -1 left, +1 right.
  // elevation 0 → straight down; 90 → horizontal; 160 → up.
  function arm(shoulder, sAngle, eAngle, side) {
    const elev = (sAngle ?? 20); // degrees up from straight-down
    const rad = (elev * Math.PI) / 180;
    // upper arm direction: down-and-out at elev 0, out at 90, up at 160
    const ux = side * Math.sin(rad);
    const uy = Math.cos(rad); // +y is down
    const elbow = { x: shoulder.x + ux * UPPER, y: shoulder.y + uy * UPPER };
    // forearm bends by elbow angle: 180 = straight continuation, smaller = bend up
    const bend = (180 - (eAngle ?? 175)) * (Math.PI / 180);
    // rotate the upper-arm direction by the bend (toward the body/up)
    const baseAng = Math.atan2(uy, ux);
    const foreAng = baseAng - side * bend;
    const wrist = {
      x: elbow.x + Math.cos(foreAng) * FORE,
      y: elbow.y + Math.sin(foreAng) * FORE,
    };
    return { elbow, wrist };
  }

  // Leg: knee angle ~175 straight, smaller = bent; spread by hip.
  function leg(hip, kAngle, side) {
    const straight = (kAngle ?? 175) > 150;
    const spread = straight ? 0.5 : 0.25;
    const knee = { x: hip.x + side * UPPER * spread, y: hip.y + UPPER };
    const ankle = {
      x: knee.x + side * FORE * (straight ? spread : 0.5),
      y: knee.y + FORE,
    };
    return { knee, ankle };
  }

  const la = arm(ls, angles.leftShoulder, angles.leftElbow, -1);
  const ra = arm(rs, angles.rightShoulder, angles.rightElbow, +1);
  const ll = leg(lh, angles.leftKnee, -1);
  const rl = leg(rh, angles.rightKnee, +1);

  const bones = [
    [neck, head],
    [ls, rs],            // shoulders
    [neck, { x: 0, y: SHOULDER_Y + TORSO }], // torso
    [ls, lh], [rs, rh],  // sides
    [lh, rh],            // hips
    [ls, la.elbow], [la.elbow, la.wrist],   // left arm
    [rs, ra.elbow], [ra.elbow, ra.wrist],   // right arm
    [lh, ll.knee], [ll.knee, ll.ankle],     // left leg
    [rh, rl.knee], [rl.knee, rl.ankle],     // right leg
  ];

  return { head, bones };
}

// --- drawing helpers --------------------------------------------------------

// Draw a stick figure from the target angles, scaled to ALWAYS fit its box.
// Fix for the "you can only see half the pose" bug: we first build the whole
// figure in an abstract space, then fitToBox scales+centers it so wide poses
// (T-Pose, Star Jump) can't be clipped.
function drawTargetPreview(ctx, pose, W, H) {
  const boxW = W * 0.16, boxH = boxW * 1.25;
  const box = { x: W - boxW - 24, y: 24, w: boxW, h: boxH };

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.strokeStyle = "#3ee0ff";
  ctx.lineWidth = 3;
  roundRect(ctx, box.x, box.y, box.w, box.h, 16);
  ctx.fill(); ctx.stroke();

  // Build the figure (abstract coords), collect all points, fit them into the box.
  const fig = buildPoseFigure(pose.angles);
  const allPts = [];
  for (const [a, b] of fig.bones) { allPts.push(a, b); }
  allPts.push(fig.head);
  const fitted = fitToBox(allPts, box, 0.16);

  // fitToBox returns points in the same order we pushed them: bones first
  // (2 per bone), then head last.
  ctx.strokeStyle = "#ffd23e";
  ctx.lineWidth = Math.max(3, box.w * 0.035);
  ctx.lineCap = "round";
  ctx.shadowColor = "#ffd23e";
  ctx.shadowBlur = 10;
  for (let i = 0; i < fig.bones.length; i++) {
    const a = fitted.points[i * 2];
    const b = fitted.points[i * 2 + 1];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // head circle (last fitted point)
  const head = fitted.points[fitted.points.length - 1];
  ctx.beginPath();
  ctx.arc(head.x, head.y, box.w * 0.09, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawDancerScore(ctx, d, score, big = false) {
  const head = headPoint(d.keypoints);
  if (!head) return;
  ctx.save();
  ctx.textAlign = "center";
  const size = big ? 56 : 38;
  ctx.font = `900 ${size}px "Baloo 2", system-ui, sans-serif`;
  const color = score >= GOOD_SCORE ? "#5dff7a" : d.color;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  const label = score >= 90 ? `${score}! ⭐` : `${score}`;
  ctx.fillText(label, head.x, head.y - 56);
  ctx.restore();
}

function drawTitle(ctx, text, W, H) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `800 ${Math.round(W * 0.05)}px "Baloo 2", system-ui, sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "#ff3ec8";
  ctx.shadowBlur = 18;
  ctx.fillText(text, W / 2, H * 0.12);
  ctx.restore();
}

function drawBigCount(ctx, text, W, H) {
  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.round(W * 0.16)}px "Baloo 2", system-ui, sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "#b06bff";
  ctx.shadowBlur = 45;
  ctx.fillText(text, W / 2, H / 2);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Exposed for unit tests.
export const __test = { POSES, GOOD_SCORE };
