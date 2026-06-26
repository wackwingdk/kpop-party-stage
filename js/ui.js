// ui.js — DOM-based UI helpers layered over the canvas.
//
// The canvas shows the camera + game visuals. These helpers handle the
// "chrome": the title menu, friendly error screens, and the persistent
// Back-to-Menu button. In-game visuals (FREEZE text, scores, hearts) are
// drawn on the canvas by the games themselves; here we only do DOM overlays
// that are easier as HTML (buttons, full-screen menus, error dialogs).

const $ = (sel) => document.querySelector(sel);

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  if (props.style) node.setAttribute("style", props.style);
  for (const c of [].concat(children)) {
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

// --- Title / menu screen ---------------------------------------------------

// Renders the title screen with one big tile per game.
// games: [{id,title,emoji}], onPick(id), partyName, onCameraSettings()
export function showMenu({ root, partyName, games, onPick, onCameraSettings }) {
  clearOverlays(root);
  const overlay = el("div", { className: "overlay menu-overlay" });

  overlay.append(
    el("h1", { className: "title" }, `✨ ${partyName}'s K-Pop Stage ✨`),
    el("p", { className: "subtitle" }, "Pick a game and step in front of the camera! 🎤")
  );

  const grid = el("div", { className: "tile-grid" });
  for (const g of games) {
    const tile = el("button", { className: "tile", onclick: () => onPick(g.id) }, [
      el("div", { className: "tile-emoji" }, g.emoji),
      el("div", { className: "tile-title" }, g.title),
    ]);
    grid.append(tile);
  }
  overlay.append(grid);

  overlay.append(
    el("button", { className: "settings-btn", onclick: onCameraSettings, title: "Camera settings" }, "⚙")
  );

  root.append(overlay);
}

// --- In-game corner controls ----------------------------------------------

export function showGameChrome({ root, onMenu }) {
  clearOverlays(root);
  const back = el("button", { className: "back-btn", onclick: onMenu }, "⬅ Menu");
  root.append(back);
}

// --- Countdown (3-2-1) -----------------------------------------------------
// Returns a promise that resolves when the countdown finishes.
export function countdown(root, from = 3) {
  return new Promise((resolve) => {
    const node = el("div", { className: "overlay countdown" });
    root.append(node);
    let n = from;
    const tick = () => {
      node.textContent = n > 0 ? String(n) : "GO!";
      node.classList.remove("pulse");
      // force reflow to restart animation
      void node.offsetWidth;
      node.classList.add("pulse");
      if (n < 0) {
        node.remove();
        resolve();
        return;
      }
      n--;
      setTimeout(tick, 800);
    };
    tick();
  });
}

// --- Friendly error screen -------------------------------------------------

export function showError({ root, emoji = "😅", title, message, onRetry }) {
  clearOverlays(root);
  const overlay = el("div", { className: "overlay error-overlay" });
  overlay.append(
    el("div", { className: "error-emoji" }, emoji),
    el("h2", { className: "error-title" }, title),
    el("p", { className: "error-message" }, message)
  );
  if (onRetry) {
    overlay.append(el("button", { className: "retry-btn", onclick: onRetry }, "↻ Try again"));
  }
  root.append(overlay);
}

// --- Banner (transient message at top) -------------------------------------

export function banner(root, text, ms = 1800) {
  const node = el("div", { className: "banner" }, text);
  root.append(node);
  setTimeout(() => node.remove(), ms);
}

// --- helpers ---------------------------------------------------------------

// Remove all DOM overlays but leave the canvas alone.
export function clearOverlays(root) {
  root.querySelectorAll(".overlay, .back-btn, .banner").forEach((n) => n.remove());
}
