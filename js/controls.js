/**
 * controls.js — Keyboard Shortcuts & Comparison Mode
 * Day 11: Makes the simulator feel like a real engineering tool.
 *
 * KEYBOARD SHORTCUTS:
 *   Space       — Launch / Pause
 *   R           — Reset
 *   1-5         — Select preset (Falcon 9, Electron, Saturn V, Starship, Custom)
 *   W / ↑       — Increase sim speed
 *   S / ↓       — Decrease sim speed
 *   E           — Export CSV
 *   C           — Toggle comparison mode
 *   D           — Inject disturbance (wind gust)
 *   ?           — Show keyboard shortcut help
 *
 * COMPARISON MODE:
 * Run two rockets simultaneously and compare their trajectories
 * on the same graph in different colors. Shows how changing
 * one parameter (e.g. payload mass) affects the flight path.
 *
 * Real mission planners do this exact thing — "trade studies"
 * comparing different rocket configurations side by side.
 */

const Controls = (() => {

  // ---- State ----
  let _helpVisible    = false;
  let _compMode       = false;
  let _compHistory    = [];   // Second rocket's flight history
  let _compConfig     = null; // Second rocket's config snapshot
  let _compRunning    = false;
  let _compSim        = null; // Separate sim state for comparison rocket

  // ============================================================
  // KEYBOARD SHORTCUTS
  // ============================================================

  function initKeyboard() {
    document.addEventListener('keydown', _onKeyDown);
  }

  function _onKeyDown(e) {
    // Don't fire when typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {

      case ' ':
        e.preventDefault();
        // Space = launch if not running, pause if running
        document.getElementById('btn-launch')?.click();
        _flashShortcut('Space → Launch/Pause');
        break;

      case 'r':
      case 'R':
        document.getElementById('btn-reset')?.click();
        _flashShortcut('R → Reset');
        break;

      case '1':
        UI?.selectPreset('falcon9');
        _flashShortcut('1 → Falcon 9');
        break;

      case '2':
        UI?.selectPreset('electron');
        _flashShortcut('2 → Electron');
        break;

      case '3':
        UI?.selectPreset('saturn5');
        _flashShortcut('3 → Saturn V');
        break;

      case '4':
        UI?.selectPreset('starship');
        _flashShortcut('4 → Starship');
        break;

      case '5':
        UI?.selectPreset('custom');
        _flashShortcut('5 → Custom');
        break;

      case 'w':
      case 'W':
      case 'ArrowUp': {
        e.preventDefault();
        const sl = document.getElementById('sl-speed');
        if (sl) {
          sl.value = Math.min(8, parseInt(sl.value) + 1);
          UI?.onSpeedSlider();
          _flashShortcut('↑ → Speed ' + sl.value + '×');
        }
        break;
      }

      case 's':
      case 'S':
      case 'ArrowDown': {
        e.preventDefault();
        const sl = document.getElementById('sl-speed');
        if (sl) {
          sl.value = Math.max(1, parseInt(sl.value) - 1);
          UI?.onSpeedSlider();
          _flashShortcut('↓ → Speed ' + sl.value + '×');
        }
        break;
      }

      case 'e':
      case 'E':
        window.__Export?.exportCSV(window.SIM?.history, window.SIM);
        _flashShortcut('E → Export CSV');
        break;

      case 'd':
      case 'D':
        window.__Effects?.injectDisturbance('wind_gust');
        _flashShortcut('D → Wind gust injected');
        break;

      case 'c':
      case 'C':
        toggleComparisonMode();
        break;

      case '?':
        toggleHelp();
        break;

      case 'Escape':
        closeHelp();
        document.getElementById('mission-summary')?.remove();
        break;
    }
  }

  // ============================================================
  // SHORTCUT FLASH
  // Brief overlay showing which shortcut was pressed
  // ============================================================

  let _flashTimer = null;

  function _flashShortcut(label) {
    let el = document.getElementById('shortcut-flash');
    if (!el) {
      el = document.createElement('div');
      el.id = 'shortcut-flash';
      el.style.cssText = `
        position: fixed;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.75);
        color: #fff;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-family: -apple-system, sans-serif;
        pointer-events: none;
        z-index: 999;
        transition: opacity 0.2s ease;
      `;
      document.body.appendChild(el);
    }

    el.textContent = label;
    el.style.opacity = '1';

    clearTimeout(_flashTimer);
    _flashTimer = setTimeout(() => { el.style.opacity = '0'; }, 1200);
  }

  // ============================================================
  // HELP OVERLAY
  // Shows all keyboard shortcuts in a modal
  // ============================================================

  function toggleHelp() {
    _helpVisible ? closeHelp() : openHelp();
  }

  function openHelp() {
    _helpVisible = true;
    let overlay = document.getElementById('help-overlay');
    if (overlay) { overlay.style.display = 'flex'; return; }

    overlay = document.createElement('div');
    overlay.id = 'help-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
      font-family: -apple-system, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;min-width:320px;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="font-size:15px;font-weight:600;color:var(--text-primary);">⌨️ Keyboard Shortcuts</h2>
          <button onclick="window.__Controls?.closeHelp()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted);">×</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          ${[
            ['Space',   'Launch / Pause'],
            ['R',       'Reset'],
            ['1',       'Falcon 9'],
            ['2',       'Electron'],
            ['3',       'Saturn V'],
            ['4',       'Starship'],
            ['5',       'Custom'],
            ['W / ↑',   'Speed up'],
            ['S / ↓',   'Slow down'],
            ['E',       'Export CSV'],
            ['D',       'Wind gust'],
            ['C',       'Compare mode'],
            ['?',       'This help'],
            ['Esc',     'Close panels'],
          ].map(([key, desc]) => `
            <div style="display:flex;align-items:center;gap:8px;">
              <kbd style="background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:2px 7px;font-size:11px;font-family:monospace;color:var(--text-primary);white-space:nowrap;">${key}</kbd>
              <span style="font-size:12px;color:var(--text-secondary);">${desc}</span>
            </div>
          `).join('')}
        </div>
        <p style="margin-top:14px;font-size:11px;color:var(--text-muted);">Press <kbd style="background:var(--surface-2);border:1px solid var(--border);border-radius:3px;padding:1px 5px;font-family:monospace;">?</kbd> or <kbd style="background:var(--surface-2);border:1px solid var(--border);border-radius:3px;padding:1px 5px;font-family:monospace;">Esc</kbd> to close</p>
      </div>
    `;

    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeHelp();
    });

    document.body.appendChild(overlay);
  }

  function closeHelp() {
    _helpVisible = false;
    const overlay = document.getElementById('help-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  // ============================================================
  // COMPARISON MODE
  // Runs a second "ghost" rocket alongside the main one
  // and draws both trajectories on the same graph
  // ============================================================

  function toggleComparisonMode() {
    _compMode = !_compMode;

    const btn = document.getElementById('btn-compare');
    if (btn) {
      btn.textContent = _compMode ? '⊗ Exit compare' : '⊕ Compare';
      btn.style.background = _compMode ? 'var(--blue-light)' : '';
      btn.style.borderColor = _compMode ? 'var(--blue)' : '';
    }

    if (_compMode) {
      _flashShortcut('C → Comparison mode ON');
      _showComparisonPanel();
    } else {
      _flashShortcut('C → Comparison mode OFF');
      _hideComparisonPanel();
      _compHistory = [];
      _compConfig  = null;
    }
  }

  function _showComparisonPanel() {
    const content = document.querySelector('.content');
    if (!content || document.getElementById('comp-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'comp-panel';
    panel.className = 'comp-panel';
    panel.innerHTML = `
      <div class="comp-header">
        <span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;">Compare rocket B</span>
        <span class="comp-hint">Adjust sliders then click Fly B</span>
      </div>
      <div class="comp-controls">
        <div class="comp-stat">
          <span class="comp-label">Thrust (kN)</span>
          <input type="range" class="slider comp-slider" id="comp-thrust" min="100" max="80000" value="7607" step="100" oninput="Controls._updateCompCard()">
          <span class="comp-val" id="cv-thrust">7607</span>
        </div>
        <div class="comp-stat">
          <span class="comp-label">Fuel (t)</span>
          <input type="range" class="slider comp-slider" id="comp-fuel" min="5" max="4000" value="411" step="5" oninput="Controls._updateCompCard()">
          <span class="comp-val" id="cv-fuel">411</span>
        </div>
        <div class="comp-stat">
          <span class="comp-label">Isp (s)</span>
          <input type="range" class="slider comp-slider" id="comp-isp" min="180" max="460" value="282" step="1" oninput="Controls._updateCompCard()">
          <span class="comp-val" id="cv-isp">282</span>
        </div>
      </div>
      <div class="comp-dv" id="comp-dv-card">Δv: — m/s</div>
      <button class="btn btn-fly-b" id="btn-fly-b" onclick="window.__Controls?.flyCompRocket()">
        🚀 Fly Rocket B
      </button>
    `;

    // Insert before status bar
    const statusBar = document.getElementById('status-bar');
    statusBar?.insertAdjacentElement('beforebegin', panel);
  }

  function _hideComparisonPanel() {
    document.getElementById('comp-panel')?.remove();
  }

  function _updateCompCard() {
    const thrust  = parseFloat(document.getElementById('comp-thrust')?.value || 0) * 1000;
    const fuel    = parseFloat(document.getElementById('comp-fuel')?.value   || 0) * 1000;
    const isp     = parseFloat(document.getElementById('comp-isp')?.value    || 0);
    const dry     = 25600, pay = 13500; // use Falcon 9 defaults for B

    document.getElementById('cv-thrust').textContent = Math.round(thrust/1000);
    document.getElementById('cv-fuel').textContent   = Math.round(fuel/1000);
    document.getElementById('cv-isp').textContent    = isp;

    const wet = fuel + dry + pay;
    const dv  = wet > dry + pay ? Math.round(isp * 9.807 * Math.log(wet / (dry + pay))) : 0;
    const twr = (dry + pay + fuel) > 0 ? (thrust / ((dry + pay + fuel) * 9.807)).toFixed(2) : 0;

    const card = document.getElementById('comp-dv-card');
    if (card) {
      card.textContent = `Δv: ${dv.toLocaleString()} m/s · TWR: ${twr}`;
      card.style.color = dv > 7800 && twr > 1 ? '#3B6D11' : '#A32D2D';
    }
  }

  /**
   * Run the comparison rocket simulation.
   * Uses same physics as main sim but stores in _compHistory.
   */
  function flyCompRocket() {
    const thrust = parseFloat(document.getElementById('comp-thrust')?.value || 0) * 1000;
    const fuel   = parseFloat(document.getElementById('comp-fuel')?.value   || 0) * 1000;
    const isp    = parseFloat(document.getElementById('comp-isp')?.value    || 0);
    const dry    = 25600, pay = 13500;

    const G0 = 9.807, BIG_G = 6.674e-11, EM = 5.972e24, ER = 6371000, KL = 100000;

    function grav(a) { const r = ER + a; return (BIG_G * EM) / (r * r); }
    function dens(a) {
      if (a > KL) return 0;
      const T = a <= 11000 ? 288.15 - 0.0065 * a : 216.65;
      const P = a <= 11000 ? 101325 * Math.pow(T / 288.15, (G0 * 0.02897) / (8.314 * 0.0065))
                           : 22632 * Math.exp(-(G0 * 0.02897 * (a - 11000)) / (8.314 * 216.65));
      return P / (287 * T);
    }

    let alt = 0, vel = 0, mass = fuel + dry + pay, fuelLeft = fuel;
    const history = [];
    const dt = 0.5;
    let t = 0;

    // Run full simulation synchronously (fast because dt=0.5)
    while (t < 1200 && alt >= 0) {
      const fr = fuelLeft > 0 ? thrust / (isp * G0) : 0;
      fuelLeft = Math.max(0, fuelLeft - fr * dt);
      mass = dry + pay + fuelLeft;
      const thr = fuelLeft > 0 ? thrust : 0;
      const rho = dens(alt);
      const drag = 0.5 * rho * vel * vel * 0.3 * Math.PI * (1.85 ** 2);
      const g = grav(alt);
      const net = thr - mass * g - drag * (vel >= 0 ? 1 : -1);
      vel += (net / mass) * dt;
      alt = Math.max(0, alt + vel * dt);
      t += dt;

      history.push({ t, alt, speed: Math.abs(vel) });

      if (alt <= 0 && t > 5) break;
    }

    _compHistory = history;
    _compConfig  = { thrust, fuel, isp };

    // Flash
    _flashShortcut('🚀 Rocket B launched!');

    // Trigger chart redraw with comparison data
    if (window.__Chart && window.SIM?.history) {
      window.__Chart.draw(window.SIM.history, window.SIM.events || [], window.SIM, _compHistory);
    }
  }

  // ============================================================
  // COMPARISON BUTTON IN HEADER
  // ============================================================

  function _injectCompareButton() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight || document.getElementById('btn-compare')) return;

    const btn = document.createElement('button');
    btn.id        = 'btn-compare';
    btn.className = 'btn btn-ghost';
    btn.textContent = '⊕ Compare';
    btn.title     = 'Compare two rockets side by side (C)';
    btn.onclick   = () => toggleComparisonMode();

    // Insert before dark mode button
    const darkBtn = document.getElementById('btn-dark');
    darkBtn ? headerRight.insertBefore(btn, darkBtn) : headerRight.appendChild(btn);
  }

  // ============================================================
  // SHORTCUT HINT IN FOOTER
  // ============================================================

  function _injectShortcutHint() {
    const footer = document.querySelector('.footer p');
    if (!footer) return;
    footer.innerHTML += ' · <button onclick="window.__Controls?.toggleHelp()" style="background:none;border:none;cursor:pointer;color:var(--blue);font-size:11px;font-family:inherit;">⌨️ Keyboard shortcuts</button>';
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    initKeyboard();
    _injectCompareButton();
    _injectShortcutHint();
  }

  // Expose _updateCompCard for HTML inline handler
  return {
    init,
    toggleComparisonMode,
    flyCompRocket,
    toggleHelp,
    closeHelp,
    openHelp,
    getCompHistory: () => _compHistory,
    isCompMode:     () => _compMode,
    _updateCompCard,
  };

})();

window.__Controls = Controls;
// Also expose Controls globally so HTML onclick="Controls._updateCompCard()" works
window.Controls = Controls;
