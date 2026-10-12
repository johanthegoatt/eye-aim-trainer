// 1€ filter (Casiez, Roussel and Vogel, CHI 2012). A low-pass filter whose
// cutoff rises with speed: while the gaze rests on a spot it smooths hard,
// so the crosshair stops shaking, and when the eyes jump it follows quickly
// instead of lagging behind.
function alpha(cutoffHz, dtSec) {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSec);
}

export function createOneEuro({ minCutoff = 1, beta = 0.007, dCutoff = 1 } = {}) {
  let last = null;
  let lastDx = 0;
  let lastT = 0;

  return {
    reset() {
      last = null;
      lastDx = 0;
    },
    filter(value, tMs) {
      if (last === null) {
        last = value;
        lastT = tMs;
        return value;
      }
      const dt = Math.max((tMs - lastT) / 1000, 1e-3);
      lastT = tMs;
      const dx = (value - last) / dt;
      const ad = alpha(dCutoff, dt);
      lastDx = ad * dx + (1 - ad) * lastDx;
      const cutoff = minCutoff + beta * Math.abs(lastDx);
      const a = alpha(cutoff, dt);
      last = a * value + (1 - a) * last;
      return last;
    },
  };
}

// One filter per axis for a 2D point.
export function createPointFilter(options) {
  const fx = createOneEuro(options);
  const fy = createOneEuro(options);
  return {
    reset() {
      fx.reset();
      fy.reset();
    },
    filter(x, y, tMs) {
      return { x: fx.filter(x, tMs), y: fy.filter(y, tMs) };
    },
  };
}
