# ✨ Melina's K-Pop Stage ✨

A webcam-driven dance party for the TV. 3–4 kids stand in front of the camera and
the screen reacts to their bodies with K-pop-themed mini-games. **You** play the
music (phone / Spotify / YouTube); the app provides the visuals and games.

Everything runs **locally in the browser** — the kids' video never leaves the PC.

---

## 🎮 The games

| Game | What to do |
|------|-----------|
| ⏯️ **Freeze Dance** | Dance to your music; freeze when the screen says FREEZE! Movers get a funny wobble — nobody is ever really out. |
| 👑 **Princess Magic** | Step in front of the camera and you turn into a princess — a crown, a sparkly gown, and a magic wand follow you live as you move. |
| 🕺 **Copy the Pose** | Match the pose on screen; everyone gets a score. |
| 💖 **Pop the Hearts** | Pop floating hearts with your hands for a team score. |
| 🌉 **Bridge Rescue** | Little men cross the screen over gaps — use your hands as stepping-stone bridges to help them reach the castle. Each one rescued counts! |

Switch games anytime with the **⬅ Menu** button or the **Esc** key.

---

## ▶️ How to run it

### On the party PC (Windows)
1. Copy this whole `kpop-party-stage` folder onto the PC.
2. Double-click **`serve.bat`**. A black window opens (leave it open) and your
   browser opens to the stage automatically.
   - If it says Python isn't installed, install it from
     <https://www.python.org/downloads/> (tick **“Add Python to PATH”**), then
     double-click `serve.bat` again.
3. Click **“▶ Start the show!”** and click **Allow** when asked for the camera.
4. Press **F** for fullscreen on the TV.

### On a Mac (for testing)
- Double-click **`serve.command`** (or run `npm run serve`), then open
  <http://localhost:8000/>.

---

## ✅ Party-day checklist (do this BEFORE guests arrive)

1. **Plug in** the webcam and connect the PC to the TV (extend/duplicate display).
2. **Warm-up load:** open the app once with internet on, so TensorFlow.js + the
   model download and get cached. (After this, a brief WiFi hiccup won't matter.)
3. **Performance check:** open **`perf-check.html`** in the browser, click start,
   allow the camera, and move around:
   - ✅ green “runs smoothly” → you're set.
   - 🟡 yellow → still fine; the app auto-switches to performance mode.
   - 🔴 red → close other apps and retry; tell me and we can lower settings.
4. **Lighting:** make sure the play area is reasonably lit and the camera sees
   the kids head-to-knee. Stand ~1.5–3 m back.
5. **Music:** queue your K-pop playlist on your phone/Spotify. The app has no
   sound of its own — you control the music.
6. **Fullscreen:** press **F** so there's no browser clutter on the TV.

---

## ⌨️ Host hotkeys (the kids just use their bodies)

| Key | Action |
|-----|--------|
| **Esc** | Back to the menu |
| **F** | Toggle fullscreen |
| **D** | Toggle the FPS / debug badge |

---

## 🔧 Tech notes

- Plain HTML/CSS/JS. Body tracking via **TensorFlow.js + MoveNet MultiPose**
  (loaded from CDN — needs internet on first load, then cached).
- A tiny local server is used only because browsers block the webcam on
  `file://` URLs. Nothing is uploaded anywhere; no accounts, no backend.
- The engine **auto-tunes performance** (resolution + detection rate) for older
  PCs, and falls back from GPU (WebGL) to CPU if needed.

## 🧪 Tests

```bash
npm test        # unit tests for game logic + performance hysteresis (no browser)
npm run test:e2e  # headless Playwright smoke test of the assembled app
```

Reuse for another party: change `PARTY_NAME` at the top of `js/main.js`.
