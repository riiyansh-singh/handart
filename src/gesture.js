/**
 * ui.js — HandArt UI Manager + Utilities
 *
 * Thin wrappers that sync DOM state with app state.
 * Keeps the main app loop clean and readable.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// SMOOTHED POINT  – exponential moving average for fingertip tracking
// ─────────────────────────────────────────────────────────────────

export class SmoothedPoint {
  /**
   * @param {number} factor – smoothing strength 0 (raw) → 1 (frozen). Default 0.55.
   */
  constructor(factor = 0.55) {
    this.factor = factor;
    this.x = 0; this.y = 0; this.z = 0;
    this._init = false;
  }

  update(x, y, z = 0) {
    if (!this._init) {
      this.x = x; this.y = y; this.z = z;
      this._init = true;
      return;
    }
    const k = 1 - this.factor;
    this.x += (x - this.x) * k;
    this.y += (y - this.y) * k;
    this.z += (z - this.z) * k;
  }

  reset() { this._init = false; }

  /** Scale by canvas dimensions to get pixel coords. */
  toPixels(W, H) {
    return { x: this.x * W, y: this.y * H, z: this.z };
  }
}

// ─────────────────────────────────────────────────────────────────
// UI MANAGER
// ─────────────────────────────────────────────────────────────────

const GESTURE_LABELS = {
  DRAWING : '☝  Drawing',
  PINCH   : '🤏  Grab',
  OPEN    : '✋  Paused',
  FIST    : '✊  Clearing',
  PEACE   : '✌  Color',
  UNKNOWN : '· · ·',
};

export class UIManager {
  constructor() {
    // HUD elements
    this.modeBadge    = document.getElementById('mode-badge');
    this.modeText     = document.getElementById('mode-text');
    this.modeDot      = document.getElementById('mode-dot');
    this.colorSwatch  = document.getElementById('color-swatch');
    this.colorName    = document.getElementById('color-name');
    this.fistWrap     = document.getElementById('fist-bar-wrap');
    this.fistBar      = document.getElementById('fist-bar');
    this.fistPct      = document.getElementById('fist-pct');
    this.noHand       = document.getElementById('no-hand');
    this.confBars     = document.getElementById('conf-bars');
    this.strokeCount  = document.getElementById('stroke-count');
    this.clearFlash   = document.getElementById('clear-flash');
    this.saveToast    = document.getElementById('save-toast');
    this.help         = document.getElementById('help');
    this.swatchRow    = document.getElementById('swatch-row');

    this._saveTimer   = null;

    // Fade help hint after 10 s
    setTimeout(() => this.help?.classList.add('faded'), 10_000);
  }

  /**
   * Main update — called every frame.
   * @param {object} state
   */
  update({
    gesture      = 'UNKNOWN',
    color,
    fistFrames   = 0,
    fistMax      = 28,
    confidence   = 0,
    strokeCount  = 0,
    handPresent  = false,
  }) {
    // ── gesture badge ──
    this.modeBadge?.setAttribute('data-gesture', gesture);
    if (this.modeText) this.modeText.textContent = GESTURE_LABELS[gesture] ?? '· · ·';

    // ── color panel ──
    if (color && this.colorSwatch) {
      this.colorSwatch.style.background = color.hex;
      this.colorSwatch.style.boxShadow  = `0 0 10px ${color.hex}, 0 0 28px ${color.shadow}`;
      this.colorName.textContent        = color.id;
      this.colorName.style.color        = color.hex;
    }

    // ── fist progress ──
    const pct = Math.min(fistFrames / fistMax, 1);
    if (gesture === 'FIST') {
      this.fistWrap?.classList.add('visible');
      if (this.fistBar)  this.fistBar.style.width      = (pct * 100) + '%';
      if (this.fistPct)  this.fistPct.textContent      = Math.round(pct * 100) + '%';
    } else {
      this.fistWrap?.classList.remove('visible');
      if (this.fistBar) this.fistBar.style.width = '0%';
    }

    // ── no-hand indicator ──
    handPresent
      ? this.noHand?.classList.remove('visible')
      : this.noHand?.classList.add('visible');

    // ── confidence bars (5 segments) ──
    if (this.confBars) {
      const active = Math.round(confidence * 5);
      Array.from(this.confBars.children).forEach((bar, i) => {
        bar.classList.toggle('active', i < active);
      });
    }

    // ── stroke counter ──
    if (this.strokeCount) this.strokeCount.textContent = strokeCount;
  }

  /** Highlight the active color swatch in the palette row. */
  highlightSwatch(colorIndex) {
    if (!this.swatchRow) return;
    Array.from(this.swatchRow.children).forEach((el, i) => {
      el.classList.toggle('active', i === colorIndex);
    });
  }

  /** Brief red screen flash on canvas clear. */
  flashClear() {
    this.clearFlash?.classList.add('active');
    setTimeout(() => this.clearFlash?.classList.remove('active'), 220);
  }

  /** Short "Saved ✦" toast notification. */
  showSaveToast() {
    clearTimeout(this._saveTimer);
    this.saveToast?.classList.add('visible');
    this._saveTimer = setTimeout(() => this.saveToast?.classList.remove('visible'), 2200);
  }

  // ── loading screen ──

  setLoading(label, progress) {
    const el = document.getElementById('loading-label');
    const bar = document.getElementById('loading-bar');
    if (el)  el.textContent    = label;
    if (bar) bar.style.width   = progress + '%';
  }

  hideLoading() {
    const el = document.getElementById('loading');
    if (!el) return;
    el.classList.add('hidden');
    setTimeout(() => el.remove(), 900);
  }
}
