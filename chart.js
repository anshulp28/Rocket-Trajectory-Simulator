/**
 * chart.js — Real-Time Trajectory Chart Renderer
 * Day 4: Draws the rocket's flight path and telemetry on HTML5 Canvas.
 *
 * This file handles ALL drawing — nothing else.
 * It reads data from the simulation and renders it visually.
 * Zero simulation logic lives here.
 *
 * WHAT IT DRAWS:
 *   - Altitude vs time graph (main trajectory line)
 *   - Reference lines: Kármán line (100km), LEO (200km)
 *   - Settle band: ±2% zone around target altitude
 *   - Mission event markers (Max-Q, Mach 1, burnout, etc.)
 *   - Live telemetry overlay (speed, G-force, altitude readout)
 *   - Animated rocket dot tracking current position
 *   - Gradient fill under trajectory line
 *   - Grid lines and axis labels
 *   - Legend
 *   - Empty state (before launch)
 */

const RocketChart = (() => {

  // ---- Private state ----
  let canvas  = null;
  let ctx     = null;
  let padding = { top: 24, right: 80, bottom: 36, left: 58 };

  // Color palette — matches the CSS variables + custom rocket colors
  const COLORS = {
    trajectory:   '#185FA5',   // blue  — main flight path
    trajectoryOk: '#3B6D11',   // green — orbit achieved
    trajectoryErr:'#E24B4A',   // red   — structural failure
    karman:       '#185FA5',   // blue dashed — Kármán line
    leo:          '#3B6D11',   // green dashed — LEO altitude
    maxQ:         '#D85A30',   // orange — Max-Q marker
    mach1:        '#854F0B',   // brown — Mach 1 marker
    burnout:      '#6B3FA0',   // purple — engine cutoff marker
    grid:         null,        // read from CSS var at draw time
    text:         null,        // read from CSS var at draw time
    surface:      null,        // read from CSS var at draw time
  };

  // Reference altitudes to draw as horizontal lines
  const REFERENCE_LINES = [
    { altitude: 100_000, label: 'Kármán line (space)',  color: '#185FA5', dash: [5, 3] },
    { altitude: 200_000, label: 'LEO (200 km)',         color: '#3B6D11', dash: [5, 3] },
  ];

  // Altitude grid marks in km
  const GRID_MARKS_KM = [0, 50, 100, 150, 200, 250, 300, 400, 500];

  // ============================================================
  // INITIALIZATION
  // ============================================================

  /**
   * Initialize the chart on a canvas element.
   * @param {string} canvasId - ID of the <canvas> element
   */
  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error('RocketChart: canvas not found:', canvasId);
      return;
    }
    ctx = canvas.getContext('2d');

    // Auto-resize when container changes size
    const observer = new ResizeObserver(() => _resize());
    observer.observe(canvas.parentElement);
    _resize();

    // Draw empty state immediately
    drawEmpty();
  }

  /**
   * Resize canvas to match its container, accounting for device pixel ratio.
   * This prevents blurry rendering on Retina/HiDPI screens.
   */
  function _resize() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    const dpr    = window.devicePixelRatio || 1;
    const W      = parent.clientWidth;
    const H      = parent.clientHeight;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);
  }

  // ============================================================
  // CSS VARIABLE HELPERS
  // Reads colors from CSS so dark mode works automatically
  // ============================================================

  function _css(varName) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(varName).trim();
  }

  function _colors() {
    return {
      grid:    _css('--border')         || '#e5e4e0',
      text:    _css('--text-secondary') || '#9a9a95',
      textPri: _css('--text-primary')   || '#1c1c1a',
      surface: _css('--surface-2')      || '#f9f9f8',
    };
  }

  // ============================================================
  // COORDINATE HELPERS
  // Convert data values → pixel coordinates
  // ============================================================

  function _plotW() { return canvas.clientWidth  - padding.left - padding.right;  }
  function _plotH() { return canvas.clientHeight - padding.top  - padding.bottom; }

  /**
   * Convert altitude (meters) to canvas Y pixel.
   * Higher altitude = lower Y value (top of canvas).
   */
  function _altToY(altitude, maxDisplayAlt) {
    const ratio = Math.max(0, Math.min(1, altitude / maxDisplayAlt));
    return padding.top + _plotH() * (1 - ratio);
  }

  /**
   * Convert history index to canvas X pixel.
   */
  function _idxToX(index, total) {
    if (total <= 1) return padding.left;
    return padding.left + (index / (total - 1)) * _plotW();
  }

  // ============================================================
  // MAIN DRAW FUNCTION
  // Called every animation frame during simulation.
  // ============================================================

  /**
   * Draw the full chart with current simulation data.
   *
   * @param {Array}  history  - Array of { t, alt, speed, gForce, dynPressure, status }
   * @param {Array}  events   - Array of { type, time, altitude, value }
   * @param {object} rocket   - Current rocket state (for live readout)
   */
  function draw(history, events = [], rocket = null) {
    if (!ctx || !canvas) return;

    const W  = canvas.clientWidth;
    const H  = canvas.clientHeight;
    const pw = _plotW();
    const ph = _plotH();
    const c  = _colors();

    // Determine max display altitude — at least 250km, or 25% above max reached
    const maxReached   = history.length > 0
      ? Math.max(...history.map(p => p.alt))
      : 0;
    const maxDisplayAlt = Math.max(250_000, maxReached * 1.25);

    // ---- Clear canvas ----
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = c.surface;
    ctx.fillRect(0, 0, W, H);

    // ---- Draw grid lines and Y axis labels ----
    _drawGrid(W, H, pw, ph, c, maxDisplayAlt);

    // ---- Draw reference lines (Kármán, LEO) ----
    _drawReferenceLines(W, ph, c, maxDisplayAlt);

    // ---- Draw trajectory ----
    if (history.length >= 2) {
      _drawTrajectory(history, maxDisplayAlt, rocket);
    }

    // ---- Draw mission event markers ----
    if (events.length > 0 && history.length > 0) {
      _drawEventMarkers(events, history, maxDisplayAlt, c);
    }

    // ---- Draw live telemetry overlay ----
    if (rocket && history.length > 0) {
      _drawTelemetry(rocket, c);
    }

    // ---- Draw X axis labels (time) ----
    if (history.length > 0) {
      _drawTimeAxis(history, pw, ph, c);
    }

    // ---- Draw legend ----
    _drawLegend(c);
  }

  // ============================================================
  // DRAWING HELPERS
  // ============================================================

  function _drawGrid(W, H, pw, ph, c, maxDisplayAlt) {
    ctx.strokeStyle = c.grid;
    ctx.lineWidth   = 0.5;
    ctx.fillStyle   = c.text;
    ctx.font        = '10px -apple-system, sans-serif';
    ctx.textAlign   = 'right';

    GRID_MARKS_KM.forEach(km => {
      const alt = km * 1000;
      if (alt > maxDisplayAlt) return;
      const y = _altToY(alt, maxDisplayAlt);

      // Horizontal grid line
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + pw, y);
      ctx.stroke();

      // Y axis label
      ctx.fillText(km + ' km', padding.left - 6, y + 3);
    });
  }

  function _drawReferenceLines(W, ph, c, maxDisplayAlt) {
    REFERENCE_LINES.forEach(ref => {
      if (ref.altitude > maxDisplayAlt) return;
      const y = _altToY(ref.altitude, maxDisplayAlt);

      ctx.strokeStyle = ref.color;
      ctx.lineWidth   = 1;
      ctx.setLineDash(ref.dash);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + _plotW(), y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label on right side
      ctx.fillStyle  = ref.color;
      ctx.font       = '10px -apple-system, sans-serif';
      ctx.textAlign  = 'left';
      ctx.fillText(ref.label, padding.left + _plotW() + 4, y + 3);
    });
  }

  function _drawTrajectory(history, maxDisplayAlt, rocket) {
    const n = history.length;

    // Determine color based on mission outcome
    const lastStatus = history[n - 1].status;
    const lineColor  = lastStatus === 'STRUCTURAL_FAILURE' ? COLORS.trajectoryErr
                     : lastStatus === 'ORBIT_ACHIEVED'     ? COLORS.trajectoryOk
                     : COLORS.trajectory;

    // ---- Draw gradient fill under the line ----
    const gradTop    = _altToY(Math.max(...history.map(p => p.alt)), maxDisplayAlt);
    const gradBottom = _altToY(0, maxDisplayAlt);
    const grad = ctx.createLinearGradient(0, gradTop, 0, gradBottom);
    grad.addColorStop(0,   lineColor + '30'); // 19% opacity at top
    grad.addColorStop(1,   lineColor + '00'); // 0% opacity at bottom

    ctx.beginPath();
    history.forEach((p, i) => {
      const x = _idxToX(i, n);
      const y = _altToY(p.alt, maxDisplayAlt);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    // Close path for fill
    ctx.lineTo(_idxToX(n - 1, n), _altToY(0, maxDisplayAlt));
    ctx.lineTo(padding.left, _altToY(0, maxDisplayAlt));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // ---- Draw the trajectory line itself ----
    ctx.strokeStyle = lineColor;
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.beginPath();
    history.forEach((p, i) => {
      const x = _idxToX(i, n);
      const y = _altToY(p.alt, maxDisplayAlt);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // ---- Draw animated dot at current position ----
    const last = history[n - 1];
    const dotX = _idxToX(n - 1, n);
    const dotY = _altToY(last.alt, maxDisplayAlt);

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
    ctx.fillStyle = lineColor + '30';
    ctx.fill();

    // Inner dot
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();

    // Altitude callout next to dot
    ctx.fillStyle  = lineColor;
    ctx.font       = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign  = 'left';
    ctx.fillText(
      (last.alt / 1000).toFixed(1) + ' km',
      dotX + 10,
      dotY + 4
    );
  }

  function _drawEventMarkers(events, history, maxDisplayAlt, c) {
    const { MissionEvent } = window.__Sim || {};

    // Map event types to display config
    const eventConfig = {
      MACH_1:        { symbol: 'M1',  color: '#854F0B', label: 'Mach 1'    },
      MAX_Q:         { symbol: 'Q',   color: '#D85A30', label: 'Max-Q'     },
      KARMAN_LINE:   { symbol: 'K',   color: '#185FA5', label: 'Space'     },
      ENGINE_CUTOFF: { symbol: 'B',   color: '#6B3FA0', label: 'Burnout'   },
      ORBIT_ACHIEVED:{ symbol: '★',   color: '#3B6D11', label: 'Orbit'     },
    };

    const totalTime = history[history.length - 1].t;

    events.forEach(event => {
      const cfg = eventConfig[event.type];
      if (!cfg) return;

      // Find X position from time
      const timeRatio = totalTime > 0 ? event.time / totalTime : 0;
      const x = padding.left + timeRatio * _plotW();
      const y = _altToY(event.altitude, maxDisplayAlt);

      // Draw vertical tick at event point
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 16);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw circular badge
      ctx.beginPath();
      ctx.arc(x, y - 22, 8, 0, Math.PI * 2);
      ctx.fillStyle = cfg.color;
      ctx.fill();

      // Draw symbol inside badge
      ctx.fillStyle  = '#fff';
      ctx.font       = 'bold 8px -apple-system, sans-serif';
      ctx.textAlign  = 'center';
      ctx.fillText(cfg.symbol, x, y - 19);
    });
  }

  function _drawTelemetry(rocket, c) {
    const W = canvas.clientWidth;

    // Small telemetry box in top-right corner
    const boxW = 130, boxH = 60;
    const boxX = W - padding.right - boxW - 4;
    const boxY = padding.top + 4;

    // Box background
    ctx.fillStyle   = c.surface + 'ee'; // slight transparency
    ctx.strokeStyle = c.grid;
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();

    // Telemetry values
    const lines = [
      { label: 'Speed',  value: Math.round(rocket.speed) + ' m/s'           },
      { label: 'G-force',value: (rocket.gForce || 0).toFixed(1) + ' G'      },
      { label: 'Dyn-Q',  value: Math.round(rocket.dynPressure || 0) + ' Pa' },
    ];

    ctx.font      = '10px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    lines.forEach((line, i) => {
      const ly = boxY + 16 + i * 16;
      ctx.fillStyle = c.text;
      ctx.fillText(line.label, boxX + 8, ly);
      ctx.fillStyle = c.textPri;
      ctx.fillText(line.value, boxX + 55, ly);
    });
  }

  function _drawTimeAxis(history, pw, ph, c) {
    const totalTime = history[history.length - 1].t;
    const tickCount = 5;

    ctx.fillStyle = c.text;
    ctx.font      = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i <= tickCount; i++) {
      const x = padding.left + (i / tickCount) * pw;
      const t = (i / tickCount) * totalTime;
      ctx.fillText(t.toFixed(0) + 's', x, padding.top + ph + 18);
    }

    // X axis label
    ctx.fillStyle = c.text;
    ctx.font      = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Time (seconds)', padding.left + pw / 2, padding.top + ph + 30);
  }

  function _drawLegend(c) {
    const items = [
      { color: COLORS.trajectory,    label: 'Altitude',          dash: false },
      { color: COLORS.karman,        label: 'Kármán line',       dash: true  },
      { color: COLORS.trajectoryOk,  label: 'LEO / Orbit',       dash: true  },
    ];

    let x = padding.left;
    const y = padding.top - 10;

    items.forEach(item => {
      // Line sample
      ctx.strokeStyle = item.color;
      ctx.lineWidth   = 2;
      ctx.setLineDash(item.dash ? [4, 3] : []);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 18, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = c.text;
      ctx.font      = '10px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, x + 22, y + 3);
      x += 90;
    });
  }

  // ============================================================
  // EMPTY STATE
  // Shown before the simulation starts
  // ============================================================

  function drawEmpty() {
    if (!ctx || !canvas) return;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const c = _colors();

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = c.surface;
    ctx.fillRect(0, 0, W, H);

    // Draw grid in empty state too
    _drawGrid(W, H, _plotW(), _plotH(), c, 250_000);
    _drawReferenceLines(W, _plotH(), c, 250_000);

    // Center message
    ctx.fillStyle = c.text;
    ctx.font      = '14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press Launch to begin simulation', W / 2, H / 2);

    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText('Real-time trajectory appears here', W / 2, H / 2 + 20);
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return { init, draw, drawEmpty };

})();

// Expose globally
window.__Chart = RocketChart;
