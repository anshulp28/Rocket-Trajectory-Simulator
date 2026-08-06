cat > /home/claude/rocket-day18/telemetry.js << 'ENDOFFILE'
/**
 * telemetry.js — Real-Time Telemetry Dashboard
 * Day 18: Live mini-graphs for G-force, speed, and dynamic pressure.
 *
 * WHAT IT DRAWS:
 * Three small sparkline graphs below the telemetry cards showing
 * how each metric changed over the course of the flight.
 * Updates every animation frame — exactly like real mission control.
 *
 * WHY THIS IS IMPRESSIVE:
 * Real rocket telemetry systems (SpaceX, NASA) display exactly
 * these metrics in real time. This shows you understand what
 * engineers actually monitor during a launch.
 *
 * METRICS TRACKED:
 * 1. G-force — peaks during max thrust, watch for structural limits
 * 2. Speed (m/s) — shows acceleration profile and burnout point
 * 3. Dynamic pressure — the famous Max-Q curve engineers worry about
 */

const Telemetry = (() => {

  // ---- Canvases ----
  let _canvases = {};
  let _ctxs     = {};

  // ---- Data buffers (rolling window of last N points) ----
  const MAX_POINTS = 200;
  let _data = {
    gForce:      [],
    speed:       [],
    dynPressure: [],
    time:        [],
  };

  // ---- Color config per metric ----
  const METRICS = {
    gForce:      { label: 'G-Force',     unit: 'G',   color: '#D85A30', max: 10  },
    speed:       { label: 'Speed',       unit: 'm/s', color: '#185FA5', max: 8000 },
    dynPressure: { label: 'Dyn-Q',       unit: 'kPa', color: '#854F0B', max: 80  },
  };

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    _injectTelemetryPanel();
    Object.keys(METRICS).forEach(key => {
      const canvas = document.getElementById(`telem-graph-${key}`);
      if (canvas) {
        _canvases[key] = canvas;
        _ctxs[key]     = canvas.getContext('2d');
      }
    });
  }

  function _injectTelemetryPanel() {
    const telemGrid = document.querySelector('.telemetry-grid');
    if (!telemGrid || document.getElementById('telemetry-graphs')) return;

    const panel = document.createElement('div');
    panel.id        = 'telemetry-graphs';
    panel.className = 'telemetry-graphs';

    panel.innerHTML = Object.entries(METRICS).map(([key, cfg]) => `
      <div class="telem-graph-card">
        <div class="telem-graph-header">
          <span class="telem-graph-label" style="color:${cfg.color}">${cfg.label}</span>
          <span class="telem-graph-val" id="tgv-${key}">0 ${cfg.unit}</span>
        </div>
        <canvas id="telem-graph-${key}" class="telem-graph-canvas"
          width="200" height="50"></canvas>
      </div>
    `).join('');

    telemGrid.insertAdjacentElement('afterend', panel);
  }

  // ============================================================
  // DATA UPDATE
  // Called every simulation tick with new rocket state
  // ============================================================

  function update(rocket) {
    if (!rocket || rocket.status === 'READY') return;

    // Push new data points
    _data.time.push(rocket.time || 0);
    _data.gForce.push(rocket.gForce || 0);
    _data.speed.push(rocket.speed || 0);
    _data.dynPressure.push((rocket.dynPressure || 0) / 1000); // Pa → kPa

    // Keep rolling window
    if (_data.time.length > MAX_POINTS) {
      _data.time.shift();
      _data.gForce.shift();
      _data.speed.shift();
      _data.dynPressure.shift();
    }

    // Update live value labels
    _setText('tgv-gForce',      (rocket.gForce || 0).toFixed(1) + ' G');
    _setText('tgv-speed',       Math.round(rocket.speed || 0) + ' m/s');
    _setText('tgv-dynPressure', ((rocket.dynPressure || 0) / 1000).toFixed(1) + ' kPa');

    // Redraw all graphs
    Object.keys(METRICS).forEach(key => _drawGraph(key));
  }

  // ============================================================
  // GRAPH DRAWING
  // Sparkline style — clean, minimal, real-time
  // ============================================================

  function _drawGraph(key) {
    const canvas = _canvases[key];
    const ctx    = _ctxs[key];
    if (!canvas || !ctx) return;

    const W   = canvas.clientWidth  || 200;
    const H   = canvas.clientHeight || 50;
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== Math.round(W * dpr)) {
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.scale(dpr, dpr);
    }

    const cfg  = METRICS[key];
    const data = _data[key];
    if (!data || data.length < 2) return;

    const cs = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

    // Clear
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = cs('--surface-2') || '#f9f9f8';
    ctx.fillRect(0, 0, W, H);

    // Find data range
    const maxVal = Math.max(...data, cfg.max * 0.1);
    const scale  = cfg.max > 0 ? cfg.max : maxVal * 1.2;

    const toX = i  => (i / (data.length - 1)) * W;
    const toY = v  => H - (Math.max(0, v) / scale) * H * 0.85 - 4;

    // Gradient fill under line
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,   cfg.color + '40');
    grad.addColorStop(1,   cfg.color + '00');

    ctx.beginPath();
    data.forEach((v, i) => {
      const x = toX(i), y = toY(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(toX(data.length - 1), H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Main line
    ctx.beginPath();
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    data.forEach((v, i) => {
      const x = toX(i), y = toY(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Current value dot
    const lastX = toX(data.length - 1);
    const lastY = toY(data[data.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = cfg.color;
    ctx.fill();

    // Max line (warn if near limit)
    if (key === 'gForce' || key === 'dynPressure') {
      const limitY = toY(cfg.max * 0.8);
      ctx.strokeStyle = cfg.color + '40';
      ctx.lineWidth   = 0.5;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(0, limitY);
      ctx.lineTo(W, limitY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Time axis label
    if (_data.time.length > 0) {
      const t = _data.time[_data.time.length - 1];
      ctx.fillStyle  = cs('--text-muted') || '#9a9a95';
      ctx.font       = '8px sans-serif';
      ctx.textAlign  = 'right';
      ctx.fillText('T+' + t.toFixed(0) + 's', W - 2, H - 2);
    }
  }

  // ============================================================
  // RESET
  // ============================================================

  function reset() {
    _data = { gForce: [], speed: [], dynPressure: [], time: [] };
    _setText('tgv-gForce',      '0 G');
    _setText('tgv-speed',       '0 m/s');
    _setText('tgv-dynPressure', '0 kPa');
    Object.keys(METRICS).forEach(key => {
      const ctx = _ctxs[key];
      const canvas = _canvases[key];
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================

  function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return { init, update, reset };

})();

window.__Telemetry = Telemetry;
ENDOFFILE
echo "telemetry.js done: $(wc -l < /home/claude/rocket-day18/telemetry.js) lines"
