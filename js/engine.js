// engine.js — the shared Pose Engine.
//
// Owns the hard parts so games don't have to: webcam capture, MoveNet pose
// detection, mirrored drawing, keypoint naming, delta-time, and adaptive
// performance. Each frame it draws the mirrored camera, then calls the active
// game's update(ctx, dancers, dt) with ready-to-use, mirrored, named keypoints.
//
// Games never touch the camera or the model — they only read `dancers`.

// The 17 MoveNet keypoints, in the fixed order the model returns them.
// We translate this array into named fields so games read dancer.keypoints.leftWrist.
const KEYPOINT_NAMES = [
  "nose",
  "leftEye", "rightEye",
  "leftEar", "rightEar",
  "leftShoulder", "rightShoulder",
  "leftElbow", "rightElbow",
  "leftWrist", "rightWrist",
  "leftHip", "rightHip",
  "leftKnee", "rightKnee",
  "leftAnkle", "rightAnkle",
];

// Distinct neon colors assigned per dancer (by detection slot) so each girl
// can recognise "that glow is me".
const DANCER_COLORS = [
  "#ff3ec8", // hot pink
  "#3ee0ff", // cyan
  "#b06bff", // purple
  "#ffd23e", // gold
  "#5dff7a", // green (spare)
  "#ff7a3e", // orange (spare)
];

// Skeleton bones to draw (pairs of keypoint names).
const SKELETON = [
  ["leftShoulder", "rightShoulder"],
  ["leftShoulder", "leftElbow"], ["leftElbow", "leftWrist"],
  ["rightShoulder", "rightElbow"], ["rightElbow", "rightWrist"],
  ["leftShoulder", "leftHip"], ["rightShoulder", "rightHip"],
  ["leftHip", "rightHip"],
  ["leftHip", "leftKnee"], ["leftKnee", "leftAnkle"],
  ["rightHip", "rightKnee"], ["rightKnee", "rightAnkle"],
];

// Quality levels for adaptive performance (index = level; 0 is best).
const QUALITY_LEVELS = [
  { model: "thunder",   width: 960, height: 720, detectEvery: 1 }, // L0 best
  { model: "lightning", width: 960, height: 720, detectEvery: 1 }, // L1 default
  { model: "lightning", width: 640, height: 480, detectEvery: 1 }, // L2
  { model: "lightning", width: 640, height: 480, detectEvery: 2 }, // L3 safe
];
const DEFAULT_LEVEL = 1;
const KEYPOINT_MIN_SCORE = 0.3;

export class PoseEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.video = document.createElement("video");
    this.video.playsInline = true;
    this.video.muted = true;

    this.detector = null;
    this.stream = null;
    this.running = false;
    this.activeGame = null;

    // timing
    this._lastFrameTime = 0;
    this._frameCountWindow = 0;
    this._windowStart = 0;
    this.fps = 0;

    // adaptive performance
    this.qualityLevel = DEFAULT_LEVEL;
    this._lowSince = null;
    this._highSince = null;
    this._frameIndex = 0;
    this._lastDancers = []; // cache for frames we skip detection on

    // dancer color/id stability
    this._showFps = false;

    // callbacks the shell can hook
    this.onError = null; // (code, message) => void

    // test hook: when set, used instead of the real model output
    this._syntheticDancers = null;
  }

  // ---- lifecycle ----------------------------------------------------------

  async init() {
    await this._setupBackend();
    await this._startCamera(QUALITY_LEVELS[this.qualityLevel]);
    await this._createDetector(QUALITY_LEVELS[this.qualityLevel].model);
  }

  async _setupBackend() {
    // Prefer GPU (WebGL); fall back to CPU so it never hard-fails.
    try {
      const ok = await tf.setBackend("webgl");
      if (!ok) await tf.setBackend("cpu");
    } catch (_) {
      await tf.setBackend("cpu");
    }
    await tf.ready();
    this.backend = tf.getBackend();
  }

  async _startCamera({ width, height }) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width, height, facingMode: "user" },
        audio: false,
      });
    } catch (e) {
      this._fail("camera", e.message);
      throw e;
    }
    this.video.srcObject = this.stream;
    await this.video.play();
    // size the canvas to the actual video so coordinates line up
    const track = this.stream.getVideoTracks()[0];
    const settings = track.getSettings();
    this.canvas.width = settings.width || width;
    this.canvas.height = settings.height || height;
  }

  async _createDetector(modelType) {
    try {
      const type =
        modelType === "thunder"
          ? poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING // multipose has no thunder; see note
          : poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING;
      // NOTE: MoveNet MultiPose only ships a "lightning" variant. We keep the
      // quality "model" field for future-proofing, but multipose detection is
      // always lightning. Quality is varied via resolution + detectEvery.
      this.detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: type,
          enableTracking: true,
          trackerType: poseDetection.TrackerType.BoundingBox,
        }
      );
    } catch (e) {
      this._fail("model", e.message);
      throw e;
    }
  }

  start() {
    this.running = true;
    this._windowStart = performance.now();
    this._lastFrameTime = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  stop() {
    this.running = false;
    if (this.activeGame) {
      try { this.activeGame.stop(); } catch (_) {}
      this.activeGame = null;
    }
  }

  destroy() {
    this.stop();
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
  }

  // ---- game switching -----------------------------------------------------

  setGame(game) {
    if (this.activeGame) {
      try { this.activeGame.stop(); } catch (_) {}
    }
    this.activeGame = game;
    if (game) {
      try {
        game.start(this.ctx, this);
      } catch (e) {
        // a game that crashes on start must not take down the app
        this.activeGame = null;
        if (this.onError) this.onError("game", `Game failed to start: ${e.message}`);
      }
    }
  }

  // ---- the main loop ------------------------------------------------------

  async _loop(now) {
    if (!this.running) return;

    const dt = Math.min(0.1, (now - this._lastFrameTime) / 1000); // clamp big gaps
    this._lastFrameTime = now;

    // 1) draw mirrored camera
    this._drawMirroredVideo();

    // 2) detection (possibly skipped this frame for performance)
    const cfg = QUALITY_LEVELS[this.qualityLevel];
    let dancers;
    if (this._syntheticDancers) {
      dancers = this._syntheticDancers; // test injection
    } else if (this._frameIndex % cfg.detectEvery === 0) {
      dancers = await this._detect();
      this._lastDancers = dancers;
    } else {
      dancers = this._lastDancers; // reuse last detection on skipped frames
    }
    this._frameIndex++;

    // 3) draw neon skeleton overlay
    this._drawSkeletons(dancers);

    // 4) hand to the active game
    if (this.activeGame) {
      try {
        this.activeGame.update(this.ctx, dancers, dt);
      } catch (e) {
        // one game can never crash the whole app: drop to no game + notify
        const failed = this.activeGame;
        try { failed.stop(); } catch (_) {}
        this.activeGame = null;
        if (this.onError) this.onError("game", `Game error: ${e.message}`);
      }
    }

    // 5) performance bookkeeping
    this._updateFps(now);
    if (this._showFps) this._drawFpsBadge();

    requestAnimationFrame((t) => this._loop(t));
  }

  async _detect() {
    let poses = [];
    try {
      poses = await this.detector.estimatePoses(this.video, { flipHorizontal: false });
    } catch (_) {
      // transient per-frame errors are fine; return last good set
      return this._lastDancers;
    }
    return poses.map((p, i) => this._toDancer(p, i));
  }

  // Convert a raw MoveNet pose into our named, mirrored dancer object.
  _toDancer(pose, slot) {
    const kp = {};
    for (let i = 0; i < pose.keypoints.length; i++) {
      const name = KEYPOINT_NAMES[i];
      const point = pose.keypoints[i];
      kp[name] = {
        x: this.canvas.width - point.x, // mirror X to match mirrored video
        y: point.y,
        score: point.score,
      };
    }
    // bounding box (mirrored)
    let box = null;
    if (pose.box) {
      box = {
        x: this.canvas.width - (pose.box.xMax ?? 0),
        y: pose.box.yMin ?? 0,
        width: (pose.box.xMax ?? 0) - (pose.box.xMin ?? 0),
        height: (pose.box.yMax ?? 0) - (pose.box.yMin ?? 0),
      };
    }
    return {
      id: pose.id ?? slot,
      colorIndex: (pose.id ?? slot) % DANCER_COLORS.length,
      color: DANCER_COLORS[(pose.id ?? slot) % DANCER_COLORS.length],
      keypoints: kp,
      box,
    };
  }

  // ---- drawing ------------------------------------------------------------

  _drawMirroredVideo() {
    const { ctx, canvas, video } = this;
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
    // subtle dark vignette so neon overlays pop on a TV
    ctx.fillStyle = "rgba(11, 11, 22, 0.18)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  _drawSkeletons(dancers) {
    const { ctx } = this;
    for (const d of dancers) {
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 14;
      for (const [a, b] of SKELETON) {
        const pa = d.keypoints[a];
        const pb = d.keypoints[b];
        if (!pa || !pb) continue;
        if (pa.score < KEYPOINT_MIN_SCORE || pb.score < KEYPOINT_MIN_SCORE) continue;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
      // joints
      for (const name of KEYPOINT_NAMES) {
        const p = d.keypoints[name];
        if (!p || p.score < KEYPOINT_MIN_SCORE) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
  }

  _drawFpsBadge() {
    const { ctx } = this;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(10, 10, 220, 34);
    ctx.fillStyle = "#5dff7a";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.fillText(`FPS ${this.fps}  ·  Q${this.qualityLevel}  ·  ${this.backend}`, 18, 34);
    ctx.restore();
  }

  // ---- adaptive performance ----------------------------------------------

  _updateFps(now) {
    this._frameCountWindow++;
    if (now - this._windowStart >= 1000) {
      this.fps = this._frameCountWindow;
      this._frameCountWindow = 0;
      this._windowStart = now;
      this._adaptQuality(now);
    }
  }

  // Hysteresis: step DOWN if sustained <22 FPS for 2s; step UP if sustained
  // >50 FPS for 5s. Asymmetric thresholds + delays prevent flapping.
  _adaptQuality(now) {
    const fps = this.fps;
    if (fps < 22) {
      this._highSince = null;
      if (this._lowSince === null) this._lowSince = now;
      if (now - this._lowSince >= 2000 && this.qualityLevel < QUALITY_LEVELS.length - 1) {
        this._setQuality(this.qualityLevel + 1);
        this._lowSince = null;
      }
    } else if (fps > 50) {
      this._lowSince = null;
      if (this._highSince === null) this._highSince = now;
      if (now - this._highSince >= 5000 && this.qualityLevel > 0) {
        this._setQuality(this.qualityLevel - 1);
        this._highSince = null;
      }
    } else {
      this._lowSince = null;
      this._highSince = null;
    }
  }

  // Pure function exposed for unit testing the hysteresis logic without a camera.
  // Given the current state and a new fps sample at time `now`, returns the
  // next quality level. (Mirrors _adaptQuality but side-effect free.)
  static computeNextQuality(state, fps, now) {
    let { level, lowSince, highSince } = state;
    const maxLevel = QUALITY_LEVELS.length - 1;
    if (fps < 22) {
      highSince = null;
      if (lowSince === null) lowSince = now;
      if (now - lowSince >= 2000 && level < maxLevel) {
        level += 1;
        lowSince = null;
      }
    } else if (fps > 50) {
      lowSince = null;
      if (highSince === null) highSince = now;
      if (now - highSince >= 5000 && level > 0) {
        level -= 1;
        highSince = null;
      }
    } else {
      lowSince = null;
      highSince = null;
    }
    return { level, lowSince, highSince };
  }

  async _setQuality(level) {
    this.qualityLevel = level;
    const cfg = QUALITY_LEVELS[level];
    // Changing resolution requires restarting the camera stream.
    try {
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      await this._startCamera(cfg);
    } catch (_) {
      // if camera restart fails, keep going at old settings
    }
  }

  toggleFps() { this._showFps = !this._showFps; }

  // ---- test support -------------------------------------------------------

  // Allow tests to inject scripted dancers (skips real detection).
  __setSyntheticDancers(dancers) { this._syntheticDancers = dancers; }
}

// Exposed so games/tests can share the constants.
export { KEYPOINT_NAMES, DANCER_COLORS, QUALITY_LEVELS, KEYPOINT_MIN_SCORE };
