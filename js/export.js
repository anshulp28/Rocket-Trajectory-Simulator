/**
 * export.js — Trajectory Export & Shareable URL
 * Day 10: Export flight data and share rocket configs via URL.
 *
 * FEATURES:
 * 1. Export trajectory as CSV — download the full flight data
 *    as a spreadsheet (time, altitude, velocity, G-force, etc.)
 *    Real aerospace engineers do this exact thing with telemetry.
 *
 * 2. Shareable URL — encode rocket config into the URL so you
 *    can share a specific rocket design with anyone.
 *    Example: ?thrust=7607&fuel=411&dry=25&payload=13&isp=282
 *
 * 3. Mission summary card — shown after landing/orbit with
 *    key stats: max altitude, max velocity, max G, burn time.
 *
 * WHY THIS IS IMPRESSIVE FOR YOUR APPLICATION:
 * Export functionality shows you understand data pipelines.
 * URL encoding shows you understand web architecture.
 * Both are used in real aerospace telemetry systems.
 */

const Export = (() => {

  // ============================================================
  // CSV EXPORT
  // Downloads flight history as a .csv file
  // ============================================================

  /**
   * Export the simulation history as a CSV file.
   * @param {Array}  history - Flight history from simulation.js
   * @param {object} config  - Rocket configuration used
   */
  function exportCSV(history, config) {
    if (!history || history.length === 0) {
      _showMessage('No flight data to export — launch the rocket first.', 'warning');
      return;
    }

    // Build CSV header
    const header = [
      'Time (s)',
      'Altitude (m)',
      'Altitude (km)',
      'Vertical Velocity (m/s)',
      'Horizontal Velocity (m/s)',
      'Speed (m/s)',
      'G-Force',
      'Dynamic Pressure (Pa)',
      'Burnout',
      'Status'
    ].join(',');

    // Build CSV rows
    const rows = history.map(p => [
      p.t.toFixed(2),
      p.alt.toFixed(1),
      (p.alt / 1000).toFixed(3),
      (p.velV || 0).toFixed(2),
      (p.velH || 0).toFixed(2),
      (p.speed || 0).toFixed(2),
      (p.gForce || 0).toFixed(3),
      (p.dynPressure || 0).toFixed(1),
      p.burnout ? 'YES' : 'NO',
      p.status || ''
    ].join(','));

    // Add metadata header at top
    const meta = [
      `# Rocket Trajectory Simulator — Flight Data Export`,
      `# Generated: ${new Date().toISOString()}`,
      `# Rocket config: Thrust=${config?.thrust || ''}N, Fuel=${config?.fuelMass || ''}kg, Isp=${config?.isp || ''}s`,
      `# Max altitude: ${(Math.max(...history.map(p => p.alt)) / 1000).toFixed(1)} km`,
      `# Max speed: ${Math.round(Math.max(...history.map(p => p.speed || 0)))} m/s`,
      `# Total flight time: ${history[history.length - 1].t.toFixed(1)} s`,
      `#`,
    ].join('\n');

    const csv = meta + '\n' + header + '\n' + rows.join('\n');

    // Trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `rocket-trajectory-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    _showMessage(`✅ Exported ${history.length} data points as CSV`, 'success');
  }

  // ============================================================
  // URL ENCODING
  // Encodes rocket config into the URL query string
  // So configs can be shared as links
  // ============================================================

  /**
   * Encode current rocket config into the browser URL.
   * @param {object} config - Rocket parameters
   */
  function encodeToURL(config) {
    const params = new URLSearchParams({
      thrust:  Math.round((config.thrust  || 0) / 1000), // kN
      fuel:    Math.round((config.fuelMass || 0) / 1000), // tonnes
      dry:     Math.round((config.dryMass  || 0) / 1000),
      payload: Math.round((config.payloadMass || 0) / 1000),
      isp:     Math.round(config.isp || 0),
    });

    const newURL = window.location.pathname + '?' + params.toString();
    window.history.replaceState({}, '', newURL);

    // Copy to clipboard
    navigator.clipboard?.writeText(window.location.href).then(() => {
      _showMessage('🔗 Shareable link copied to clipboard!', 'success');
    }).catch(() => {
      _showMessage('🔗 URL updated — copy from address bar to share', 'success');
    });
  }

  /**
   * Read rocket config from URL query params on page load.
   * Returns null if no params found.
   * @returns {object|null}
   */
  function decodeFromURL() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('thrust')) return null;

    return {
      thrust:      parseFloat(params.get('thrust'))  * 1000 || null,
      fuelMass:    parseFloat(params.get('fuel'))    * 1000 || null,
      dryMass:     parseFloat(params.get('dry'))     * 1000 || null,
      payloadMass: parseFloat(params.get('payload')) * 1000 || null,
      isp:         parseFloat(params.get('isp'))            || null,
    };
  }

  // ============================================================
  // MISSION SUMMARY
  // Shown after landing or orbit achieved
  // ============================================================

  /**
   * Show a mission summary overlay after the flight ends.
   * @param {object} rocket  - Final rocket state
   * @param {Array}  history - Full flight history
   * @param {Array}  events  - Mission events log
   */
  function showMissionSummary(rocket, history, events) {
    if (!history || history.length === 0) return;

    // Calculate summary stats
    const maxAlt   = Math.max(...history.map(p => p.alt));
    const maxSpeed = Math.max(...history.map(p => p.speed || 0));
    const maxG     = Math.max(...history.map(p => p.gForce || 0));
    const maxQ     = Math.max(...history.map(p => p.dynPressure || 0));
    const duration = history[history.length - 1].t;

    const outcome = rocket.failed  ? { label: 'Mission Failed',     icon: '💥', cls: 'danger'  }
                  : rocket.orbited ? { label: 'Orbit Achieved',      icon: '⭐', cls: 'success' }
                  : rocket.landed  ? { label: 'Suborbital Flight',   icon: '🌍', cls: 'warning' }
                  :                  { label: 'Mission Complete',     icon: '✅', cls: ''        };

    // Remove existing summary
    document.getElementById('mission-summary')?.remove();

    // Build summary panel
    const panel = document.createElement('div');
    panel.id        = 'mission-summary';
    panel.className = `mission-summary ${outcome.cls}`;
    panel.innerHTML = `
      <div class="summary-header">
        <span class="summary-icon">${outcome.icon}</span>
        <span class="summary-title">${outcome.label}</span>
        <button class="summary-close" onclick="document.getElementById('mission-summary')?.remove()" title="Close">×</button>
      </div>
      <div class="summary-grid">
        <div class="summary-stat">
          <span class="summary-label">Max altitude</span>
          <span class="summary-val">${(maxAlt / 1000).toFixed(1)} km</span>
        </div>
        <div class="summary-stat">
          <span class="summary-label">Max velocity</span>
          <span class="summary-val">${Math.round(maxSpeed)} m/s</span>
        </div>
        <div class="summary-stat">
          <span class="summary-label">Max G-force</span>
          <span class="summary-val">${maxG.toFixed(1)} G</span>
        </div>
        <div class="summary-stat">
          <span class="summary-label">Max-Q</span>
          <span class="summary-val">${Math.round(maxQ).toLocaleString()} Pa</span>
        </div>
        <div class="summary-stat">
          <span class="summary-label">Flight time</span>
          <span class="summary-val">${duration.toFixed(1)} s</span>
        </div>
        <div class="summary-stat">
          <span class="summary-label">Events</span>
          <span class="summary-val">${events.length}</span>
        </div>
      </div>
      <div class="summary-actions">
        <button class="btn btn-summary-export" onclick="window.__Export?.exportCSV(window.SIM?.history, window.SIM)">
          ⬇ Export CSV
        </button>
        <button class="btn btn-summary-share" onclick="window.__Export?.encodeToURL(window.SIM)">
          🔗 Share config
        </button>
      </div>
    `;

    // Insert above the status bar
    const statusBar = document.getElementById('status-bar');
    statusBar?.insertAdjacentElement('beforebegin', panel);

    // Animate in
    requestAnimationFrame(() => {
      panel.style.opacity   = '0';
      panel.style.transform = 'translateY(-8px)';
      panel.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      requestAnimationFrame(() => {
        panel.style.opacity   = '1';
        panel.style.transform = 'translateY(0)';
      });
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================

  function _showMessage(text, type = 'info') {
    const bar = document.getElementById('status-bar');
    if (!bar) return;
    const prev = bar.textContent, prevCls = bar.className;
    bar.textContent = text;
    bar.className   = 'status-bar ' + (type === 'success' ? 'success' : type === 'warning' ? 'warning' : '');
    setTimeout(() => { bar.textContent = prev; bar.className = prevCls; }, 3000);
  }

  // ============================================================
  // INITIALIZATION
  // Injects export buttons into the UI and reads URL params
  // ============================================================

  function init() {
    _injectExportButtons();

    // Load config from URL if present
    const urlConfig = decodeFromURL();
    if (urlConfig && urlConfig.thrust) {
      // Will be picked up by ui.js after DOM ready
      window.__urlConfig = urlConfig;
    }
  }

  function _injectExportButtons() {
    // Add export buttons to the events panel
    const eventsPanel = document.getElementById('events-panel');
    if (!eventsPanel) return;

    const btnWrap = document.createElement('div');
    btnWrap.className = 'export-btns';
    btnWrap.innerHTML = `
      <button class="btn btn-export" onclick="window.__Export?.exportCSV(window.SIM?.history, window.SIM)" title="Download flight data as CSV">
        ⬇ Export CSV
      </button>
      <button class="btn btn-export" onclick="window.__Export?.encodeToURL(window.SIM)" title="Copy shareable link to clipboard">
        🔗 Share
      </button>
    `;
    eventsPanel.appendChild(btnWrap);
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return { init, exportCSV, encodeToURL, decodeFromURL, showMissionSummary };

})();

window.__Export = Export;
