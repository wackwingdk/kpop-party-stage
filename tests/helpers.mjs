// helpers.mjs — build synthetic "dancer" data for tests, matching the shape
// the engine hands to games. No camera/model needed.

const ALL_KP = [
  "nose", "leftEye", "rightEye", "leftEar", "rightEar",
  "leftShoulder", "rightShoulder", "leftElbow", "rightElbow",
  "leftWrist", "rightWrist", "leftHip", "rightHip",
  "leftKnee", "rightKnee", "leftAnkle", "rightAnkle",
];

// Make a dancer with all keypoints present (score 1) at given coordinates.
// `coords` maps keypoint name → {x, y}. Unspecified points default to origin
// with score 1 (callers override what matters for the test).
export function makeDancer(id, coords = {}, color = "#ff3ec8") {
  const keypoints = {};
  for (const name of ALL_KP) {
    const c = coords[name] || { x: 0, y: 0 };
    keypoints[name] = { x: c.x, y: c.y, score: c.score ?? 1 };
  }
  return { id, color, colorIndex: 0, keypoints, box: null };
}

// A dancer standing in a neutral pose, arms down by the sides.
export function neutralDancer(id = 0, cx = 480, cy = 360) {
  return makeDancer(id, {
    nose: { x: cx, y: cy - 200 },
    leftShoulder: { x: cx - 60, y: cy - 120 },
    rightShoulder: { x: cx + 60, y: cy - 120 },
    leftElbow: { x: cx - 70, y: cy - 40 },
    rightElbow: { x: cx + 70, y: cy - 40 },
    leftWrist: { x: cx - 75, y: cy + 40 },
    rightWrist: { x: cx + 75, y: cy + 40 },
    leftHip: { x: cx - 40, y: cy + 60 },
    rightHip: { x: cx + 40, y: cy + 60 },
    leftKnee: { x: cx - 45, y: cy + 180 },
    rightKnee: { x: cx + 45, y: cy + 180 },
    leftAnkle: { x: cx - 48, y: cy + 300 },
    rightAnkle: { x: cx + 48, y: cy + 300 },
  });
}

// A dancer with both arms raised straight up (for "Arms Up!" pose).
export function armsUpDancer(id = 0, cx = 480, cy = 360) {
  return makeDancer(id, {
    nose: { x: cx, y: cy - 200 },
    leftShoulder: { x: cx - 60, y: cy - 120 },
    rightShoulder: { x: cx + 60, y: cy - 120 },
    leftElbow: { x: cx - 65, y: cy - 220 },
    rightElbow: { x: cx + 65, y: cy - 220 },
    leftWrist: { x: cx - 68, y: cy - 320 },
    rightWrist: { x: cx + 68, y: cy - 320 },
    leftHip: { x: cx - 40, y: cy + 60 },
    rightHip: { x: cx + 40, y: cy + 60 },
    leftKnee: { x: cx - 45, y: cy + 180 },
    rightKnee: { x: cx + 45, y: cy + 180 },
    leftAnkle: { x: cx - 48, y: cy + 300 },
    rightAnkle: { x: cx + 48, y: cy + 300 },
  });
}
