// princess.js — "Princess Magic" live filter (replaces the old photo booth).
//
// No snapshot, no countdown — the girls just see themselves turned into
// princesses, live, with decorations tracking their bodies every frame:
//   👑 crown above the head, 👗 glowing gown from the shoulders, 🪄 wand near a
//   hand, and a gentle ✨ sparkle aura. Everything scales by shoulder width so
//   it fits each girl whether she's close or far, and works for 3-4 at once.

import {
  headPoint, shoulderWidth, KP_MIN,
  makeSparkles, spawnSparkles, updateSparkles, drawSparkles,
} from "./lib.js";

export default {
  id: "princess",
  title: "Princess Magic",
  emoji: "👑",

  start() {
    this.sparkles = makeSparkles();
    this.t = 0;
  },

  update(ctx, dancers, dt) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    this.t += dt;

    drawTitle(ctx, "✨ You're a Princess! ✨", W);

    for (const d of dancers) {
      const kp = d.keypoints;
      const sw = shoulderWidth(kp);
      if (!sw) continue; // need shoulders to anchor/scale decorations
      const scale = sw / 120; // 120px shoulders ≈ baseline size

      drawGown(ctx, kp, d.color, scale);
      drawCrown(ctx, kp, scale, this.t);
      drawWand(ctx, kp, scale);

      // sparkle aura: occasionally emit around the head
      const head = headPoint(kp);
      if (head && Math.random() < 0.25) {
        spawnSparkles(this.sparkles, head.x + (Math.random() - 0.5) * sw,
          head.y + (Math.random() - 0.2) * sw, pickSparkleColor(this.t), 3);
      }
    }

    updateSparkles(this.sparkles, dt);
    drawSparkles(ctx, this.sparkles);
  },

  stop() { this.sparkles = []; },
};

// --- decoration drawing -----------------------------------------------------

// A glowing translucent bell-shaped gown from shoulders down past the hips.
function drawGown(ctx, kp, color, scale) {
  const ls = kp.leftShoulder, rs = kp.rightShoulder;
  const lh = kp.leftHip, rh = kp.rightHip;
  if (!ls || !rs || ls.score < KP_MIN || rs.score < KP_MIN) return;

  const shoulderY = (ls.y + rs.y) / 2;
  const midX = (ls.x + rs.x) / 2;
  // hips give us the length; if missing, estimate from shoulder width
  let hipY;
  if (lh && rh && lh.score >= KP_MIN && rh.score >= KP_MIN) {
    hipY = (lh.y + rh.y) / 2;
  } else {
    hipY = shoulderY + 220 * scale;
  }
  const skirtBottom = hipY + 180 * scale;
  const topHalf = Math.abs(rs.x - ls.x) / 2 + 10 * scale;
  const bottomHalf = topHalf + 150 * scale; // flare out

  ctx.save();
  const grad = ctx.createLinearGradient(0, shoulderY, 0, skirtBottom);
  grad.addColorStop(0, hexWithAlpha(color, 0.85));
  grad.addColorStop(1, hexWithAlpha(color, 0.25));
  ctx.fillStyle = grad;
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.moveTo(midX - topHalf, shoulderY);
  ctx.lineTo(midX + topHalf, shoulderY);
  // flare down to a wide hem with a gentle curve
  ctx.quadraticCurveTo(midX + bottomHalf, (shoulderY + skirtBottom) / 2,
    midX + bottomHalf, skirtBottom);
  // scalloped hem
  const scallops = 6;
  for (let i = 0; i <= scallops; i++) {
    const x = midX + bottomHalf - (2 * bottomHalf) * (i / scallops);
    const y = skirtBottom + (i % 2 === 0 ? 0 : 18 * scale);
    ctx.lineTo(x, y);
  }
  ctx.quadraticCurveTo(midX - bottomHalf, (shoulderY + skirtBottom) / 2,
    midX - topHalf, shoulderY);
  ctx.closePath();
  ctx.fill();

  // a sparkly waist sash
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 6 * scale;
  ctx.beginPath();
  ctx.moveTo(midX - topHalf, hipY);
  ctx.lineTo(midX + topHalf, hipY);
  ctx.stroke();
  ctx.restore();
}

// A crown above the head, drawn as a golden zig-zag with jewels + emoji accent.
function drawCrown(ctx, kp, scale, t) {
  const head = headPoint(kp);
  if (!head) return;
  const w = 110 * scale;
  const h = 60 * scale;
  const cx = head.x;
  const cy = head.y - 70 * scale; // sit above the head

  ctx.save();
  ctx.translate(cx, cy);
  // gentle bob
  ctx.translate(0, Math.sin(t * 2) * 3 * scale);

  ctx.fillStyle = "#ffd23e";
  ctx.strokeStyle = "#ffb300";
  ctx.lineWidth = 3 * scale;
  ctx.shadowColor = "#ffd23e";
  ctx.shadowBlur = 18;

  // crown band with 3 points
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2);
  ctx.lineTo(-w / 2, 0);
  ctx.lineTo(-w / 4, h / 3);
  ctx.lineTo(0, -h / 2);
  ctx.lineTo(w / 4, h / 3);
  ctx.lineTo(w / 2, 0);
  ctx.lineTo(w / 2, h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // jewels
  const jewels = [[-w / 4, h / 4, "#ff3ec8"], [0, h / 6, "#3ee0ff"], [w / 4, h / 4, "#b06bff"]];
  ctx.shadowBlur = 8;
  for (const [jx, jy, jc] of jewels) {
    ctx.fillStyle = jc;
    ctx.beginPath();
    ctx.arc(jx, jy, 5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// A wand (emoji) near whichever wrist is higher / more visible.
function drawWand(ctx, kp, scale) {
  const lw = kp.leftWrist, rw = kp.rightWrist;
  let wrist = null;
  if (lw && lw.score >= KP_MIN && (!rw || rw.score < KP_MIN || lw.y < rw.y)) wrist = lw;
  else if (rw && rw.score >= KP_MIN) wrist = rw;
  if (!wrist) return;

  ctx.save();
  ctx.font = `${Math.round(54 * scale)}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#ffd23e";
  ctx.shadowBlur = 16;
  ctx.fillText("🪄", wrist.x, wrist.y);
  ctx.restore();
}

// --- helpers ---------------------------------------------------------------
function drawTitle(ctx, text, W) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `800 ${Math.round(W * 0.045)}px "Baloo 2", system-ui, sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "#ff3ec8";
  ctx.shadowBlur = 18;
  ctx.fillText(text, W / 2, ctx.canvas.height * 0.1);
  ctx.restore();
}

// Convert a #rrggbb hex + alpha (0..1) to an rgba() string.
function hexWithAlpha(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const SPARKLE_COLORS = ["#ffd23e", "#ff3ec8", "#3ee0ff", "#ffffff", "#b06bff"];
function pickSparkleColor(t) {
  return SPARKLE_COLORS[Math.floor(t * 3) % SPARKLE_COLORS.length];
}

// Exposed for tests.
export const __test = { hexWithAlpha };
