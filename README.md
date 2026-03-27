<div align="center">

<br/>

```
██╗  ██╗ █████╗ ███╗   ██╗██████╗  █████╗ ██████╗ ████████╗
██║  ██║██╔══██╗████╗  ██║██╔══██╗██╔══██╗██╔══██╗╚══██╔══╝
███████║███████║██╔██╗ ██║██║  ██║███████║██████╔╝   ██║   
██╔══██║██╔══██║██║╚██╗██║██║  ██║██╔══██║██╔══██╗   ██║   
██║  ██║██║  ██║██║ ╚████║██████╔╝██║  ██║██║  ██║   ██║   
╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   
```

### Draw in thin air. No stylus. No screen. Just your hand.

[![License: MIT](https://img.shields.io/badge/License-MIT-00e5ff.svg?style=flat-square)](LICENSE)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-ff00cc.svg?style=flat-square)](https://google.github.io/mediapipe/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-ccff00.svg?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Chrome](https://img.shields.io/badge/Chrome-Recommended-ff9500.svg?style=flat-square)]()
[![No Dependencies](https://img.shields.io/badge/deps-zero-00ff88.svg?style=flat-square)]()

<br/>

</div>

---

## ✨ What is HandArt?

**HandArt** is a browser-based air drawing canvas powered by real-time hand tracking.  
Point your finger at the camera and paint glowing neon strokes — no hardware, no plugins, no installation.  
Just open the HTML file in Chrome and start creating.

> Works entirely in the browser. No server required. No data leaves your device.

---

## 🎮 Gesture Controls

| Gesture | How to do it | Action |
|---------|-------------|--------|
| ☝️ **Index only** | Extend only your index finger | **Draw** — traces a glowing neon path |
| 🤏 **Pinch** | Bring thumb + index together | **Grab & move** any existing stroke |
| ✌️ **Peace sign** | Extend index + middle fingers | **Cycle color** — hold to change palette |
| ✋ **Open hand** | All fingers extended | **Pause** — lift the pen |
| ✊ **Fist** (hold) | Close all fingers, hold 1 sec | **Clear canvas** — progress bar shows |

---

## 🚀 Quick Start

### Option A — Just open it
```bash
# Clone the repo
git clone https://github.com/yourusername/handart.git
cd handart

# Open in Chrome (camera access required)
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

### Option B — Serve locally (recommended for camera)
```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .

# Then visit http://localhost:8080
```

> **⚠ Chrome required.** Firefox has partial WebRTC limitations with MediaPipe.  
> **⚠ HTTPS or localhost** required for camera access.

---

## 🎨 Color Palette

8 neon colors cycle with the ✌️ peace gesture, or click swatches in the UI:

| | Name | Hex |
|--|------|-----|
| 🔵 | CYAN | `#00e5ff` |
| 🟣 | MAGENTA | `#ff00cc` |
| 🟢 | EMERALD | `#00ff88` |
| 🟠 | AMBER | `#ff9500` |
| 🟡 | VOLT | `#ccff00` |
| 🔴 | ROSE | `#ff0066` |
| 💜 | LAVENDER | `#cc88ff` |
| ⚪ | WHITE | `#d0eeff` |

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `S` | Save drawing as PNG |
| `C` | Clear canvas |
| `N` | Cycle to next color |

---

## 🏗️ Architecture

```
handart/
├── index.html          ← Single-file deployment (works standalone)
├── src/
│   ├── gesture.js      ← GestureRecognizer class
│   ├── drawing.js      ← DrawingSystem + COLORS palette
│   ├── renderer.js     ← HandRenderer (neon skeleton overlay)
│   ├── ui.js           ← UIManager + SmoothedPoint utility
│   └── app.js          ← HandArtApp main controller
├── README.md
├── .gitignore
└── LICENSE
```

### Module Responsibilities

```
┌─────────────────────────────────────────────────────────────────┐
│  Camera (WebRTC)                                                │
│       ↓  raw video frames                                       │
│  MediaPipe Hands  →  21 landmarks per frame                     │
│       ↓                                                         │
│  GestureRecognizer  →  debounced gesture label + positions      │
│       ↓                                                         │
│  HandArtApp (state machine)                                     │
│    ├── DrawingSystem  →  persistCanvas + activeCanvas           │
│    ├── HandRenderer   →  handCanvas (neon skeleton)             │
│    └── UIManager      →  DOM HUD elements                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔬 Technical Details

### Hand Tracking
- **MediaPipe Hands** (model complexity 1) detects 21 3D landmarks at 30+ fps
- Mirror correction: `x` coordinates flipped so the view matches a selfie camera
- Confidence gating: frames below 0.5 score are skipped to prevent jitter

### Gesture Recognition
- **Debounce buffer** — gesture must be stable for N consecutive frames before committing
- **Pinch** detected via normalised Euclidean distance between thumb tip (4) and index tip (8)
- **Finger extension** — each finger: tip.y < pip.y (upward = extended); thumb uses x-axis

### Drawing
- **Exponential moving average** smooths the fingertip position before sampling
- **Quadratic Bézier** curves through midpoints of consecutive stroke points
- **4-layer glow** rendered per stroke (wide dim → narrow bright, back to front)
- **Z-depth** from MediaPipe subtly scales stroke width and brightness
- **Dual canvas**: completed strokes on `persistCanvas`, in-progress on `activeCanvas`  
  → only redraws all when a stroke is moved (grab) or canvas is resized

### Particles
- Tiny emitter spawns particles on the active fingertip during drawing
- Simple physics: gravity + velocity → faded out over ~30 frames
- Pool capped at 150 to maintain 60fps

---

## 🖥️ Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome 90+ | ✅ Full support | Recommended |
| Edge (Chromium) | ✅ Works | Same engine as Chrome |
| Firefox | ⚠ Partial | MediaPipe WASM may have issues |
| Safari | ❌ Limited | WebRTC restrictions |
| Mobile Chrome | ⚠ Experimental | Performance varies |

---

## 🔒 Privacy

HandArt processes all video **entirely in your browser**.  
No camera frames, landmarks, or drawings are ever sent to a server.  
The only network request is loading MediaPipe's WASM model from jsDelivr CDN (~5MB, cached).

---

## 📄 License

MIT © 2024 — free to use, modify, and distribute.  
See [LICENSE](LICENSE) for full terms.

---

<div align="center">

Made with ✦ and no stylus

</div>
