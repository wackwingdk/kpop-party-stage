# K-Pop Party Stage — Design Spec

**Date:** 2026-06-26
**For:** Melina's birthday party (8-year-old girls)
**Status:** Approved, implementing

## Purpose

An interactive website displayed on a TV (driven by a Windows 10 gaming PC with an
attached webcam). 3–4 girls stand in front of the camera; the screen reacts to their
bodies with fun, K-pop-themed dance mini-games. The host (adult) supplies the music
separately (phone/Spotify/YouTube) and operates the app via keyboard hotkeys; the
kids interact purely with their bodies.

## Verified assumptions (spike completed)

- Webcam + TensorFlow.js + MoveNet MultiPose pipeline **works**, verified end-to-end
  with Playwright and confirmed by the user on real hardware.
- On the user's Apple Silicon Mac: **~100 FPS** (lots of headroom).
- Party machine is an **older Windows 10 gaming PC** — performance there is unverified,
  so the engine self-tunes (see Adaptive Performance) and a `perf-check.html` is shipped
  for the user to measure before the party.
- A real bug was found & fixed during the spike: loading TFJS as piecemeal packages
  (`tfjs-core` + converter + backend) omits the chainable math ops, causing a misleading
  "Could not initialize any backends" error. **Fix: load the single unified
  `@tensorflow/tfjs` bundle.**

## Architecture

Shared **Pose Engine** + **pluggable game modules**. The engine owns everything hard
(camera, model, drawing, performance); each game is a small module that reads per-frame
dancer data and draws overlays.

```
index.html (fullscreen canvas on TV, K-pop neon)
  └─ App Shell / Menu (main.js): boots engine, runs title menu, swaps games
       └─ Pose Engine (engine.js): webcam → MoveNet MultiPose → mirrored draw
            → calls activeGame.update(ctx, dancers, dt) each frame
                 ├─ games/freeze-dance.js
                 ├─ games/photo-booth.js
                 ├─ games/copy-pose.js
                 └─ games/pop-hearts.js
```

Frame loop (~30–60+ fps): get camera frame → MoveNet → up to ~4 dancers → draw
mirrored video + neon overlay → call active game's `update(dancers)`.

### Tech choices
- Vanilla HTML/CSS/JS (no framework) — simple, reliable, easy to tweak.
- TensorFlow.js **unified bundle** + `@tensorflow-models/pose-detection` (MoveNet), via CDN.
- Tiny local static server (webcam requires `http://localhost`, not `file://`).
- Everything runs locally in-browser. No backend, no uploads, no accounts. Kids' video
  never leaves the PC.

## Game module contract

```js
export default {
  id: "freeze-dance",
  title: "Freeze Dance",
  emoji: "⏯️",
  start(ctx, engine) {},            // once, on entering the game
  update(ctx, dancers, dt) {},      // every frame, after engine draws the camera
  stop() {},                        // once, on leaving
};
```

Each `dancer` the engine passes (already mirrored, in canvas pixels):
```js
{
  id: 3,
  keypoints: { nose:{x,y,score}, leftWrist:{x,y,score}, rightWrist:{x,y,score},
               leftShoulder:{x,y,score}, /* …17 named MoveNet points… */ },
  box: { x, y, width, height },
}
```
Engine pre-mirrors coordinates and names keypoints so games stay tiny. Games receive
`dt` (seconds since last frame) to animate by time, not frame count.

## Adaptive performance (for the older Windows PC)

Engine runs an invisible quality manager:
- Rolling ~2s average FPS; quality level 0..3:
  - L0 (best): Thunder, 960×720, every frame
  - L1 (default start): Lightning, 960×720, every frame
  - L2: Lightning, 640×480, every frame
  - L3 (safe): Lightning, 640×480, detect every 2nd frame + interpolate
- avg FPS < 22 for 2s → step DOWN; avg FPS > 50 for 5s → step UP (hysteresis, no flapping).
- Detection FPS decoupled from video FPS: keep drawing video/overlays smoothly even when
  detecting less often (interpolate dot positions between detections).
- Small toggleable on-screen FPS badge for setup.
- `perf-check.html` shipped standalone so the user can measure FPS/tracking on any machine.

## Games (built in priority order)

1. **Freeze Dance** — host plays music; random "FREEZE!" with big visual + countdown.
   Engine measures per-dancer motion (sum of frame-to-frame keypoint displacement) during
   the freeze window; movers get a playful wobble/grey effect for that round only and
   **rejoin next round**. No real elimination (kid-friendly). Crowns spread around.
2. **Idol Photo Booth** — pick a neon frame, 3-2-1 countdown, snapshot composited with
   frame/sparkles + "★ IDOL ★" styling. Keep/Retake. Kept photos download to the PC
   (`idol-photo-01.png`…); session gallery strip.
3. **Copy the Pose** — target idol pose (reference image + target joint angles) with
   countdown; engine scores each dancer by comparing **limb angles** (size/position
   invariant, forgiving thresholds); per-girl scores + best-match sparkle. Cycles poses.
4. **Pop the Hearts** — hearts/stars drift; girls pop them by placing a wrist within the
   heart radius; sparkle + point; shared team score vs timer; gentle difficulty ramp;
   ~60–90s rounds.

Shared: persistent "⬅ Menu" button + Esc; big TV-readable text; fullscreen; per-dancer
distinct neon color (stable via dancer id).

## Visual theme & UI flow

- K-pop "idol stage": neon gradients (hot pink→purple→cyan), dark stage bg, sparkle
  particles, bold rounded display font, tasteful emoji.
- Title screen: 4 big game tiles + banner **"✨ Melina's K-Pop Stage ✨"** (single
  `PARTY_NAME = "Melina"` config value) + ⚙ camera picker.
- Interaction model: **kids use bodies; host uses keys.** Hotkeys: Esc=menu, F=fullscreen,
  D=toggle FPS badge, Space=pause/next where relevant.
- TV-readability: huge fonts, high contrast, effects readable from ~3m, one-time
  fullscreen prompt (browser requires a click).

## Error handling (party-day robustness)

Every failure resolves to a friendly screen with a **Retry** or **back-to-menu** button —
never a stack trace or black screen:
- Camera denied/blocked → instructions + Retry.
- No camera/unplugged → message + Retry; camera picker if multiple devices.
- Model load fails (offline/CDN) → message + Retry. (Optional/stretch: bundle model
  locally for full offline.)
- WebGL unavailable → automatic CPU fallback + small "performance mode" note.
- Low FPS → adaptive engine steps quality down automatically.
- A game throws mid-play → shell catches it, calls `stop()`, returns to menu. One game
  can never crash the whole app.

## Testing

- **Automated (Playwright, headless):** load app, enter each game, **inject synthetic
  `dancers`** (scripted skeletons), assert logic: wrist-on-heart ⇒ score++, big motion in
  freeze ⇒ marked moved, pose matches target ⇒ high score. Deterministic, no camera.
- **Engine unit tests:** mirroring math, keypoint naming, quality-step hysteresis (feed
  fake FPS ⇒ assert level changes).
- **Manual pre-party checklist (user):** run `perf-check.html` on the Windows PC (FPS +
  tracking), then play each game once with a real body. Documented in README.

## File layout

```
kpop-party-stage/
├── index.html
├── perf-check.html          # standalone FPS/tracking diagnostic for any machine
├── css/stage.css
├── js/
│   ├── main.js              # app shell, menu, game-swap, PARTY_NAME config, hotkeys
│   ├── engine.js           # camera + MoveNet + mirrored draw + adaptive performance
│   ├── ui.js               # menu, countdowns, banners, error screens (DOM helpers)
│   └── games/
│       ├── freeze-dance.js
│       ├── photo-booth.js
│       ├── copy-pose.js
│       └── pop-hearts.js
├── assets/poses/           # reference pose images for Copy-the-Pose
├── tests/                  # Playwright smoke tests + engine unit tests
├── prototype/              # the spike (kept for reference)
├── serve.command           # macOS: double-click to serve
├── serve.bat               # Windows: double-click to serve
└── README.md               # how to run on party day + checklist
```

## Out of scope (YAGNI)
- No real K-pop audio in-app (licensing/autoplay) — host plays music separately.
- No accounts, no cloud, no leaderboard persistence between parties.
- No in-camera gesture menus — host drives via keyboard.
