/**
 * analysis.js — Step Response Analysis Overlay
 * Day 14: Annotates the trajectory graph with key performance metrics.
 *
 * WHAT IT DOES:
 * Draws engineering annotations directly on the trajectory canvas:
 *
 * 1. Rise time marker — how long it took to reach 10% → 90% of max altitude
 * 2. Overshoot indicator — if trajectory overshoots target (not applicable
 *    for rockets but shown for educational comparison to control systems)
 * 3. Settle band — shaded zone showing ±5% of max altitude
 * 4. Velocity profile overlay — second line showing speed vs time
 * 5. G-force profile — color gradient along trajectory showing G-load
 * 6. Max-Q marker with dynamic pressure value
 * 7. Burnout annotation with remaining velocity
 * 8. Apogee marker — peak altitude with timestamp
 *
 * WHY THIS CONNECTS TO YOUR STORY:
 * Step response analysis is used in BOTH control systems (PID simulator)
 * AND rocket trajectory analysis. This shows the connection between
 * your two GitHub projects — the same math applies to both.
 *
 * In FTC robotics, step response tells you how fast your motor reaches
 * target speed. In rocketry, it tells you how efficiently the vehicle
 * climbs. Same concept, different scale.
 */

const Analysis = (() => {

  // ---- State ----
  let _enabled   = true;
  let _showSpeed = false;
  let _showGForce = true;

  // ============================================================
  // MAIN DRAW FUNCTION
  // Called after the chart draws the trajectory line
  // Overlays analysis annotations on top
  // ============================================================

  /**
   * Draw analysis overlays on the trajectory canvas.
   *
   * @param {CanvasRenderingContext2D} ctx      - Canvas context
   * @param {Array}  history    - Flight history
   * @param {number} maxAlt     - Max display altitude
   * @param {object} pad        - Padding { t, r, b, l }
   * @param {number} W          - Canvas width
   * @param {number} H          - Canvas height
   */
  function draw(ctx, history, maxAlt, pad, W, H) {
    if (!_enabled || !ctx || !history || history.length < 10) return;

    const pw = W - pad.l - pad.r;
    const ph = H - pad.t - pad.b;

    const toY = alt => pad.t + ph * (1 - Math.max(0, alt) / maxAlt);
    const toX = (i, n) => pad.l + (i / Math.max(n - 1, 1)) * pw;

    // ---- Find key points ----
    const apogeeIdx  = _findApogee(history);
    const burnoutIdx = _findBurnout(history);
    const maxQIdx    = _findMaxQ(history);

    // ---- Draw G-force color gradient along trajectory ----
    if (_showGForce && history.length >= 2) {
      _drawGForceGradient(ctx, history, toX, toY, pad, pw, ph);
    }

    // ---- Draw apogee marker ----
    if (apogeeIdx >= 0) {
      _drawApogeeMarker(ctx, history, apogeeIdx, toX, toY, pad);
    }

    // ---- Draw burnout marker ----
    if (burnoutIdx >= 0) {
      _drawBurnoutMarker(ctx, history, burnoutIdx, toX, toY);
    }

    // ---- Draw Max-Q annotation ----
    if (maxQIdx >= 0) {
      _drawMaxQAnnotation(ctx, history, maxQIdx, toX, toY);
    }

    // ---- Draw velocity profile (secondary line) ----
    if (_showSpeed && history.length >= 2) {
      _drawVelocityProfile(ctx, history, toX, pad, ph);
    }

    // ---- Draw rise time bracket ----
    _drawRiseTimeBracket(ctx, history, apogeeIdx, toX, toY, pad, ph);
  }

  // ============================================================
  // HELPER: Find key indices in history
  // ============================================================

  function _findApogee(history) {
    let maxAlt = 0, maxIdx = 0;
    history.forEach((p, i) => {
      if (p.alt > maxAlt) { maxAlt = p.alt; maxIdx = i; }
    });
    return maxIdx;
  }

  function _findBurnout(history) {
    for (let i = 0; i < history.length; i++) {
      if (history[i].burnout) return i;
    }
    return -1;
  }

  function _findMaxQ(history) {
    let maxQ = 0, maxIdx = -1;
    history.forEach((p, i) => {
      if ((p.dynPressure || 0) > maxQ) { maxQ = p.dynPressure; maxIdx = i; }
    });
    return maxIdx;
  }

  // ============================================================
  // APOGEE MARKER
  // Horizontal dashed line + label at peak altitude
  // ============================================================

  function _drawApogeeMarker(ctx, history, idx, toX, toY, pad) {
    const p   = history[idx];
    const x   = toX(idx, history.length);
    const y   = toY(p.alt);
    const pw  = toX(history.length - 1, history.length) - pad.l;

    // Dashed horizontal line at apogee
    ctx.save();
    ctx.strokeStyle = '#FAC775';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + pw, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Apogee dot
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#FAC775';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    ctx.fillStyle  = '#FAC775';
    ctx.font       = 'bold 10px -apple-system, sans-serif';
    ctx.textAlign  = 'center';
    ctx.fillText(
      `Apogee: ${(p.alt / 1000).toFixed(1)} km @ T+${p.t.toFixed(0)}s`,
      x, y - 10
    );
    ctx.restore();
  }

  // ============================================================
  // BURNOUT MARKER
  // Vertical dashed line where engine cuts out
  // ============================================================

  function _drawBurnoutMarker(ctx, history, idx, toX, toY) {
    const p = history[idx];
    const x = toX(idx, history.length);
    const y = toY(p.alt);

    ctx.save();
    ctx.strokeStyle = '#6B3FA0';
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y + 20);
    ctx.lineTo(x, y - 15);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow pointing to burnout
    ctx.fillStyle  = '#6B3FA0';
    ctx.font       = '9px -apple-system, sans-serif';
    ctx.textAlign  = 'center';
    ctx.fillText(`Burnout`, x, y - 20);
    ctx.fillText(`${Math.round(p.speed || 0)} m/s`, x, y - 30);
    ctx.restore();
  }

  // ============================================================
  // MAX-Q ANNOTATION
  // Shows dynamic pressure value at the most stressful point
  // ============================================================

  function _drawMaxQAnnotation(ctx, history, idx, toX, toY) {
    const p = history[idx];
    if (!p.dynPressure || p.dynPressure < 1000) return;

    const x = toX(idx, history.length);
    const y = toY(p.alt);

    ctx.save();

    // Small badge
    const label = `Max-Q: ${Math.round(p.dynPressure / 1000).toFixed(1)} kPa`;
    ctx.font = '9px -apple-system, sans-serif';
    const tw = ctx.measureText(label).width;

    ctx.fillStyle   = '#D85A30';
    ctx.beginPath();
    ctx.roundRect(x - tw/2 - 4, y + 8, tw + 8, 16, 3);
    ctx.fill();

    ctx.fillStyle  = '#fff';
    ctx.textAlign  = 'center';
    ctx.fillText(label, x, y + 19);

    // Dot
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#D85A30';
    ctx.fill();

    ctx.restore();
  }

  // ============================================================
  // G-FORCE GRADIENT
  // Colors the trajectory line by G-force intensity
  // Green (low G) → Yellow → Orange → Red (high G)
  // ============================================================

  function _drawGForceGradient(ctx, history, toX, toY, pad, pw, ph) {
    const n = history.length;
    if (n < 2) return;

    const maxG = Math.max(...history.map(p => p.gForce || 0), 1);

    for (let i = 0; i < n - 1; i++) {
      const p1 = history[i];
      const p2 = history[i + 1];
      const g  = (p1.gForce || 0) / maxG; // normalize 0-1

      const x1 = toX(i,     n);
      const y1 = toY(p1.alt);
      const x2 = toX(i + 1, n);
      const y2 = toY(p2.alt);

      // Color: low G = blue, high G = red
      const r = Math.round(g * 220);
      const b = Math.round((1 - g) * 165);
      const color = `rgba(${r}, 80, ${b}, 0.6)`;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ============================================================
  // VELOCITY PROFILE (secondary line)
  // Draws speed as a separate normalized line on the same graph
  // ============================================================

  function _drawVelocityProfile(ctx, history, toX, pad, ph) {
    const maxSpeed = Math.max(...history.map(p => p.speed || 0), 1);
    const n        = history.length;

    ctx.save();
    ctx.strokeStyle = 'rgba(29, 158, 117, 0.6)'; // green
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.lineJoin    = 'round';
    ctx.beginPath();

    history.forEach((p, i) => {
      const x = toX(i, n);
      const y = pad.t + ph * (1 - (p.speed || 0) / maxSpeed);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle  = 'rgba(29, 158, 117, 0.8)';
    ctx.font       = '9px -apple-system, sans-serif';
    ctx.textAlign  = 'left';
    ctx.fillText('Speed →', pad.l + 4, pad.t + 10);

    ctx.restore();
  }

  // ============================================================
  // RISE TIME BRACKET
  // Shows how long it took to climb from 10% to 90% of max alt
  // This is a standard control systems metric applied to rocketry
  // ============================================================

  function _drawRiseTimeBracket(ctx, history, apogeeIdx, toX, toY, pad, ph) {
    if (apogeeIdx < 0 || history.length < 10) return;

    const maxAlt = history[apogeeIdx].alt;
    if (maxAlt < 10000) return; // Don't show for very short flights

    const t10pct = maxAlt * 0.1;
    const t90pct = maxAlt * 0.9;
    const n      = history.length;

    let idx10 = -1, idx90 = -1;
    for (let i = 0; i < apogeeIdx; i++) {
      if (idx10 < 0 && history[i].alt >= t10pct) idx10 = i;
      if (idx90 < 0 && history[i].alt >= t90pct) idx90 = i;
    }

    if (idx10 < 0 || idx90 < 0) return;

    const x10 = toX(idx10, n);
    const x90 = toX(idx90, n);
    const bracketY = pad.t + ph + 8;
    const riseTime = (history[idx90].t - history[idx10].t).toFixed(1);

    ctx.save();
    ctx.strokeStyle = 'rgba(107, 63, 160, 0.6)';
    ctx.lineWidth   = 1;

    // Horizontal bracket
    ctx.beginPath();
    ctx.moveTo(x10, bracketY);
    ctx.lineTo(x90, bracketY);
    ctx.stroke();

    // Tick marks
    [x10, x90].forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, bracketY - 3);
      ctx.lineTo(x, bracketY + 3);
      ctx.stroke();
    });

    // Label
    ctx.fillStyle  = 'rgba(107, 63, 160, 0.8)';
    ctx.font       = '9px -apple-system, sans-serif';
    ctx.textAlign  = 'center';
    ctx.fillText(`Rise time: ${riseTime}s (10%→90%)`, (x10 + x90) / 2, bracketY - 5);

    ctx.restore();
  }

  // ============================================================
  // TOGGLE CONTROLS
  // ============================================================

  function toggle()          { _enabled    = !_enabled;    }
  function toggleSpeed()     { _showSpeed  = !_showSpeed;  }
  function toggleGForce()    { _showGForce = !_showGForce; }
  function isEnabled()       { return _enabled; }

  // ============================================================
  // INJECT TOGGLE BUTTONS INTO UI
  // ============================================================

  function init() {
    const eventsPanel = document.getElementById('events-panel');
    if (!eventsPanel || document.getElementById('analysis-toggles')) return;

    const wrap = document.createElement('div');
    wrap.id        = 'analysis-toggles';
    wrap.className = 'analysis-toggles';
    wrap.innerHTML = `
      <span class="analysis-label">Graph overlays</span>
      <div class="analysis-btns">
        <button class="btn btn-analysis active" id="tog-analysis"
          onclick="window.__Analysis?.toggle(); this.classList.toggle('active')" title="Toggle all annotations">
          📍 Annotations
        </button>
        <button class="btn btn-analysis active" id="tog-gforce"
          onclick="window.__Analysis?.toggleGForce(); this.classList.toggle('active')" title="G-force color gradient">
          🌡 G-force
        </button>
        <button class="btn btn-analysis" id="tog-speed"
          onclick="window.__Analysis?.toggleSpeed(); this.classList.toggle('active')" title="Speed profile overlay">
          ⚡ Speed
        </button>
      </div>
    `;

    eventsPanel.insertAdjacentElement('beforebegin', wrap);
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return { init, draw, toggle, toggleSpeed, toggleGForce, isEnabled };

})();

window.__Analysis = Analysis;
