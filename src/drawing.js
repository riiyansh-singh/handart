/**
 * gesture.js — HandArt Gesture Recognition Engine
 * Analyses 21 MediaPipe Hands landmarks and returns a debounced gesture label.
 */

'use strict';

export const GESTURES = {
  DRAWING : 'DRAWING',   // ☝  index finger only → draw
  PINCH   : 'PINCH',     // 🤏  thumb + index close → grab / move
  OPEN    : 'OPEN',      // ✋  all fingers extended → pause
  FIST    : 'FIST',      // ✊  no fingers extended  → hold to clear
  PEACE   : 'PEACE',     // ✌  index + middle       → cycle colour
  UNKNOWN : 'UNKNOWN',
};

/** Tip and PIP landmark indices (MediaPipe order). */
const TIPS = [4, 8, 12, 16, 20];
const PIPS = [3, 6, 10, 14, 18];

export class GestureRecognizer {
  /**
   * @param {object} opts
   * @param {number} opts.pinchThreshold   – normalised thumb–index distance for pinch (default 0.075)
   * @param {number} opts.debounceFrames   – frames of consistency before gesture commits (default 4)
   */
  constructor({ pinchThreshold = 0.075, debounceFrames = 4 } = {}) {
    this.pinchThreshold = pinchThreshold;
    this.debounceFrames = debounceFrames;

    this._buffer  = [];
    this._stable  = GESTURES.UNKNOWN;
  }

  /**
   * Recognise a gesture from landmarks.
   * @param {Array}  landmarks  – 21 normalised {x,y,z} objects
   * @param {string} handedness – 'Left' | 'Right'
   * @returns {string} stable gesture label
   */
  recognize(landmarks, handedness) {
    if (!landmarks?.length) return GESTURES.UNKNOWN;

    const raw = this._raw(landmarks, handedness);

    this._buffer.push(raw);
    if (this._buffer.length > this.debounceFrames) this._buffer.shift();

    if (this._buffer.every(g => g === raw)) this._stable = raw;
    return this._stable;
  }

  /**
   * Returns a 0–1 pinch strength value (1 = fully pinched).
   * @param {Array} landmarks
   */
  pinchStrength(landmarks) {
    const d = this._dist2D(landmarks[4], landmarks[8]);
    return Math.max(0, 1 - d / this.pinchThreshold);
  }

  /** Returns normalised (0–1) index fingertip position, mirrored for selfie view. */
  indexTip(landmarks) {
    return { x: 1 - landmarks[8].x, y: landmarks[8].y, z: landmarks[8].z };
  }

  /** Returns normalised midpoint between thumb and index tips, mirrored. */
  pinchMidpoint(landmarks) {
    return {
      x: 1 - (landmarks[4].x + landmarks[8].x) / 2,
      y: (landmarks[4].y + landmarks[8].y) / 2,
      z: (landmarks[4].z + landmarks[8].z) / 2,
    };
  }

  // ── private ────────────────────────────────────────────────────

  _raw(lm, handedness) {
    // Fast pinch check overrides everything
    if (this._dist2D(lm[4], lm[8]) < this.pinchThreshold) return GESTURES.PINCH;

    const ext   = this._extendedFingers(lm, handedness);
    const count = ext.reduce((n, v) => n + (v ? 1 : 0), 0);

    if (count === 0)                              return GESTURES.FIST;
    if (count >= 4)                               return GESTURES.OPEN;
    if ( ext[1] && !ext[2] && !ext[3] && !ext[4]) return GESTURES.DRAWING;
    if ( ext[1] &&  ext[2] && !ext[3] && !ext[4]) return GESTURES.PEACE;

    return GESTURES.UNKNOWN;
  }

  /**
   * Returns [thumb, index, middle, ring, pinky] boolean array.
   * Thumb uses x-axis comparison; others use y-axis (tip above pip = extended).
   */
  _extendedFingers(lm, handedness) {
    const isRight = handedness === 'Right';
    return [
      isRight ? lm[4].x < lm[2].x : lm[4].x > lm[2].x,
      ...TIPS.slice(1).map((tip, i) => lm[tip].y < lm[PIPS[i + 1]].y),
    ];
  }

  _dist2D(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
