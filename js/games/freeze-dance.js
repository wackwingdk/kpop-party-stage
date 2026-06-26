// freeze-dance.js — Game 1.
//
// Host plays music. Dancers move freely. At random intervals the screen shows
// a big "FREEZE!" and everyone must hold still. During the freeze window we
// measure each dancer's motion; movers get a playful grey wobble for THAT
// round only and rejoin next round (no real elimination — kid-friendly).
// Still dancers get a sparkle crown.

import {
  motionScore, headPoint, makeSparkles, spawnSparkles, updateSparkles, drawSparkles,
} from "./lib.js";

// Phases: DANCE → (FREEZE countdown) → JUDGE → reveal → back to DANCE
const PHASE = { DANCE: "dance", FREEZE: "freeze", REVEAL: "reveal" };
const MOVE_THRESHOLD = 14; // avg px/ frame movement above which a dancer "moved" (generous)

export default {
  id: "freeze-dance",
  title: "Freeze Dance",
  emoji: "⏯️",

  start() {
    this.phase = PHASE.DANCE;
    this.timer = randBetween(6, 14); // seconds until next FREEZE
    this.freezeElapsed = 0;
    this.prevKpById = {};            // last frame keypoints per dancer id
    this.movedById = {};             // did this dancer move during the freeze?
    this.maxMotionById = {};         // peak motion seen this freeze
    this.sparkles = makeSparkles();
    this.revealElapsed = 0;
  },

  update(ctx, dancers, dt) {
    const W = ctx.canvas.width, H = ctx.canvas.height;

    // Track per-dancer motion every frame (needed during freeze).
    const motionNow = {};
    for (const d of dancers) {
      const prev = this.prevKpById[d.id];
      motionNow[d.id] = prev ? motionScore(prev, d.keypoints) : 0;
      this.prevKpById[d.id] = d.keypoints;
    }

    if (this.phase === PHASE.DANCE) {
      this.timer -= dt;
      drawHint(ctx, "Dance! 🎵", W, H);
      if (this.timer <= 0) this._enterFreeze(dancers);
    } else if (this.phase === PHASE.FREEZE) {
      this.freezeElapsed += dt;
      // accumulate who moved
      for (const d of dancers) {
        const m = motionNow[d.id] ?? 0;
        this.maxMotionById[d.id] = Math.max(this.maxMotionById[d.id] ?? 0, m);
        if (m > MOVE_THRESHOLD) this.movedById[d.id] = true;
      }
      drawFreezeText(ctx, W, H, this.freezeElapsed);
      // freeze window is ~1.6s
      if (this.freezeElapsed >= 1.6) this._enterReveal(dancers);
    } else if (this.phase === PHASE.REVEAL) {
      this.revealElapsed += dt;
      drawHint(ctx, "Results! ✨", W, H);
      if (this.revealElapsed >= 2.4) this._enterDance();
    }

    // Per-dancer decorations
    for (const d of dancers) {
      const head = headPoint(d.keypoints);
      if (!head) continue;
      if (this.phase === PHASE.REVEAL || this.phase === PHASE.FREEZE) {
        const moved = this.movedById[d.id];
        if (moved) {
          drawLabel(ctx, head.x, head.y, "wobble! 🫠", "#9aa0b5");
        } else {
          drawLabel(ctx, head.x, head.y, "👑", "#ffd23e", 54);
          if (this.phase === PHASE.REVEAL && Math.random() < 0.3) {
            spawnSparkles(this.sparkles, head.x, head.y, d.color, 6);
          }
        }
      }
    }

    updateSparkles(this.sparkles, dt);
    drawSparkles(ctx, this.sparkles);
  },

  stop() {
    this.sparkles = [];
  },

  // --- phase transitions ---
  _enterFreeze() {
    this.phase = PHASE.FREEZE;
    this.freezeElapsed = 0;
    this.movedById = {};
    this.maxMotionById = {};
  },
  _enterReveal() {
    this.phase = PHASE.REVEAL;
    this.revealElapsed = 0;
  },
  _enterDance() {
    this.phase = PHASE.DANCE;
    this.timer = randBetween(6, 14);
  },
};

// --- drawing helpers (local; not shared) -----------------------------------
function drawFreezeText(ctx, W, H, elapsed) {
  // flashing pink/white
  const flash = Math.floor(elapsed * 6) % 2 === 0;
  ctx.save();
  ctx.fillStyle = "rgba(11,11,22,0.35)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.round(W * 0.16)}px "Baloo 2", system-ui, sans-serif`;
  ctx.shadowColor = "#ff3ec8";
  ctx.shadowBlur = 50;
  ctx.fillStyle = flash ? "#ffffff" : "#ff3ec8";
  ctx.fillText("FREEZE!", W / 2, H / 2);
  ctx.restore();
}

function drawHint(ctx, text, W, H) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `800 ${Math.round(W * 0.045)}px "Baloo 2", system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.shadowColor = "#b06bff";
  ctx.shadowBlur = 18;
  ctx.fillText(text, W / 2, H * 0.12);
  ctx.restore();
}

function drawLabel(ctx, x, y, text, color, size = 30) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `800 ${size}px "Baloo 2", system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillText(text, x, y - 50);
  ctx.restore();
}

function randBetween(a, b) {
  return a + Math.random() * (b - a);
}

// Exposed for unit tests (pure decision: did the dancer move?).
export const __test = { MOVE_THRESHOLD };
