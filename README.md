# Eye Aim Trainer

## Description
Eye Aim Trainer is a gaze-driven target practice game with WebGazer tracking and robust mouse fallback.

## Features
- Live aim arena with moving targets
- WebGazer integration for eye-gaze cursor control, read through its gaze listener (WebGazer 2's `getCurrentPrediction()` is async)
- Nine-dot click calibration before gaze play, as in WebGazer's own demo
- Gaze smoothed with a 1€ filter (Casiez et al., CHI 2012), tuned in `tests/oneEuro.test.js` to cut resting jitter about 4x while still catching a jump in about 5 frames
- Wider hit circle in gaze mode, since webcam gaze lands within about 4 degrees at best (Papoutsaki et al., IJCAI 2016)
- Dwell-to-hit and manual shoot controls
- Score, streak, level, accuracy and median reaction time, with personal bests kept per mode (mouse and gaze) in the browser
- Rings show the dwell filling and the target's time running out
- Touch: drag to aim, tap to shoot
- Session timer with end-state summary
- Unit-tested target/scoring engine
- Static Vercel-ready deployment setup

## Run
```bash
cd eye-aim-trainer
npm run dev
```
Open `http://127.0.0.1:8105/eye-aim-trainer/index.html`.

## Test
```bash
cd eye-aim-trainer
npm test
```

## Deploy
```bash
cd eye-aim-trainer
npx vercel --prod
```

## Inspiration
- https://github.com/brownhci/WebGazer

## Structure
```text
eye-aim-trainer/
  index.html
  styles.css
  app.js
  src/
    targetEngine.js
  tests/
    targetEngine.test.js
  package.json
  vercel.json
  README.md
```
