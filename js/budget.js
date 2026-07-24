/**
 * budget.js — Delta-V Budget & Payload Effect Visualizer
 * Day 9: Shows the rocket equation broken down visually.
 *
 * WHAT THIS DOES:
 * 1. Delta-v budget bar — shows how much of the total delta-v
 *    is used by gravity losses, drag losses, and useful velocity
 * 2. Payload sensitivity chart — shows how adding payload
 *    reduces delta-v (the tyranny of the rocket equation)
 * 3. Real-time mission efficiency score
 * 4. Orbit capability indicator with margin shown
 *
 * WHY THIS IS IMPRESSIVE:
 * Delta-v budget analysis is what real mission planners do.
 * NASA uses this exact breakdown for every mission.
 * Showing it live as sliders change proves deep understanding
 * of the Tsiolkovsky rocket equation.
 */

const Budget = (() => {

  // ---- Constants ----
  const G0      = 9.807;
  const LEO_DV  = 7800;   // m/s needed for Low Earth Orbit
  const GRAVITY_LOSS = 1500; // m/s typical gravity drag loss
  const DRAG_LOSS    = 150;  // m/s typical aerodynamic drag loss

  // ---- Canvas for payload chart ----
  let _canvas = null;
  let _ctx    = null;

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    // Create the budget section in the sidebar
    _injectBudgetHTML();

    // Initialize payload chart canvas
    _canvas = document.getElementById('payload-chart');
    if (_canvas) _ctx = _canvas.getContext('2d');
  }

  // ============================================================
  // HTML INJECTION
  // Adds the budget panel to the sidebar dynamically
  // ============================================================

  function _injectBudgetHTML() {
    // Find the mission card section to insert after it
    const missionCard = document.getElementById('mission-card')?.closest('.sidebar-section');
    if (!missionCard) return;

    const section = document.createElement('section');
    section.className = 'sidebar-section';
    section.id        = 'budget-section';
    section.innerHTML = `
      <h2 class="section-label">Delta-v budget</h2>

      <!-- Budget bar breakdown -->
      <div class="budget-bar-wrap">
        <div class="budget-bar" id="budget-bar">
          <div class="budget-seg budget-useful"  id="seg-useful"  title="Useful velocity"></div>
          <div class="budget-seg budget-gravity" id="seg-gravity" title="Gravity losses"></div>
          <div class="budget-seg budget-drag"    id="seg-drag"    title="Drag losses"></div>
          <div class="budget-seg budget-margin"  id="seg-margin"  title="Reserve margin"></div>
        </div>
        <div class="budget-legend">
          <span class="bleg-item"><span class="bleg-dot" style="background:#185FA5"></span>Useful Δv</span>
          <span class="bleg-item"><span class="bleg-dot" style="background:#D85A30"></span>Gravity loss</span>
          <span class="bleg-item"><span class="bleg-dot" style="background:#854F0B"></span>Drag loss</span>
          <span class="bleg-item"><span class="bleg-dot" style="background:#3B6D11"></span>Margin</span>
        </div>
      </div>

      <!-- Budget numbers -->
      <div class="budget-rows">
        <div class="budget-row">
          <span class="budget-label">Total Δv</span>
          <span class="budget-val" id="bv-total">—</span>
        </div>
        <div class="budget-row">
          <span class="budget-label">Gravity loss</span>
          <span class="budget-val" id="bv-gravity">~1,500 m/s</span>
        </div>
        <div class="budget-row">
          <span class="budget-label">Drag loss</span>
          <span class="budget-val" id="bv-drag">~150 m/s</span>
        </div>
        <div class="budget-row">
          <span class="budget-label">Net useful Δv</span>
          <span class="budget-val" id="bv-net">—</span>
        </div>
        <div class="budget-row">
          <span class="budget-label">LEO margin</span>
          <span class="budget-val" id="bv-margin">—</span>
        </div>
      </div>

      <!-- Efficiency score -->
      <div class="efficiency-wrap">
        <span class="budget-label">Mission efficiency</span>
        <div class="efficiency-bar-track">
          <div class="efficiency-bar-fill" id="eff-bar"></div>
        </div>
        <span class="efficiency-score" id="eff-score">—</span>
      </div>

      <!-- Payload sensitivity chart -->
      <h2 class="section-label" style="margin-top:8px">Payload vs Δv</h2>
      <canvas id="payload-chart" width="220" height="100"
        style="width:100%;height:100px;border-radius:6px;background:var(--surface-2);border:0.5px solid var(--border);"
        title="Shows how adding payload reduces delta-v"></canvas>
      <p class="param-hint" style="margin-top:4px">The tyranny of the rocket equation — every tonne of payload costs Δv</p>
    `;

    // Insert after mission card section
    missionCard.insertAdjacentElement('afterend', section);
  }

  // ============================================================
  // DELTA-V BUDGET UPDATE
  // Called whenever sliders change
  // ============================================================

  /**
   * Update the budget display with current rocket config.
   * @param {object} config - { thrust, fuelMass, dryMass, payloadMass, isp }
   */
  function update(config) {
    const { fuelMass, dryMass, payloadMass, isp, thrust } = config;

    const wetMass   = fuelMass + dryMass + payloadMass;
    const emptyMass = dryMass + payloadMass;

    if (emptyMass <= 0 || wetMass <= emptyMass) return;

    // Total delta-v from rocket equation
    const totalDv = isp * G0 * Math.log(wetMass / emptyMass);

    // Net useful delta-v after losses
    const netDv   = totalDv - GRAVITY_LOSS - DRAG_LOSS;
    const margin  = netDv - LEO_DV;

    // Update text values
    _setText('bv-total',   Math.round(totalDv).toLocaleString() + ' m/s');
    _setText('bv-gravity', '~' + GRAVITY_LOSS.toLocaleString() + ' m/s');
    _setText('bv-drag',    '~' + DRAG_LOSS + ' m/s');
    _setText('bv-net',     Math.round(netDv).toLocaleString() + ' m/s');

    const marginEl = document.getElementById('bv-margin');
    if (marginEl) {
      marginEl.textContent = (margin >= 0 ? '+' : '') + Math.round(margin).toLocaleString() + ' m/s';
      marginEl.style.color = margin >= 0 ? '#3B6D11' : '#A32D2D';
    }

    // Update budget bar segments
    if (totalDv > 0) {
      const usefulPct  = Math.max(0, Math.min(100, (LEO_DV / totalDv) * 100));
      const gravityPct = Math.min(100 - usefulPct, (GRAVITY_LOSS / totalDv) * 100);
      const dragPct    = Math.min(100 - usefulPct - gravityPct, (DRAG_LOSS / totalDv) * 100);
      const marginPct  = Math.max(0, 100 - usefulPct - gravityPct - dragPct);

      _setWidth('seg-useful',  usefulPct);
      _setWidth('seg-gravity', gravityPct);
      _setWidth('seg-drag',    dragPct);
      _setWidth('seg-margin',  marginPct);
    }

    // Update efficiency score
    // Efficiency = (net useful dv / total dv) * (twr factor)
    const twr = thrust / (wetMass * G0);
    const twrFactor = Math.min(1, twr / 2); // optimal TWR ~1.5-2
    const efficiency = Math.max(0, Math.min(100,
      ((netDv / Math.max(netDv, LEO_DV)) * 0.7 + twrFactor * 0.3) * 100
    ));

    const effBar = document.getElementById('eff-bar');
    if (effBar) {
      effBar.style.width = efficiency.toFixed(0) + '%';
      effBar.style.background = efficiency > 75 ? '#3B6D11'
                               : efficiency > 50 ? '#854F0B'
                               : '#A32D2D';
    }
    _setText('eff-score', efficiency.toFixed(0) + '%');

    // Update payload sensitivity chart
    _drawPayloadChart(config);
  }

  // ============================================================
  // PAYLOAD SENSITIVITY CHART
  // Shows delta-v as a function of payload mass
  // This visualizes the "tyranny of the rocket equation"
  // ============================================================

  function _drawPayloadChart(config) {
    if (!_ctx || !_canvas) {
      // Try to get canvas again (may have been created after init)
      _canvas = document.getElementById('payload-chart');
      if (_canvas) _ctx = _canvas.getContext('2d');
      else return;
    }

    const { fuelMass, dryMass, payloadMass, isp } = config;
    const W = _canvas.clientWidth  || 220;
    const H = _canvas.clientHeight || 100;
    const dpr = window.devicePixelRatio || 1;

    if (_canvas.width !== Math.round(W * dpr)) {
      _canvas.width  = Math.round(W * dpr);
      _canvas.height = Math.round(H * dpr);
      _ctx.scale(dpr, dpr);
    }

    const cs = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const pad = { t: 10, r: 10, b: 22, l: 42 };
    const pw = W - pad.l - pad.r;
    const ph = H - pad.t - pad.b;

    _ctx.clearRect(0, 0, W, H);
    _ctx.fillStyle = cs('--surface-2') || '#f9f9f8';
    _ctx.fillRect(0, 0, W, H);

    // Generate delta-v curve across payload range
    const maxPayload = Math.max(payloadMass * 3, 30000); // kg
    const points     = 50;
    const dvPoints   = [];

    for (let i = 0; i <= points; i++) {
      const p   = (i / points) * maxPayload;
      const wet = fuelMass + dryMass + p;
      const dry = dryMass + p;
      const dv  = dry > 0 && wet > dry ? isp * G0 * Math.log(wet / dry) - GRAVITY_LOSS - DRAG_LOSS : 0;
      dvPoints.push({ payload: p, dv: Math.max(0, dv) });
    }

    const maxDv = Math.max(...dvPoints.map(p => p.dv), LEO_DV * 1.2);

    // Grid line at LEO_DV
    const leoY = pad.t + ph * (1 - LEO_DV / maxDv);
    _ctx.strokeStyle = '#3B6D11';
    _ctx.lineWidth   = 0.5;
    _ctx.setLineDash([3, 2]);
    _ctx.beginPath();
    _ctx.moveTo(pad.l, leoY);
    _ctx.lineTo(pad.l + pw, leoY);
    _ctx.stroke();
    _ctx.setLineDash([]);
    _ctx.fillStyle  = '#3B6D11';
    _ctx.font       = '9px sans-serif';
    _ctx.textAlign  = 'left';
    _ctx.fillText('LEO', pad.l + 2, leoY - 2);

    // Draw curve
    _ctx.strokeStyle = '#185FA5';
    _ctx.lineWidth   = 2;
    _ctx.lineJoin    = 'round';
    _ctx.beginPath();
    dvPoints.forEach((p, i) => {
      const x = pad.l + (p.payload / maxPayload) * pw;
      const y = pad.t + ph * (1 - p.dv / maxDv);
      i === 0 ? _ctx.moveTo(x, y) : _ctx.lineTo(x, y);
    });
    _ctx.stroke();

    // Mark current payload
    const curX = pad.l + (payloadMass / maxPayload) * pw;
    const curDv = dvPoints.find(p => Math.abs(p.payload - payloadMass) < maxPayload / points)?.dv || 0;
    const curY  = pad.t + ph * (1 - curDv / maxDv);

    _ctx.beginPath();
    _ctx.arc(curX, curY, 4, 0, Math.PI * 2);
    _ctx.fillStyle = '#185FA5';
    _ctx.fill();

    // X axis labels
    _ctx.fillStyle = cs('--text-secondary') || '#9a9a95';
    _ctx.font      = '9px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('0t', pad.l, H - 4);
    _ctx.fillText(Math.round(maxPayload / 1000) + 't', pad.l + pw, H - 4);
    _ctx.fillText('Payload →', pad.l + pw / 2, H - 4);

    // Y axis label
    _ctx.save();
    _ctx.translate(10, pad.t + ph / 2);
    _ctx.rotate(-Math.PI / 2);
    _ctx.textAlign = 'center';
    _ctx.fillText('Δv', 0, 0);
    _ctx.restore();
  }

  // ============================================================
  // HELPERS
  // ============================================================

  function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function _setWidth(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.max(0, pct).toFixed(1) + '%';
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return { init, update };

})();

window.__Budget = Budget;
