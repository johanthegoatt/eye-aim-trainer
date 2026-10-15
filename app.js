import {
  createTrainerState,
  stepTrainer,
  registerShot,
  isCursorInsideTarget,
  accuracyPercent,
  reactionStats,
} from "./src/targetEngine.js";
import { createPointFilter } from "./src/oneEuro.js";

const SESSION_LENGTH_MS = 60_000;
const DWELL_MS = 550;
// Extra hit room in gaze mode, in arena pixels (the canvas is 960 wide).
const GAZE_SLACK = 34;
// Tuned in tests/oneEuro.test.js: cuts resting jitter about 4x and still
// catches a jump across the arena within about 5 frames.
const GAZE_FILTER = { minCutoff: 0.5, beta: 0.0007 };

const elements = {
  canvas: document.getElementById("arena"),
  overlay: document.getElementById("overlay"),
  startBtn: document.getElementById("startBtn"),
  stopBtn: document.getElementById("stopBtn"),
  calibrateBtn: document.getElementById("calibrateBtn"),
  score: document.getElementById("score"),
  hits: document.getElementById("hits"),
  misses: document.getElementById("misses"),
  accuracy: document.getElementById("accuracy"),
  level: document.getElementById("level"),
  status: document.getElementById("status"),
  reaction: document.getElementById("reaction"),
  best: document.getElementById("best"),
};

const context = elements.canvas.getContext("2d");

const appState = {
  engine: createTrainerState({ width: elements.canvas.width, height: elements.canvas.height }),
  running: false,
  useGaze: false,
  lastFrameAt: 0,
  cursor: {
    x: elements.canvas.width / 2,
    y: elements.canvas.height / 2,
  },
  dwellMs: 0,
  gaze: null,
  gazeFilter: createPointFilter(GAZE_FILTER),
};

function slack() {
  return appState.useGaze ? GAZE_SLACK : 0;
}

function setStatus(text) {
  elements.status.textContent = text;
}

function setOverlay(text) {
  elements.overlay.querySelector("h2").textContent = text;
  elements.overlay.hidden = !text;
}

function drawArena() {
  const { engine } = appState;

  const gradient = context.createRadialGradient(
    engine.width * 0.5,
    engine.height * 0.4,
    20,
    engine.width * 0.5,
    engine.height * 0.5,
    engine.width * 0.6,
  );
  gradient.addColorStop(0, "#1f3559");
  gradient.addColorStop(1, "#0d172b");

  context.fillStyle = gradient;
  context.fillRect(0, 0, engine.width, engine.height);

  context.fillStyle = "rgba(15, 163, 177, 0.25)";
  context.beginPath();
  context.arc(engine.target.x, engine.target.y, engine.target.radius + Math.max(14, slack()), 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(255, 255, 255, 0.94)";
  context.beginPath();
  context.arc(engine.target.x, engine.target.y, engine.target.radius, 0, Math.PI * 2);
  context.fill();

  if (appState.running) {
    // Outer ring drains as the target's time runs out.
    const life = 1 - Math.min(1, engine.target.ageMs / engine.targetLifetimeMs);
    context.strokeStyle = life > 0.3 ? "rgba(15, 163, 177, 0.9)" : "rgba(255, 108, 108, 0.95)";
    context.lineWidth = 4;
    context.beginPath();
    context.arc(engine.target.x, engine.target.y, engine.target.radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * life);
    context.stroke();

    // Inner ring fills while you hold on target, so dwell is something you
    // can see coming rather than a shot out of nowhere.
    if (appState.dwellMs > 0) {
      context.strokeStyle = "#ff8c6b";
      context.lineWidth = 5;
      context.beginPath();
      context.arc(engine.target.x, engine.target.y, engine.target.radius - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, appState.dwellMs / DWELL_MS));
      context.stroke();
    }
  }

  context.strokeStyle = "#ff8c6b";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(appState.cursor.x - 12, appState.cursor.y);
  context.lineTo(appState.cursor.x + 12, appState.cursor.y);
  context.moveTo(appState.cursor.x, appState.cursor.y - 12);
  context.lineTo(appState.cursor.x, appState.cursor.y + 12);
  context.stroke();
}

function syncStats() {
  elements.score.textContent = String(appState.engine.score);
  elements.hits.textContent = String(appState.engine.hits);
  elements.misses.textContent = String(appState.engine.misses);
  elements.accuracy.textContent = `${accuracyPercent(appState.engine)}%`;
  elements.level.textContent = String(appState.engine.level);
  const { medianMs } = reactionStats(appState.engine);
  elements.reaction.textContent = medianMs === null ? "-" : `${medianMs} ms`;
}

// Personal bests per input mode: gaze is far slower than a mouse, so mixing
// them would make one of the two numbers meaningless.
const BEST_KEY = "eye-aim-trainer:best:v1";

function readBests() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BEST_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function showBest() {
  const best = readBests()[appState.useGaze ? "gaze" : "mouse"];
  elements.best.textContent = best ? `${best.score} pts, ${best.medianMs ?? "-"} ms` : "-";
}

// Returns what got beaten, for the end-of-session line.
function recordSession() {
  const mode = appState.useGaze ? "gaze" : "mouse";
  const { score } = appState.engine;
  const { medianMs } = reactionStats(appState.engine);
  const bests = readBests();
  const old = bests[mode] ?? {};
  const beat = [];
  const next = { ...old };
  if (score > (old.score ?? -1)) {
    next.score = score;
    beat.push("score");
  }
  if (medianMs !== null && medianMs < (old.medianMs ?? Infinity)) {
    next.medianMs = medianMs;
    beat.push("reaction time");
  }
  if (beat.length) {
    bests[mode] = next;
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(bests));
    } catch {}
  }
  showBest();
  return beat;
}

function shoot() {
  if (!appState.running) {
    return;
  }

  const didHit = isCursorInsideTarget(appState.engine, appState.cursor.x, appState.cursor.y, slack());
  appState.engine = registerShot(appState.engine, { didHit });
  appState.dwellMs = 0;
}

function stopSession(message = "Session stopped") {
  appState.running = false;
  appState.lastFrameAt = 0;
  elements.startBtn.disabled = false;
  elements.stopBtn.disabled = true;
  setOverlay("Ready");
  setStatus(message);
}

function startSession() {
  appState.engine = createTrainerState({ width: elements.canvas.width, height: elements.canvas.height });
  appState.running = true;
  appState.lastFrameAt = 0;
  appState.dwellMs = 0;
  elements.startBtn.disabled = true;
  elements.stopBtn.disabled = false;
  setOverlay("");
  setStatus(appState.useGaze ? "Mode: gaze tracking" : "Mode: mouse fallback");
  showBest();
}

// WebGazer 2.x's getCurrentPrediction() returns a Promise, so reading .x off
// it every frame gave undefined and the crosshair never moved. The gaze
// listener hands over each prediction as it is made instead; it is kept
// here and smoothed once per frame.
function onGaze(data) {
  if (data && Number.isFinite(data.x) && Number.isFinite(data.y)) {
    appState.gaze = { x: data.x, y: data.y };
  }
}

function updateGazeCursor(timestamp) {
  if (!appState.useGaze || !appState.gaze) {
    return;
  }

  const rect = elements.canvas.getBoundingClientRect();
  const x = ((appState.gaze.x - rect.left) / rect.width) * elements.canvas.width;
  const y = ((appState.gaze.y - rect.top) / rect.height) * elements.canvas.height;
  const smooth = appState.gazeFilter.filter(x, y, timestamp);

  appState.cursor.x = Math.max(0, Math.min(elements.canvas.width, smooth.x));
  appState.cursor.y = Math.max(0, Math.min(elements.canvas.height, smooth.y));
}

function animate(timestamp) {
  if (!appState.lastFrameAt) {
    appState.lastFrameAt = timestamp;
  }

  const dt = Math.min(timestamp - appState.lastFrameAt, 100);
  appState.lastFrameAt = timestamp;

  updateGazeCursor(timestamp);

  if (appState.running) {
    appState.engine = stepTrainer(appState.engine, dt);

    if (isCursorInsideTarget(appState.engine, appState.cursor.x, appState.cursor.y, slack())) {
      appState.dwellMs += dt;
      if (appState.dwellMs >= DWELL_MS) {
        shoot();
      }
    } else {
      appState.dwellMs = 0;
    }

    if (appState.engine.sessionMs >= SESSION_LENGTH_MS) {
      const { medianMs } = reactionStats(appState.engine);
      const beat = recordSession();
      const reaction = medianMs === null ? "" : `, median reaction ${medianMs} ms`;
      stopSession(`Session done: ${appState.engine.score} points${reaction}.${beat.length ? ` New best ${beat.join(" and ")}!` : ""}`);
    }
  }

  drawArena();
  syncStats();
  requestAnimationFrame(animate);
}

async function enableGaze() {
  const webgazer = window.webgazer;
  if (!webgazer) {
    setStatus("WebGazer unavailable. Mouse fallback active.");
    appState.useGaze = false;
    return;
  }

  try {
    webgazer.showVideoPreview(false).showPredictionPoints(false).showFaceOverlay(false);
    webgazer.setGazeListener(onGaze);
    appState.gazeFilter.reset();
    await webgazer.begin();
    appState.useGaze = true;
    calibrate();
  } catch (error) {
    console.error(error);
    appState.useGaze = false;
    setStatus("Gaze startup failed. Mouse fallback active.");
  }
}

// WebGazer learns from clicks: each click tells it "the eyes are here now".
// Without any, its first guesses land far off. Nine dots across the arena,
// three clicks each while looking at the dot, follow the calibration in
// WebGazer's own demo.
const CLICKS_PER_DOT = 3;

function calibrate() {
  const wrap = elements.canvas.parentElement;
  wrap.querySelector(".calibration")?.remove();
  const layer = document.createElement("div");
  layer.className = "calibration";
  const help = document.createElement("p");
  help.textContent = "Look at each dot and click it 3 times.";
  layer.append(help);
  let left = 9;
  for (const y of [8, 50, 92]) {
    for (const x of [5, 50, 95]) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "dot";
      dot.style.left = `${x}%`;
      dot.style.top = `${y}%`;
      dot.setAttribute("aria-label", "Calibration dot");
      let clicks = 0;
      dot.addEventListener("click", (event) => {
        event.stopPropagation();
        clicks += 1;
        dot.style.setProperty("--done", String(clicks / CLICKS_PER_DOT));
        if (clicks === CLICKS_PER_DOT) {
          dot.disabled = true;
          left -= 1;
          if (left === 0) {
            layer.remove();
            appState.gazeFilter.reset();
            setStatus("Mode: gaze tracking. Calibrated. Start a session.");
          }
        }
      });
      layer.append(dot);
    }
  }
  setOverlay("");
  wrap.append(layer);
  setStatus("Calibrating: click every dot 3 times while looking at it.");
}

function stopGaze() {
  if (window.webgazer?.end) {
    try {
      window.webgazer.end();
    } catch {
      // ignore
    }
  }
}

elements.startBtn.addEventListener("click", startSession);
elements.stopBtn.addEventListener("click", () => stopSession("Session stopped"));
elements.calibrateBtn.addEventListener("click", enableGaze);

function aimFromEvent(event) {
  const rect = elements.canvas.getBoundingClientRect();
  appState.cursor.x = ((event.clientX - rect.left) / rect.width) * elements.canvas.width;
  appState.cursor.y = ((event.clientY - rect.top) / rect.height) * elements.canvas.height;
}

// Pointer events cover mouse, pen and touch. The eyes steer in gaze mode, so
// a resting mouse would fight them there.
elements.canvas.addEventListener("pointermove", (event) => {
  if (!appState.useGaze) aimFromEvent(event);
});

elements.canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse") return;
  // A finger has no hover: the tap is both the aim and the shot.
  if (!appState.useGaze) aimFromEvent(event);
  event.preventDefault();
  shoot();
});

elements.canvas.addEventListener("click", (event) => {
  // Touch taps already shot on pointerdown; this is the mouse button.
  if (event.pointerType && event.pointerType !== "mouse") return;
  shoot();
});

document.addEventListener("keydown", (event) => {
  if (event.key === " " && !event.target.closest?.("button, input, select, textarea")) {
    // Stop the page scrolling down a screen on every shot.
    event.preventDefault();
    shoot();
  }
});

window.addEventListener("beforeunload", () => {
  stopGaze();
});

syncStats();
showBest();
drawArena();
requestAnimationFrame(animate);
