# Eye Aim Trainer

## Description
Eye Aim Trainer is a gaze-driven target practice game with WebGazer tracking and robust mouse fallback.

## Features
- Live aim arena with moving targets
- WebGazer integration for eye-gaze cursor control
- Dwell-to-hit and manual shoot controls
- Score, streak, level, and accuracy tracking
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
