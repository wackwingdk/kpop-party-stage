// copy-pose.js — Game 3.
//
// A target idol pose appears (described by joint angles + a simple stick-figure
// preview drawn from those angles) with a countdown. Each dancer strikes it;
// we score them by comparing their limb ANGLES to the target — invariant to
// body size and screen position, and forgiving so everyone scores well.

import {
  poseAngles, poseScore, headPoint, makeSparkles, spawnSparkles, updateSparkles, drawSparkles,
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

// --- drawing helpers --------------------------------------------------------

// Draw a small stick figure from the target angles so kids see the shape.
function drawTargetPreview(ctx, pose, W, H) {
  const boxW = W * 0.16, boxH = boxW * 1.2;
  const x = W - boxW - 24, y = 24;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.strokeStyle = "#3ee0ff";
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, boxW, boxH, 16);
  ctx.fill(); ctx.stroke();

  // Build an approximate stick figure from the angles. We anchor shoulders/hips
  // and rotate limbs by the target angles. This is illustrative, not exact.
  const cx = x + boxW / 2, sy = y + boxH * 0.34;
  const limb = boxW * 0.22;
  const a = pose.angles;
  ctx.strokeStyle = "#ffd23e";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";

  // head
  ctx.beginPath();
  ctx.arc(cx, sy - limb * 0.7, limb * 0.35, 0, Math.PI * 2);
  ctx.stroke();
  // torso
  const hy = sy + limb * 1.4;
  ctx.beginPath(); ctx.moveTo(cx, sy); ctx.lineTo(cx, hy); ctx.stroke();
  // shoulders horizontal
  const lsX = cx - limb, rsX = cx + limb;
  ctx.beginPath(); ctx.moveTo(lsX, sy); ctx.lineTo(rsX, sy); ctx.stroke();

  // arms: use shoulder angle to decide elevation (rough mapping)
  drawLimbPair(ctx, lsX, sy, a.leftShoulder, a.leftElbow, limb, -1);
  drawLimbPair(ctx, rsX, sy, a.rightShoulder, a.rightElbow, limb, +1);

  // legs from hip
  drawLeg(ctx, cx, hy, a.leftKnee, limb, -1);
  drawLeg(ctx, cx, hy, a.rightKnee, limb, +1);

  ctx.restore();
}

function drawLimbPair(ctx, x, y, shoulderAngle, elbowAngle, limb, side) {
  // Map shoulder angle (0=down by side, 90=horizontal, 160=up) to a screen angle.
  const sa = (shoulderAngle ?? 20);
  // elbow point
  const rad = ((90 - sa) * Math.PI) / 180; // crude: more angle → more raised
  const ex = x + side * Math.cos(rad) * limb;
  const ey = y - Math.sin((sa / 180) * Math.PI) * limb;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
  // forearm continues outward
  const fx = ex + side * limb * 0.7;
  const fy = ey - ((elbowAngle ?? 175) > 120 ? limb * 0.2 : -limb * 0.4);
  ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(fx, fy); ctx.stroke();
}

function drawLeg(ctx, x, y, kneeAngle, limb, side) {
  const spread = (kneeAngle ?? 175) > 150 ? 0.7 : 0.3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + side * limb * spread, y + limb * 1.2);
  ctx.stroke();
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
