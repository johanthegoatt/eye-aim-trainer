import {
  createTrainerState,
  stepTrainer,
  registerShot,
  isCursorInsideTarget,
  accuracyPercent,
} from "./src/targetEngine.js";

const SESSION_LENGTH_MS = 60_000;

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
};

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
  context.arc(engine.target.x, engine.target.y, engine.target.radius + 14, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(255, 255, 255, 0.94)";
  context.beginPath();
  context.arc(engine.target.x, engine.target.y, engine.target.radius, 0, Math.PI * 2);
  context.fill();

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
}

function shoot() {
  if (!appState.running) {
    return;
  }

  const didHit = isCursorInsideTarget(appState.engine, appState.cursor.x, appState.cursor.y);
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
}

function updateGazeCursor() {
  if (!appState.useGaze || !window.webgazer?.getCurrentPrediction) {
    return;
  }

  const prediction = window.webgazer.getCurrentPrediction();
  if (!prediction) {
    return;
  }

  const rect = elements.canvas.getBoundingClientRect();
  const x = ((prediction.x - rect.left) / rect.width) * elements.canvas.width;
  const y = ((prediction.y - rect.top) / rect.height) * elements.canvas.height;

  if (Number.isFinite(x) && Number.isFinite(y)) {
    appState.cursor.x = Math.max(0, Math.min(elements.canvas.width, x));
    appState.cursor.y = Math.max(0, Math.min(elements.canvas.height, y));
  }
}

function animate(timestamp) {
  if (!appState.lastFrameAt) {
    appState.lastFrameAt = timestamp;
  }

  const dt = Math.min(timestamp - appState.lastFrameAt, 100);
  appState.lastFrameAt = timestamp;

  updateGazeCursor();

  if (appState.running) {
    appState.engine = stepTrainer(appState.engine, dt);

    if (isCursorInsideTarget(appState.engine, appState.cursor.x, appState.cursor.y)) {
      appState.dwellMs += dt;
      if (appState.dwellMs >= 550) {
        shoot();
      }
    } else {
      appState.dwellMs = 0;
    }

    if (appState.engine.sessionMs >= SESSION_LENGTH_MS) {
      stopSession(`Session done: ${appState.engine.score} points`);
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
    await webgazer.begin();
    appState.useGaze = true;
    setStatus("Mode: gaze tracking");
  } catch (error) {
    console.error(error);
    appState.useGaze = false;
    setStatus("Gaze startup failed. Mouse fallback active.");
  }
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

elements.canvas.addEventListener("mousemove", (event) => {
  const rect = elements.canvas.getBoundingClientRect();
  appState.cursor.x = ((event.clientX - rect.left) / rect.width) * elements.canvas.width;
  appState.cursor.y = ((event.clientY - rect.top) / rect.height) * elements.canvas.height;
});

elements.canvas.addEventListener("click", shoot);

document.addEventListener("keydown", (event) => {
  if (event.key === " ") {
    shoot();
  }
});

window.addEventListener("beforeunload", () => {
  stopGaze();
});

syncStats();
drawArena();
requestAnimationFrame(animate);
