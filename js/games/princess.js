// princess.js — "Princess Magic" live filter (replaces the old photo booth).
//
// No snapshot, no countdown — the girls just see themselves turned into
// princesses, live, with decorations tracking their bodies every frame:
//   👑 crown above the head, 👗 glowing gown from the shoulders, 🪄 wand near a
//   hand, and a gentle ✨ sparkle aura. Everything scales by shoulder width so
//   it fits each girl whether she's close or far, and works for 3-4 at once.

import {
  headPoint, shoulderWidth, shoulderTilt, boneTransform, KP_MIN,
  makeSparkles, spawnSparkles, updateSparkles, drawSparkles,
} from "./lib.js";
import { buildDressAssets } from "./dress-assets.js";
import { DANCER_COLORS } from "../engine.js";

export default {
  id: "princess",
  title: "Princess Magic",
  emoji: "👑",

  start() {
    this.sparkles = makeSparkles();
    this.t = 0;
    // Decode the SVG outfit (per dancer color) once; drawing waits until ready.
    this.assets = null;
    buildDressAssets(DANCER_COLORS).then((a) => { this.assets = a; });
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

      const outfit = this.assets ? this.assets[d.color] : null;
      if (outfit && outfit.gown) {
        // sleeves first (so the gown body overlaps the shoulder seam nicely)
        drawSleeve(ctx, outfit.sleeve, kp.leftShoulder, kp.leftElbow, sw);
        drawSleeve(ctx, outfit.sleeve, kp.rightShoulder, kp.rightElbow, sw);
        drawDress(ctx, outfit.gown, kp, sw);
      }
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

  stop() { this.sparkles = []; this.assets = null; },
};

// --- dress (SVG image) drawing ---------------------------------------------

// Draw the gown image anchored at the shoulder midpoint, scaled by shoulder
// width, leaning with the shoulder tilt. The SVG's anchor is its top-center
// (100,30) in a 200×320 box, so we size by width and offset accordingly.
function drawDress(ctx, gownImg, kp, sw) {
  const ls = kp.leftShoulder, rs = kp.rightShoulder;
  if (!ls || !rs || ls.score < KP_MIN || rs.score < KP_MIN) return;
  const midX = (ls.x + rs.x) / 2;
  const midY = (ls.y + rs.y) / 2;

  // Make the gown a bit wider than the shoulders so it reads as a dress.
  const targetW = sw * 2.4;
  const aspect = gownImg.height / gownImg.width; // 320/200 = 1.6
  const targetH = targetW * aspect;

  ctx.save();
  ctx.translate(midX, midY);
  ctx.rotate(shoulderTilt(kp));
  ctx.shadowColor = "rgba(255,255,255,0.35)";
  ctx.shadowBlur = 12;
  // anchor top-center: SVG anchor is at x=100/200 (center), y=30/320 from top.
  const anchorYFrac = 30 / 320;
  ctx.drawImage(gownImg, -targetW / 2, -targetH * anchorYFrac, targetW, targetH);
  ctx.restore();
}

// Draw a puff sleeve along the upper arm (shoulder→elbow), rotated to match.
// Skipped if the arm isn't confidently detected (no floating sleeves).
function drawSleeve(ctx, sleeveImg, shoulder, elbow, sw) {
  if (!sleeveImg) return;
  const t = boneTransform(shoulder, elbow);
  if (!t) return;

  // size sleeve to the arm: width ~ shoulder width * 0.7, length ~ arm length.
  const targetW = sw * 0.8;
  const aspect = sleeveImg.height / sleeveImg.width; // 90/80
  const targetH = Math.max(t.length * 1.1, targetW * aspect);

  ctx.save();
  ctx.translate(t.x, t.y);
  // sleeve SVG hangs downward (+y); rotate so its +y axis points along the arm.
  ctx.rotate(t.angle - Math.PI / 2);
  // anchor top-center (40,12 in an 80×90 box)
  ctx.drawImage(sleeveImg, -targetW / 2, -targetH * (12 / 90), targetW, targetH);
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

const SPARKLE_COLORS = ["#ffd23e", "#ff3ec8", "#3ee0ff", "#ffffff", "#b06bff"];
function pickSparkleColor(t) {
  return SPARKLE_COLORS[Math.floor(t * 3) % SPARKLE_COLORS.length];
}
