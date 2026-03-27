/**
 * drawing.js — HandArt Drawing System
 *
 * Manages two layered canvases:
 *   persistCanvas – all completed, permanent strokes
 *   activeCanvas  – the in-progress stroke (cleared every frame)
 *
 * Features:
 *   • Quadratic Bézier smoothing for natural line feel
 *   • Multi-layer neon glow rendering
 *   • z-depth illusion (MediaPipe z coord affects width/brightness)
 *   • Grab-and-move any completed stroke by pinching near it
 *   • Particle trail emitter on active stroke tip
 */

'use strict';

/** Glow layer stack: drawn back-to-front, wide-dim → narrow-bright */
const GLOW_LAYERS = [
  { widthMult: 10, alpha: 0.04, blur: 40 },
  { widthMult: 5,  alpha: 0.12, blur: 20 },
  { widthMult: 2.5,alpha: 0.40, blur: 8  },
  { widthMult: 1,  alpha: 0.95, blur: 0  },
];

/** Available neon palette */
export const COLORS = [
  { id: 'CYAN',    hex: '#00e5ff', shadow: '#0055ff', glow: 'rgba(0,229,255,'   },
  { id: 'MAGENTA', hex: '#ff00cc', shadow: '#aa00ff', glow: 'rgba(255,0,204,'   },
  { id: 'EMERALD', hex: '#00ff88', shadow: '#008844', glow: 'rgba(0,255,136,'   },
  { id: 'AMBER',   hex: '#ff9500', shadow: '#ff4400', glow: 'rgba(255,149,0,'   },
  { id: 'VOLT',    hex: '#ccff00', shadow: '#66aa00', glow: 'rgba(204,255,0,'   },
  { id: 'ROSE',    hex: '#ff0066', shadow: '#aa0033', glow: 'rgba(255,0,102,'   },
  { id: 'LAVENDER',hex: '#cc88ff', shadow: '#6600ff', glow: 'rgba(204,136,255,' },
  { id: 'WHITE',   hex: '#d0eeff', shadow: '#4488bb', glow: 'rgba(208,238,255,' },
];

const MIN_POINT_DIST = 4;  // px – skip micro-movements
const GRAB_RADIUS    = 90; // px – search radius when pinching

export class DrawingSystem {
  /**
   * @param {HTMLCanvasElement} persistCanvas
   * @param {HTMLCanvasElement} activeCanvas
   * @param {HTMLCanvasElement} particleCanvas
   */
  constructor(persistCanvas, activeCanvas, particleCanvas) {
    this.pCv  = persistCanvas;
    this.aCv  = activeCanvas;
    this.ptCv = particleCanvas;

    this.pCtx  = persistCanvas.getContext('2d');
    this.aCtx  = activeCanvas.getContext('2d');
    this.ptCtx = particleCanvas.getContext('2d');

    /** Completed stroke list: [{points:[{x,y,z}], color, width}] */
    this.strokes      = [];
    this.activeStroke = null;   // stroke being drawn right now
    this.lastPt       = null;

    /** Grabbed stroke reference for drag operations */
    this.grabbed     = null;
    this.grabOrigin  = null;

    this.colorIndex  = 0;
    this.baseWidth   = 3;

    /** Simple particle pool for tip trail */
    this._particles  = [];
  }

  // ── accessors ──────────────────────────────────────────────────

  get W() { return this.pCv.width;  }
  get H() { return this.pCv.height; }

  get color() { return COLORS[this.colorIndex]; }

  nextColor() {
    this.colorIndex = (this.colorIndex + 1) % COLORS.length;
  }

  // ── stroke lifecycle ───────────────────────────────────────────

  beginStroke(x, y, z = 0) {
    this.activeStroke = {
      points : [{ x, y, z }],
      color  : this.color,
      width  : this.baseWidth,
    };
    this.lastPt = { x, y, z };
  }

  addPoint(x, y, z = 0) {
    if (!this.activeStroke) return;
    if (Math.hypot(x - this.lastPt.x, y - this.lastPt.y) < MIN_POINT_DIST) return;

    this.activeStroke.points.push({ x, y, z });
    this.lastPt = { x, y, z };

    this._spawnParticle(x, y, this.color);
    this._renderActive();
  }

  endStroke() {
    if (!this.activeStroke) return;
    if (this.activeStroke.points.length >= 2) {
      this._renderStrokeTo(this.pCtx, this.activeStroke);
      this.strokes.push(this.activeStroke);
    }
    this.activeStroke = null;
    this.aCtx.clearRect(0, 0, this.W, this.H);
  }

  clearAll() {
    this.strokes      = [];
    this.activeStroke = null;
    this.grabbed      = null;
    this._particles   = [];
    this.pCtx.clearRect(0, 0, this.W, this.H);
    this.aCtx.clearRect(0, 0, this.W, this.H);
    this.ptCtx.clearRect(0, 0, this.W, this.H);
  }

  // ── grab & move ────────────────────────────────────────────────

  grabAt(x, y) {
    let closest = null, minD = GRAB_RADIUS;
    for (const stroke of this.strokes) {
      for (const pt of stroke.points) {
        const d = Math.hypot(x - pt.x, y - pt.y);
        if (d < minD) { minD = d; closest = stroke; }
      }
    }
    if (closest) { this.grabbed = closest; this.grabOrigin = { x, y }; }
    return !!closest;
  }

  moveGrab(x, y) {
    if (!this.grabbed || !this.grabOrigin) return;
    const dx = x - this.grabOrigin.x;
    const dy = y - this.grabOrigin.y;
    for (const pt of this.grabbed.points) { pt.x += dx; pt.y += dy; }
    this.grabOrigin = { x, y };
    this._redrawPersist();
  }

  releaseGrab() {
    this.grabbed    = null;
    this.grabOrigin = null;
  }

  // ── particles ──────────────────────────────────────────────────

  tickParticles() {
    const ctx = this.ptCtx;
    ctx.clearRect(0, 0, this.W, this.H);

    this._particles = this._particles.filter(p => p.life > 0);
    for (const p of this._particles) {
      p.x   += p.vx;
      p.y   += p.vy;
      p.vy  += 0.04;   // gravity
      p.life -= 0.03;

      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fillStyle   = p.color;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.restore();
    }
  }

  _spawnParticle(x, y, col) {
    if (this._particles.length > 120) return; // pool cap
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 1.5;
    this._particles.push({
      x, y,
      vx   : Math.cos(angle) * speed,
      vy   : Math.sin(angle) * speed - 1,
      r    : 2 + Math.random() * 2,
      life : 0.8 + Math.random() * 0.2,
      color: col.hex,
    });
  }

  // ── rendering ──────────────────────────────────────────────────

  /**
   * Draw a stroke object on a given context using quadratic Bézier curves
   * and layered glow passes.
   */
  _renderStrokeTo(ctx, stroke) {
    const pts = stroke.points;
    if (pts.length < 2) return;

    const col   = stroke.color;
    const baseW = stroke.width;
    const depthBoost = 1 + (pts[0].z || 0) * 1.5;

    ctx.save();
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    for (const layer of GLOW_LAYERS) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);

      // Smooth path through midpoints
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

      ctx.strokeStyle = col.hex;
      ctx.globalAlpha = Math.min(1, layer.alpha * depthBoost);
      ctx.lineWidth   = baseW * layer.widthMult * depthBoost;
      ctx.shadowBlur  = layer.blur;
      ctx.shadowColor = col.shadow;
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Re-render all completed strokes onto persistCanvas. Called after move/resize. */
  _redrawPersist() {
    this.pCtx.clearRect(0, 0, this.W, this.H);
    for (const stroke of this.strokes) this._renderStrokeTo(this.pCtx, stroke);
  }

  /** Render the in-progress stroke on activeCanvas. */
  _renderActive() {
    if (!this.activeStroke) return;
    this.aCtx.clearRect(0, 0, this.W, this.H);
    this._renderStrokeTo(this.aCtx, this.activeStroke);
  }

  // ── save ───────────────────────────────────────────────────────

  /**
   * Composites all layers and triggers a PNG download.
   * @param {HTMLVideoElement} [videoEl] – optional: include camera feed
   */
  saveImage(videoEl = null) {
    const off = document.createElement('canvas');
    off.width = this.W; off.height = this.H;
    const ctx = off.getContext('2d');

    ctx.fillStyle = '#000810';
    ctx.fillRect(0, 0, this.W, this.H);

    if (videoEl) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.translate(this.W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoEl, 0, 0, this.W, this.H);
      ctx.restore();
    }

    ctx.drawImage(this.pCv, 0, 0);
    ctx.drawImage(this.aCv, 0, 0);

    const link      = document.createElement('a');
    link.download   = `handart_${Date.now()}.png`;
    link.href       = off.toDataURL('image/png');
    link.click();
  }

  // ── resize ─────────────────────────────────────────────────────

  onResize(oldW, oldH, newW, newH) {
    const sx = newW / oldW, sy = newH / oldH;
    const scale = pt => { pt.x *= sx; pt.y *= sy; };

    for (const stroke of this.strokes) stroke.points.forEach(scale);
    this.activeStroke?.points.forEach(scale);
    this._redrawPersist();
  }
}
