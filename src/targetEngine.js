function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createTrainerState({ width = 960, height = 540 } = {}) {
  return {
    width,
    height,
    target: {
      x: width * 0.5,
      y: height * 0.5,
      radius: 30,
      ageMs: 0,
    },
    hits: 0,
    misses: 0,
    streak: 0,
    level: 1,
    score: 0,
    sessionMs: 0,
    targetLifetimeMs: 2200,
  };
}

export function spawnTarget(state, randomFn = Math.random) {
  const margin = Math.max(48, state.target.radius + 16);
  const x = margin + randomFn() * (state.width - margin * 2);
  const y = margin + randomFn() * (state.height - margin * 2);

  return {
    ...state,
    target: {
      ...state.target,
      x,
      y,
      ageMs: 0,
    },
  };
}

// `slack` widens the hit circle. Webcam gaze lands within about 4 degrees of
// where you look at best (Papoutsaki et al., IJCAI 2016), which is far wider
// than a 30 px target, so gaze mode passes extra room here.
export function isCursorInsideTarget(state, cursorX, cursorY, slack = 0) {
  const dx = cursorX - state.target.x;
  const dy = cursorY - state.target.y;
  const r = state.target.radius + slack;
  return dx * dx + dy * dy <= r * r;
}

export function scoreFromReaction(reactionMs, streak) {
  const speedBonus = clamp((1600 - reactionMs) / 60, 0, 26);
  const streakBonus = clamp(streak * 2, 0, 24);
  return Math.round(24 + speedBonus + streakBonus);
}

export function registerShot(state, { didHit, reactionMs = state.target.ageMs, randomFn = Math.random } = {}) {
  const next = {
    ...state,
    target: { ...state.target },
  };

  if (didHit) {
    next.hits += 1;
    next.streak += 1;
    next.score += scoreFromReaction(reactionMs, next.streak);

    if (next.hits % 5 === 0) {
      next.level += 1;
      next.target.radius = Math.max(16, next.target.radius - 1);
      next.targetLifetimeMs = Math.max(1000, next.targetLifetimeMs - 80);
    }
  } else {
    next.misses += 1;
    next.streak = 0;
    next.score = Math.max(0, next.score - 8);
  }

  return spawnTarget(next, randomFn);
}

export function stepTrainer(state, dtMs, randomFn = Math.random) {
  const next = {
    ...state,
    target: {
      ...state.target,
      ageMs: state.target.ageMs + dtMs,
    },
    sessionMs: state.sessionMs + dtMs,
  };

  if (next.target.ageMs >= next.targetLifetimeMs) {
    return registerShot(next, { didHit: false, randomFn });
  }

  return next;
}

export function accuracyPercent(state) {
  const attempts = state.hits + state.misses;
  if (attempts === 0) {
    return 0;
  }
  return Math.round((state.hits / attempts) * 100);
}
