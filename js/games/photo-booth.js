// photo-booth.js — Game 2.
//
// Tap → 3-2-1 countdown → snapshot the current canvas, composite a neon K-pop
// frame + sparkles + "★ IDOL ★" caption → show big with Keep / Retake. Kept
// photos download to the PC and appear in a small session gallery.
//
// This game drives its own countdown + DOM buttons (via the engine ctx canvas
// for the image, and document for the buttons), because capture/Keep/Retake is
// a flow rather than a per-frame interaction.

import { makeSparkles, spawnSparkles, updateSparkles, drawSparkles, headPoint } from "./lib.js";

const STATE = { LIVE: "live", COUNTDOWN: "countdown", REVIEW: "review" };
let photoCounter = 0;

export default {
  id: "photo-booth",
  title: "Idol Photo Booth",
  emoji: "📸",

  start(ctx, engine) {
    this.engine = engine;
    this.state = STATE.LIVE;
    this.count = 3;
    this.countElapsed = 0;
    this.sparkles = makeSparkles();
    this.captured = null; // dataURL of the frozen shot
    this._buttons = null;
    this._stage = document.getElementById("stage");
    this._addLiveButton();
  },

  update(ctx, dancers, dt) {
    const W = ctx.canvas.width, H = ctx.canvas.height;

    if (this.state === STATE.LIVE) {
      drawCaption(ctx, "Strike a pose, then tap 📸", W, H);
      // sprinkle gentle sparkles over heads to make it feel alive
      for (const d of dancers) {
        const head = headPoint(d.keypoints);
        if (head && Math.random() < 0.04) spawnSparkles(this.sparkles, head.x, head.y, d.color, 4);
      }
    } else if (this.state === STATE.COUNTDOWN) {
      this.countElapsed += dt;
      const remaining = Math.ceil(3 - this.countElapsed);
      drawBigCount(ctx, remaining > 0 ? String(remaining) : "✦", W, H);
      if (this.countElapsed >= 3) this._capture(ctx);
    } else if (this.state === STATE.REVIEW) {
      // Frozen image is drawn over the canvas each frame so it stays put.
      if (this._frozenImg && this._frozenImg.complete) {
        ctx.drawImage(this._frozenImg, 0, 0, W, H);
      }
    }

    updateSparkles(this.sparkles, dt);
    drawSparkles(ctx, this.sparkles);
  },

  stop() {
    this._removeButtons();
    this.sparkles = [];
  },

  // --- flow ---
  _addLiveButton() {
    this._removeButtons();
    const btn = document.createElement("button");
    btn.className = "start-btn";
    btn.textContent = "📸 Take photo";
    btn.style.cssText = "position:absolute;bottom:6vh;left:50%;transform:translateX(-50%);z-index:25;";
    btn.onclick = () => this._startCountdown();
    this._stage.append(btn);
    this._buttons = [btn];
  },

  _startCountdown() {
    this._removeButtons();
    this.state = STATE.COUNTDOWN;
    this.countElapsed = 0;
  },

  _capture(ctx) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    // Composite frame + caption onto an offscreen canvas so the saved file
    // includes the decorations (the live canvas already has the camera frame).
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const octx = off.getContext("2d");
    octx.drawImage(ctx.canvas, 0, 0); // current camera + skeletons
    drawNeonFrame(octx, W, H);
    drawIdolCaption(octx, W, H);

    this.captured = off.toDataURL("image/png");
    // Pre-load as an image so REVIEW can redraw it each frame.
    this._frozenImg = new Image();
    this._frozenImg.src = this.captured;

    this.state = STATE.REVIEW;
    this._addReviewButtons();
  },

  _addReviewButtons() {
    this._removeButtons();
    const wrap = document.createElement("div");
    wrap.className = "photo-actions";
    const keep = document.createElement("button");
    keep.className = "keep-btn";
    keep.textContent = "💾 Keep";
    keep.onclick = () => this._keep();
    const retake = document.createElement("button");
    retake.className = "retake-btn";
    retake.textContent = "↻ Retake";
    retake.onclick = () => this._retake();
    wrap.append(keep, retake);
    this._stage.append(wrap);
    this._buttons = [wrap];
  },

  _keep() {
    photoCounter++;
    const name = `idol-photo-${String(photoCounter).padStart(2, "0")}.png`;
    // Trigger a browser download to the PC.
    const a = document.createElement("a");
    a.href = this.captured;
    a.download = name;
    a.click();
    this._addToGallery(this.captured);
    this._retake(); // back to live for the next shot
  },

  _retake() {
    this.state = STATE.LIVE;
    this._frozenImg = null;
    this.captured = null;
    this._addLiveButton();
  },

  _addToGallery(dataUrl) {
    let gallery = this._stage.querySelector(".gallery");
    if (!gallery) {
      gallery = document.createElement("div");
      gallery.className = "gallery";
      this._stage.append(gallery);
    }
    const img = new Image();
    img.src = dataUrl;
    gallery.append(img);
    // keep only the last 5 thumbnails
    while (gallery.children.length > 5) gallery.removeChild(gallery.firstChild);
  },

  _removeButtons() {
    if (this._buttons) {
      for (const b of this._buttons) b.remove();
      this._buttons = null;
    }
  },
};

// --- drawing helpers --------------------------------------------------------
function drawNeonFrame(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#ff3ec8");
  grad.addColorStop(0.5, "#ffd23e");
  grad.addColorStop(1, "#3ee0ff");
  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineWidth = Math.round(W * 0.02);
  ctx.shadowColor = "#ff3ec8";
  ctx.shadowBlur = 30;
  const m = ctx.lineWidth;
  ctx.strokeRect(m / 2, m / 2, W - m, H - m);
  ctx.restore();
}

function drawIdolCaption(ctx, W, H) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `900 ${Math.round(W * 0.06)}px "Baloo 2", system-ui, sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "#b06bff";
  ctx.shadowBlur = 24;
  ctx.fillText("★ IDOL ★", W / 2, H * 0.92);
  ctx.restore();
}

function drawCaption(ctx, text, W, H) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `800 ${Math.round(W * 0.045)}px "Baloo 2", system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.shadowColor = "#3ee0ff";
  ctx.shadowBlur = 16;
  ctx.fillText(text, W / 2, H * 0.12);
  ctx.restore();
}

function drawBigCount(ctx, text, W, H) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.round(W * 0.2)}px "Baloo 2", system-ui, sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "#ff3ec8";
  ctx.shadowBlur = 50;
  ctx.fillText(text, W / 2, H / 2);
  ctx.restore();
}
