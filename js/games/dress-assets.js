// dress-assets.js — builds the princess outfit as embedded SVG images.
//
// We author the gown and sleeve as SVG text (no external files), tint them per
// dancer color, and decode them into <img> elements ONCE. The princess game
// then just positions/scales/rotates these images per frame (cheap drawImage),
// instead of re-parsing SVG every frame.
//
// Each SVG is designed in its own local coordinate box; the game maps that box
// onto the body using the anchor points documented on each builder.

// --- Gown -------------------------------------------------------------------
// Local box: 200 wide × 320 tall. Anchor (where it attaches to the body) is the
// top-center at (100, 30) — placed at the shoulder midpoint. The skirt flares
// down to y≈310. Colors: `main` (skirt/sleeves), `bodice` (darker), trim/gems.
function gownSVG(main, dark) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 320" width="200" height="320">
  <defs>
    <linearGradient id="skirt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${main}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <linearGradient id="bodiceG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${dark}"/>
      <stop offset="1" stop-color="${main}"/>
    </linearGradient>
  </defs>

  <!-- skirt: layered ruffles, bell shaped -->
  <path d="M70,120 L130,120 L196,300
           Q170,300 168,312 Q150,300 140,312 Q120,300 112,312
           Q100,300 88,312 Q80,300 60,312 Q50,300 32,312
           Q34,300 4,300 Z"
        fill="url(#skirt)" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
  <!-- skirt ruffle lines -->
  <path d="M40,250 Q100,235 160,250" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3"/>
  <path d="M30,285 Q100,268 170,285" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>

  <!-- bodice -->
  <path d="M72,40 Q100,30 128,40 L130,122 Q100,134 70,122 Z"
        fill="url(#bodiceG)" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
  <!-- sweetheart neckline -->
  <path d="M72,44 Q86,58 100,48 Q114,58 128,44" fill="none"
        stroke="rgba(255,255,255,0.7)" stroke-width="2.5"/>

  <!-- waist sash + center gem -->
  <rect x="68" y="114" width="64" height="12" rx="6" fill="rgba(255,255,255,0.85)"/>
  <circle cx="100" cy="120" r="9" fill="#ffd23e" stroke="#fff" stroke-width="2"/>
  <circle cx="100" cy="120" r="3.5" fill="#fff"/>

  <!-- little sparkles on the skirt -->
  <g fill="rgba(255,255,255,0.9)">
    <circle cx="70" cy="200" r="3"/><circle cx="125" cy="225" r="2.5"/>
    <circle cx="95" cy="265" r="3"/><circle cx="140" cy="270" r="2"/>
    <circle cx="55" cy="240" r="2"/>
  </g>
</svg>`.trim();
}

// --- Puff sleeve ------------------------------------------------------------
// Local box: 80 × 90. Anchor top-center (40, 12) = the shoulder; it hangs along
// the upper arm toward the elbow (drawn rotated to the arm angle by the game).
function sleeveSVG(main, dark) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 90" width="80" height="90">
  <defs>
    <radialGradient id="puff" cx="0.5" cy="0.35" r="0.7">
      <stop offset="0" stop-color="${main}"/>
      <stop offset="1" stop-color="${dark}"/>
    </radialGradient>
  </defs>
  <!-- puffed shoulder -->
  <ellipse cx="40" cy="34" rx="34" ry="30" fill="url(#puff)"
           stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
  <!-- gathered cuff -->
  <path d="M18,52 Q40,70 62,52 L56,80 Q40,90 24,80 Z" fill="url(#puff)"
        stroke="rgba(255,255,255,0.45)" stroke-width="2"/>
  <ellipse cx="40" cy="80" rx="16" ry="6" fill="rgba(255,255,255,0.4)"/>
</svg>`.trim();
}

// Convert SVG text into a loaded HTMLImageElement (async — decodes once).
function svgToImage(svg) {
  return new Promise((resolve) => {
    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // never block the game on a bad asset
    img.src = url;
  });
}

// Darken a #rrggbb hex by `f` (0..1) for gradient shadows.
function darken(hex, f = 0.45) {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.slice(0, 2), 16) * (1 - f));
  const g = Math.round(parseInt(h.slice(2, 4), 16) * (1 - f));
  const b = Math.round(parseInt(h.slice(4, 6), 16) * (1 - f));
  return `rgb(${r}, ${g}, ${b})`;
}

// Build {gown, sleeve} loaded images for a single color. Returns a promise.
export async function buildDressForColor(color) {
  const dark = darken(color, 0.4);
  const [gown, sleeve] = await Promise.all([
    svgToImage(gownSVG(color, dark)),
    svgToImage(sleeveSVG(color, dark)),
  ]);
  return { gown, sleeve };
}

// Build a map of color → {gown, sleeve} for all the dancer colors up front.
export async function buildDressAssets(colors) {
  const entries = await Promise.all(
    colors.map(async (c) => [c, await buildDressForColor(c)])
  );
  return Object.fromEntries(entries);
}

// Exposed for tests.
export const __test = { darken, gownSVG, sleeveSVG };
