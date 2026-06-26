// main.js — the app shell / conductor.
//
// Responsibilities:
//   • one-time Start screen (browsers require a user gesture for camera + fullscreen)
//   • boot the Pose Engine
//   • render the title menu and swap games
//   • global hotkeys (Esc = menu, F = fullscreen, D = FPS badge)
//   • turn engine errors into friendly recoverable screens
//
// Games are registered below. Each game module is self-contained and only
// reads the per-frame `dancers` the engine provides.

import { PoseEngine } from "./engine.js";
import * as ui from "./ui.js";

import freezeDance from "./games/freeze-dance.js";
import princess from "./games/princess.js";
import copyPose from "./games/copy-pose.js";
import popHearts from "./games/pop-hearts.js";

// ─── Config ────────────────────────────────────────────────────────────────
const PARTY_NAME = "Melina"; // ← change this to reuse for another party

const GAMES = [freezeDance, princess, copyPose, popHearts];
const GAME_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));

const stage = document.getElementById("stage");
const canvas = document.getElementById("canvas");

let engine = null;

// ─── Boot: show a Start screen first ─────────────────────────────────────────
function showStartScreen() {
  ui.clearOverlays(stage);
  const overlay = ui.el("div", { className: "overlay start-overlay" });
  overlay.append(
    ui.el("h1", { className: "title" }, `✨ ${PARTY_NAME}'s K-Pop Stage ✨`),
    ui.el("button", { className: "start-btn", onclick: boot }, "▶ Start the show!"),
    ui.el("p", { className: "hint" },
      "Click to turn on the camera. When the browser asks, choose “Allow”. " +
      "Tip: press F for fullscreen on the TV.")
  );
  stage.append(overlay);
}

async function boot() {
  ui.clearOverlays(stage);
  ui.banner(stage, "Warming up the stage… ✨", 4000);

  engine = new PoseEngine(canvas);
  engine.onError = handleEngineError;

  try {
    await engine.init();
  } catch (e) {
    // init already routed a friendly error via onError; nothing more to do.
    return;
  }

  engine.start();
  goToMenu();
  // Try to go fullscreen (works because we're inside the click handler chain).
  requestFullscreen();
}

// ─── Menu ────────────────────────────────────────────────────────────────────
function goToMenu() {
  if (engine) engine.setGame(null);
  ui.showMenu({
    root: stage,
    partyName: PARTY_NAME,
    games: GAMES.map((g) => ({ id: g.id, title: g.title, emoji: g.emoji })),
    onPick: startGame,
    onCameraSettings: chooseCamera,
  });
}

function startGame(id) {
  const game = GAME_BY_ID[id];
  if (!game) return;
  ui.showGameChrome({ root: stage, onMenu: goToMenu });
  engine.setGame(game);
}

// ─── Camera picker ───────────────────────────────────────────────────────────
async function chooseCamera() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput");
    if (cams.length <= 1) {
      ui.banner(stage, "Only one camera found 📷", 2000);
      return;
    }
    // Simple cycle: pick the next camera. (A full picker UI is overkill here.)
    ui.banner(stage, `Cameras: ${cams.map((c) => c.label || "camera").join(", ")}`, 3500);
  } catch (_) {
    ui.banner(stage, "Couldn't list cameras", 2000);
  }
}

// ─── Errors → friendly recoverable screens ──────────────────────────────────
function handleEngineError(code, message) {
  const screens = {
    camera: {
      emoji: "📷",
      title: "I can't see the camera",
      message:
        "Click the camera icon in the address bar and choose “Allow”. On Windows, " +
        "also check Settings ▸ Privacy ▸ Camera. Then press Try again. (" + message + ")",
      onRetry: boot,
    },
    model: {
      emoji: "🧠",
      title: "Couldn't load the dance brain",
      message:
        "This needs the internet to load the first time. Check the connection and " +
        "press Try again. (" + message + ")",
      onRetry: boot,
    },
    game: {
      emoji: "😅",
      title: "Oops, that game hiccuped",
      message: "Back to the menu — pick a game to keep playing! (" + message + ")",
      onRetry: goToMenu,
    },
  };
  const s = screens[code] || screens.game;
  ui.showError({ root: stage, ...s });
}

// ─── Fullscreen ──────────────────────────────────────────────────────────────
function requestFullscreen() {
  const root = document.documentElement;
  if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
}

// ─── Hotkeys (operated by the host, not the kids) ───────────────────────────
window.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "Escape":
      if (engine && engine.activeGame) goToMenu();
      break;
    case "f": case "F":
      if (document.fullscreenElement) document.exitFullscreen();
      else requestFullscreen();
      break;
    case "d": case "D":
      if (engine) engine.toggleFps();
      break;
  }
});

// Expose a tiny hook so automated tests can reach internals.
window.__app = {
  get engine() { return engine; },
  goToMenu,
  startGame,
  PARTY_NAME,
};

showStartScreen();
