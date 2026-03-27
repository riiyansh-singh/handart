/**
 * renderer.js — HandArt Hand Skeleton Renderer
 *
 * Draws a neon-glowing 21-landmark hand skeleton on a 2D canvas.
 * Adapts visual style based on the current gesture.
 */

'use strict';

import { GESTURES } from './gesture.js';

/** Bone pairs (landmark index pairs) defining the hand skeleton. */
const BONES = [
  // Thumb
  [0,1],[1,2],[2,3],[3,4],
  // Index
  [0,5],[5,6],[6,7],[7,8],
  // Middle
  [0,9],[9,10],[10,11],[11,12],
  // Ring
  [0,13],[13,14],[14,15],[15,16],
  // Pinky
  [0,17],[17,18],[18,19],[19,20],
  // Palm arch
  [5,9],[9,13],[13,17],
];

const TIPS = new Set([4, 8, 12, 16, 20]);

export class HandRenderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.cv  = canvas;
    this.ctx = canvas.getContext('2d');
  }

  get W() { return this.cv.width;  }
  get H() { return this.cv.height; }

  /**
   * Render one frame.
   * @param {Array|null} landmarks  – 21 normalised {x,y,z}
   * @param {string}     gesture
   * @param {number}     pinchStr  – 0–1
   * @param {object}     color     – current COLORS entry
   * @param {number}     confidence – 0–1
   */
  render(landmarks, gesture, pinchStr, color, confidence = 1) {
    this.ctx.clearRect(0, 0, this.W, this.H);
    if (!landmarks) return;

    // Convert normalised → pixel (mirror x for selfie view)
    const pts = landmarks.map(lm => ({
      x: (1 - lm.x) * this.W,
      y: lm.y        * this.H,
      z: lm.z,
    }));

    const isDrawing = gesture === GESTURES.DRAWING;
    const isPinch   = gesture === GESTURES.PINCH;
    const isFist    = gesture === GESTURES.FIST;
    const isPeace   = gesture === GESTURES.PEACE;

    // Low confidence → render dimmer
    const alpha = 0.3 + confidence * 0.7;

    this._drawBones(pts, gesture, alpha, color);
    this._drawJoints(pts, gesture, alpha, color);

    if (isDrawing)       this._drawTipAura(pts[8], color);
    if (isPinch)         this._drawPinchBridge(pts, pinchStr, alpha);
    if (isFist)          this._drawFistRing(pts, alpha);
    if (isPeace)         this._drawPeaceGlow(pts, color, alpha);
  }

  // ── skeleton ───────────────────────────────────────────────────

  _drawBones(pts, gesture, alpha, color) {
    const ctx = this.ctx;
    const isDrawing = gesture === GESTURES.DRAWING;

    ctx.save();
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha;

    for (const [a, b] of BONES) {
      const pa = pts[a], pb = pts[b];

      // Draw each bone with a glow pass + solid pass
      for (const pass of [
        { w: 4,   blur: 10, opacity: 0.15 },
        { w: 1.5, blur: 0,  opacity: 0.6  },
      ]) {
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = isDrawing ? color.hex : 'rgba(0,200,240,0.9)';
        ctx.globalAlpha = alpha * pass.opacity;
        ctx.lineWidth   = pass.w;
        ctx.shadowBlur  = pass.blur;
        ctx.shadowColor = isDrawing ? color.hex : '#0099cc';
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _drawJoints(pts, gesture, alpha, color) {
    const ctx = this.ctx;
    const isDrawing = gesture === GESTURES.DRAWING;

    for (let i = 0; i < pts.length; i++) {
      const pt      = pts[i];
      const isTip   = TIPS.has(i);
      const isIndex = i === 8;

      ctx.save();
      ctx.globalAlpha = alpha;

      const r = isIndex && isDrawing ? 7 : isTip ? 4.5 : 2.5;

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);

      if (isIndex && isDrawing) {
        ctx.fillStyle   = color.hex;
        ctx.shadowBlur  = 24;
        ctx.shadowColor = color.hex;
      } else {
        ctx.fillStyle   = isTip ? 'rgba(0,230,255,0.95)' : 'rgba(0,180,220,0.6)';
        ctx.shadowBlur  = isTip ? 10 : 4;
        ctx.shadowColor = '#00aaee';
      }
      ctx.fill();

      // Extra ring on index tip when drawing
      if (isIndex && isDrawing) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r + 8, 0, Math.PI * 2);
        ctx.strokeStyle = color.glow + '0.3)';
        ctx.lineWidth   = 1.5;
        ctx.shadowBlur  = 12;
        ctx.shadowColor = color.hex;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // ── gesture-specific overlays ──────────────────────────────────

  /** Pulsing aura ring around index fingertip during drawing. */
  _drawTipAura(pt, color) {
    const ctx = this.ctx;
    const t   = performance.now() / 600;
    const r   = 18 + Math.sin(t) * 5;

    ctx.save();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = color.glow + '0.18)';
    ctx.lineWidth   = 3;
    ctx.shadowBlur  = 20;
    ctx.shadowColor = color.hex;
    ctx.stroke();
    ctx.restore();
  }

  /** Amber bridge line + midpoint burst for pinch gesture. */
  _drawPinchBridge(pts, pinchStr, alpha) {
    const ctx = this.ctx;
    const t4  = pts[4], t8 = pts[8];
    const mx  = (t4.x + t8.x) / 2;
    const my  = (t4.y + t8.y) / 2;

    ctx.save();
    ctx.globalAlpha = alpha * pinchStr;

    // Bridge line
    ctx.beginPath();
    ctx.moveTo(t4.x, t4.y);
    ctx.lineTo(t8.x, t8.y);
    ctx.strokeStyle = '#ff9500';
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 16;
    ctx.shadowColor = '#ff6600';
    ctx.stroke();

    // Midpoint burst
    ctx.beginPath();
    ctx.arc(mx, my, 8 + pinchStr * 10, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,149,0,${pinchStr})`;
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 24;
    ctx.stroke();

    ctx.restore();
  }

  /** Red pulsing ring around wrist for fist/clear gesture. */
  _drawFistRing(pts, alpha) {
    const ctx = this.ctx;
    const cx  = pts[0].x, cy = pts[0].y;
    const t   = performance.now() / 400;
    const r   = 40 + Math.sin(t) * 6;

    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 20;
    ctx.shadowColor = '#ff0000';
    ctx.stroke();
    ctx.restore();
  }

  /** Volt glow on index + middle tips for peace / colour-change. */
  _drawPeaceGlow(pts, color, alpha) {
    const ctx = this.ctx;
    for (const tip of [pts[8], pts[12]]) {
      ctx.save();
      ctx.globalAlpha = alpha * 0.8;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#ccff00';
      ctx.lineWidth   = 2;
      ctx.shadowBlur  = 18;
      ctx.shadowColor = '#aaff00';
      ctx.stroke();
      ctx.restore();
    }
  }
}
