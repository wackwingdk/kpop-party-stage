// bridge-rescue.js — "Bridge Rescue" (Lemmings-style).
//
// Little men march from the left toward a castle on the right. The floor has
// gaps. Each player's HANDS (wrists) become floating stepping-stone platforms —
// hold them over a gap to let the men walk across. Each man who reaches the
// castle = +1 rescued (shared count). A man who falls goes "wheee!" and
// respawns. No losing — just keep rescuing. Cooperative and endless.

import {
  buildPlatforms, buildFloor, stepMan, isRescued, hasFallenOut,
} from "./bridge-physics.js";
import {
  makeSparkles, spawnSparkles, updateSparkles, drawSparkles,
} from "./lib.js";

const MAN_SIZE = 26;          // body height in px
const SPAWN_INTERVAL = 1.6;   // seconds between new men
const MAX_MEN = 8;            // cap on-screen men

export default {
  id: "bridge-rescue",
  title: "Bridge Rescue",
  emoji: "🌉",

  start(ctx) {
    this.men = [];
    this.sparkles = makeSparkles();
    this.rescued = 0;
    this.spawnTimer = 0;
    this._layoutFor(ctx.canvas.width, ctx.canvas.height);
  },

  update(ctx, dancers, dt) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    // re-layout if canvas size changed (e.g. adaptive perf switched resolution)
    if (this._w !== W || this._h !== H) this._layoutFor(W, H);

    // platforms = floor chunks + the dancers' hands (stepping stones)
    const platforms = buildPlatforms(this.floor, dancers, this.handHalfWidth);

    // spawn men
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.men.length < MAX_MEN) {
      this.spawnTimer = SPAWN_INTERVAL;
      this.men.push(this._spawnMan());
    }

    // advance + resolve each man
    for (let i = this.men.length - 1; i >= 0; i--) {
      let m = stepMan(this.men[i], platforms, dt);

      if (isRescued(m, this.goalX)) {
        this.rescued++;
        spawnSparkles(this.sparkles, this.goalX, m.y - MAN_SIZE / 2, "#ffd23e", 16);
        this.men.splice(i, 1);
        continue;
      }
      if (hasFallenOut(m, H + 60)) {
        // "wheee!" — sparkle puff where it left the screen, then respawn
        spawnSparkles(this.sparkles, m.x, H - 10, "#3ee0ff", 10);
        this.men[i] = this._spawnMan();
        continue;
      }
      this.men[i] = m;
    }

    // draw order: floor, goal, hand platforms, men, sparkles, HUD
    this._drawFloor(ctx, W, H);
    this._drawGoal(ctx, H);
    this._drawHandPlatforms(ctx, platforms);
    for (const m of this.men) this._drawMan(ctx, m);

    updateSparkles(this.sparkles, dt);
    drawSparkles(ctx, this.sparkles);

    this._drawHud(ctx, W);
  },

  stop() { this.men = []; this.sparkles = []; },

  // --- layout / spawning ---------------------------------------------------
  _layoutFor(W, H) {
    this._w = W; this._h = H;
    this.groundY = Math.round(H * 0.5);      // where men walk — middle of screen,
                                             // around chest/hand height for bridging
    this.goalX = Math.round(W * 0.93);
    // Pure layout enforces the balance rule (hole < hand bridge).
    const layout = buildFloor(W, this.groundY, 3);
    this.floor = layout.floor;
    this.gapWidth = layout.gapWidth;
    this.handHalfWidth = layout.handHalfWidth;
  },

  _spawnMan() {
    return { x: 20, y: this.groundY, vy: 0, state: "walking", standingOn: "floor" };
  },

  // --- drawing -------------------------------------------------------------
  _drawFloor(ctx, W, H) {
    // Draw platforms as ledges of fixed thickness (not filled to the bottom),
    // so the play area reads as floating platforms at mid-screen height.
    const thickness = Math.round(H * 0.10);
    ctx.save();
    for (const seg of this.floor) {
      const x = Math.max(0, seg.x1);
      const w = Math.min(W, seg.x2) - x;
      const grad = ctx.createLinearGradient(0, seg.y, 0, seg.y + thickness);
      grad.addColorStop(0, "#6a3fb0");
      grad.addColorStop(1, "#2a1850");
      ctx.fillStyle = grad;
      ctx.fillRect(x, seg.y, w, thickness);
      // glowing top edge (where the men walk)
      ctx.fillStyle = "#b06bff";
      ctx.fillRect(x, seg.y - 4, w, 6);
    }
    ctx.restore();
  },

  _drawGoal(ctx, H) {
    // a little castle/door at the goal
    const x = this.goalX, y = this.groundY;
    ctx.save();
    ctx.font = `${Math.round(MAN_SIZE * 2.4)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "#ffd23e";
    ctx.shadowBlur = 18;
    ctx.fillText("🏰", x, y + 4);
    ctx.restore();
  },

  _drawHandPlatforms(ctx, platforms) {
    ctx.save();
    for (const p of platforms) {
      if (p.kind !== "hand") continue;
      ctx.strokeStyle = p.color || "#3ee0ff";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.shadowColor = p.color || "#3ee0ff";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y);
      ctx.lineTo(p.x2, p.y);
      ctx.stroke();
    }
    ctx.restore();
  },

  _drawMan(ctx, m) {
    const s = MAN_SIZE;
    ctx.save();
    ctx.translate(m.x, m.y);
    // legs (feet at y=0), body up, round head
    const wobble = m.state === "falling" ? 0.25 : 0;
    ctx.rotate(wobble);
    // body
    ctx.fillStyle = "#ff7a3e";
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-s * 0.28, -s * 0.85, s * 0.56, s * 0.6, 5);
    ctx.fill(); ctx.stroke();
    // head
    ctx.fillStyle = "#ffe0c2";
    ctx.beginPath();
    ctx.arc(0, -s * 0.95, s * 0.26, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // legs
    ctx.strokeStyle = "#ff7a3e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 0.25); ctx.lineTo(-s * 0.15, 0);
    ctx.moveTo(s * 0.15, -s * 0.25); ctx.lineTo(s * 0.15, 0);
    ctx.stroke();
    if (m.state === "falling") {
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.round(s * 0.7)}px "Baloo 2", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("!", 0, -s * 1.4);
    }
    ctx.restore();
  },

  _drawHud(ctx, W) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = `900 ${Math.round(W * 0.045)}px "Baloo 2", system-ui, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#b06bff";
    ctx.shadowBlur = 16;
    ctx.fillText(`✨ Rescued: ${this.rescued} ✨`, W / 2, ctx.canvas.height * 0.1);
    ctx.font = `700 ${Math.round(W * 0.025)}px "Baloo 2", system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText("Use your hands as bridges! 🙌", W / 2, ctx.canvas.height * 0.16);
    ctx.restore();
  },
};
