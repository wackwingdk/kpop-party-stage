// pop-hearts.js — Game 4.
//
// Hearts and stars drift across the screen. Girls "pop" them by putting a wrist
// on them. Each pop = sparkle + a point on the shared TEAM score. A round runs
// ~75s with a gentle difficulty ramp (more/faster hearts over time).

import {
  wristHit, makeSparkles, spawnSparkles, updateSparkles, drawSparkles,
} from "./lib.js";

const ROUND_SECONDS = 75;
const EMOJI = ["💖", "⭐", "💜", "💛", "✨", "🩷"];

export default {
  id: "pop-hearts",
  title: "Pop the Hearts",
  emoji: "💖",

  start(ctx) {
    this.hearts = [];
    this.sparkles = makeSparkles();
    this.score = 0;
    this.timeLeft = ROUND_SECONDS;
    this.spawnTimer = 0;
    this.finished = false;
    this._w = ctx.canvas.width;
    this._h = ctx.canvas.height;
  },

  update(ctx, dancers, dt) {
    const W = ctx.canvas.width, H = ctx.canvas.height;

    if (!this.finished) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.finished = true; }
    }

    // difficulty ramps as time elapses (0 → 1)
    const progress = 1 - this.timeLeft / ROUND_SECONDS;
    const spawnInterval = Math.max(0.35, 1.1 - progress * 0.8); // faster over time
    const speedMul = 1 + progress * 1.2;

    // spawn hearts
    if (!this.finished) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = spawnInterval;
        this._spawnHeart(W, H, speedMul);
      }
    }

    // move + draw hearts, test for wrist hits
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const heart = this.hearts[i];
      heart.x += heart.vx * dt;
      heart.y += heart.vy * dt;

      // off screen → remove
      if (heart.x < -80 || heart.x > W + 80 || heart.y < -80 || heart.y > H + 80) {
        this.hearts.splice(i, 1);
        continue;
      }

      // hit test against wrists
      const hitter = wristHit(dancers, heart.x, heart.y, heart.r);
      if (hitter) {
        spawnSparkles(this.sparkles, heart.x, heart.y, hitter.color, 14);
        this.score++;
        this.hearts.splice(i, 1);
        continue;
      }

      drawHeart(ctx, heart);
    }

    updateSparkles(this.sparkles, dt);
    drawSparkles(ctx, this.sparkles);

    drawHud(ctx, this.score, Math.ceil(this.timeLeft), W, H);
    if (this.finished) drawFinish(ctx, this.score, W, H);
  },

  stop() {
    this.hearts = [];
    this.sparkles = [];
  },

  _spawnHeart(W, H, speedMul) {
    // enter from a random edge, drift across
    const fromLeft = Math.random() < 0.5;
    const y = 80 + Math.random() * (H - 200);
    const speed = (90 + Math.random() * 80) * speedMul;
    this.hearts.push({
      x: fromLeft ? -40 : W + 40,
      y,
      vx: fromLeft ? speed : -speed,
      vy: (Math.random() - 0.5) * 40,
      r: 46,
      emoji: EMOJI[Math.floor(Math.random() * EMOJI.length)],
    });
  },
};

// --- drawing helpers --------------------------------------------------------
function drawHeart(ctx, heart) {
  ctx.save();
  ctx.font = `${heart.r * 1.6}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#ff3ec8";
  ctx.shadowBlur = 18;
  ctx.fillText(heart.emoji, heart.x, heart.y);
  ctx.restore();
}

function drawHud(ctx, score, secs, W, H) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `900 ${Math.round(W * 0.05)}px "Baloo 2", system-ui, sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "#b06bff";
  ctx.shadowBlur = 16;
  ctx.fillText(`💖 ${score}`, W * 0.5, H * 0.1);

  ctx.font = `800 ${Math.round(W * 0.035)}px "Baloo 2", system-ui, sans-serif`;
  ctx.fillStyle = secs <= 10 ? "#ff3ec8" : "#3ee0ff";
  ctx.fillText(`⏱ ${secs}s`, W * 0.5, H * 0.17);
  ctx.restore();
}

function drawFinish(ctx, score, W, H) {
  ctx.save();
  ctx.fillStyle = "rgba(11,11,22,0.55)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.round(W * 0.09)}px "Baloo 2", system-ui, sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "#ff3ec8";
  ctx.shadowBlur = 40;
  ctx.fillText(`✨ ${score} hearts! ✨`, W / 2, H / 2 - 30);
  ctx.font = `800 ${Math.round(W * 0.04)}px "Baloo 2", system-ui, sans-serif`;
  ctx.fillText("Press ⬅ Menu to play again", W / 2, H / 2 + 50);
  ctx.restore();
}

// Exposed for unit tests.
export const __test = { ROUND_SECONDS };
