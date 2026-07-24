/**
 * ui.js — UI Controller
 * Day 6: Wires every button, slider, and display to the simulation.
 *
 * This file is the glue between the user and the physics engine.
 * It reads user input → passes it to simulation.js → reads output
 * → updates the display. No physics math lives here.
 *
 * RESPONSIBILITIES:
 *   - Initialize everything on page load
 *   - Handle all button clicks and slider changes
 *   - Update all stat displays every frame
 *   - Receive simulation callbacks and update the UI
 *   - Handle dark mode toggle
 *   - Keyboard shortcuts
 */

// ============================================================
// UI NAMESPACE
// All UI functions live under the UI object.
// HTML calls these as UI.toggleLaunch(), UI.onSlider(), etc.
// ============================================================

const UI = (() => {

  // ---- Cached DOM elements ----
  // Grabbed once on init, reused every frame (faster than getElementById each time)
  let els = {};

  // ---- State ----
  let isDark       = false;
  let isLaunched   = false;
  let isPaused     = false;
  let initialFuel  = 0; // Stored at launch to calculate fuel % remaining

  // ---- Mission event display config ----
  const EVENT_DISPLAY = {
    LAUNCH:             { label: '🚀 Launch',        cls: 'orbit'   },
    MACH_1:             { label: '💨 Mach 1',        cls: 'mach1'   },
    MAX_Q:              { label: '⚠️ Max-Q',          cls: 'maxq'    },
    KARMAN_LINE:        { label: '🌌 Entered space',  cls: 'karman'  },
    ENGINE_CUTOFF:      { label: '🔴 Engine cutoff',  cls: 'burnout' },
    ORBIT_ACHIEVED:     { label: '🛸 Orbit achieved', cls: 'orbit'   },
    STRUCTURAL_FAILURE: { label: '💥 Structural fail',cls: 'failure' },
    LANDED:             { label: '🏁 Mission end',    cls: 'burnout' },
  };

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    // Cache all DOM elements
    els = {
      // Sliders
      slThrust:  document.getElementById('sl-thrust'),
      slFuel:    document.getElementById('sl-fuel'),
      slDry:     document.getElementById('sl-dry'),
      slPayload: document.getElementById('sl-payload'),
      slIsp:     document.getElementById('sl-isp'),
      slSpeed:   document.getElementById('sl-speed'),

      // Slider value displays
      vThrust:   document.getElementById('v-thrust'),
      vFuel:     document.getElementById('v-fuel'),
      vDry:      document.getElementById('v-dry'),
      vPayload:  document.getElementById('v-payload'),
      vIsp:      document.getElementById('v-isp'),
      vSpeed:    document.getElementById('v-speed'),

      // Mission card
      mcDv:      document.getElementById('mc-dv'),
      mcTwr:     document.getElementById('mc-twr'),
      mcBurn:    document.getElementById('mc-burn'),
      mcRatio:   document.getElementById('mc-ratio'),
      mcStatus:  document.getElementById('mc-status'),
      missionCard: document.getElementById('mission-card'),

      // Launch buttons
      btnLaunch: document.getElementById('btn-launch'),
      btnPause:  document.getElementById('btn-pause'),
      btnReset:  document.getElementById('btn-reset'),
      btnDark:   document.getElementById('btn-dark'),

      // Telemetry displays
      tAlt:      document.getElementById('t-alt'),
      tVel:      document.getElementById('t-vel'),
      tG:        document.getElementById('t-g'),
      tFuel:     document.getElementById('t-fuel'),
      tQ:        document.getElementById('t-q'),
      tTime:     document.getElementById('t-time'),

      // Status and events
      statusBar:  document.getElementById('status-bar'),
      eventsList: document.getElementById('events-list'),
    };

    // Set up keyboard shortcuts
    document.addEventListener('keydown', _handleKeyboard);

    // Initialize chart
    window.__Chart.init('graph-canvas');
    window.__Effects?.init('graph-canvas');
    window.__Budget?.init();

    // Load default preset (Falcon 9)
    selectPreset('falcon9');

    // Update mission card immediately
    onSlider();

    console.log('✅ UI initialized');
  }

  // ============================================================
  // PRESET SELECTION
  // ============================================================

  function selectPreset(name) {
    const preset = window.ROCKET_PRESETS[name];
    if (!preset) return;

    // Update slider values
    els.slThrust.value  = preset.thrust  / 1000; // N → kN
    els.slFuel.value    = preset.fuelMass / 1000; // kg → t
    els.slDry.value     = preset.dryMass  / 1000;
    els.slPayload.value = preset.payloadMass / 1000;
    els.slIsp.value     = preset.isp;

    // Highlight active preset button
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === name);
    });

    // Update all displays
    onSlider();

    // Reset simulation with new config
    if (!isLaunched) {
      _initSim();
    }
  }

  // ============================================================
  // SLIDER HANDLING
  // Called every time any slider moves
  // ============================================================

  function onSlider() {
    const c = _getConfig();

    // Update value displays with formatting
    els.vThrust.textContent  = Number(els.slThrust.value).toLocaleString();
    els.vFuel.textContent    = Number(els.slFuel.value).toLocaleString();
    els.vDry.textContent     = Number(els.slDry.value).toLocaleString();
    els.vPayload.textContent = Number(els.slPayload.value).toLocaleString();
    els.vIsp.textContent     = els.slIsp.value;

    // Update mission card calculations
    _updateMissionCard(c);

    // Redraw empty chart with new reference lines
    if (!isLaunched) {
      window.__Chart.drawEmpty();
    }
  }

  function onSpeedSlider() {
    const speed = parseInt(els.slSpeed.value);
    els.vSpeed.textContent = speed + '×';
    window.setSimSpeed(speed);
  }

  // ============================================================
  // LAUNCH / PAUSE / RESET
  // ============================================================

  function toggleLaunch() {
    if (isLaunched) {
      // Abort mission
      _stopSim();
      return;
    }

    // Validate before launch
    const c = _getConfig();
    const twr = c.thrust / (c.tot * window.PHYSICS.G0);
    if (twr < 1.0) {
      _setStatus(
        `Cannot launch — TWR is ${twr.toFixed(2)} (must be > 1.0). ` +
        `Increase thrust or reduce mass.`,
        'danger'
      );
      return;
    }

    // Initialize and start
    _initSim();
    initialFuel = c.fuelMass;

    window.startSimulation();
    isLaunched = true;
    isPaused   = false;

    // Update button states
    els.btnLaunch.textContent = 'Abort ✕';
    els.btnLaunch.classList.add('abort');
    els.btnPause.disabled = false;

    // Clear events list
    els.eventsList.innerHTML = '';

    _setStatus('Powered flight — engines ignited. Monitoring trajectory.', 'info');
  }

  function togglePause() {
    if (!isLaunched) return;
    isPaused = window.pauseSimulation();
    els.btnPause.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
  }

  function reset() {
    _stopSim();
    window.__Chart.drawEmpty();
    _resetTelemetry();
    els.eventsList.innerHTML =
      '<span class="event-empty">No events yet — launch the rocket</span>';
    _setStatus(
      'Configure your rocket and press <strong>Launch</strong> to begin the simulation.',
      'info'
    );
  }

  // ============================================================
  // SIMULATION CALLBACKS
  // Called by simulation.js every tick and on mission end
  // ============================================================

  // Called every animation frame during flight
  window.onSimTick = function(rocket, history, events) {
    // Update telemetry displays
    _updateTelemetry(rocket);

    // Run animations
    if (window.__Anim) window.__Anim.update(rocket, els.statusBar);
    if (window.__Effects) window.__Effects.checkStageSeparation(rocket, history);

    // Update chart
    window.__Chart.draw(history, events, rocket);

    // Update status bar
    _updateStatusFromRocket(rocket);

    // Update event badges (only when new events arrive)
    _syncEventBadges(events);
  };

  // Called when mission ends
  window.onMissionEnd = function(rocket, events) {
    isLaunched = false;
    els.btnLaunch.textContent = 'Launch 🚀';
    els.btnLaunch.classList.remove('abort');
    els.btnPause.disabled = true;
    els.btnPause.textContent = '⏸ Pause';

    // Final status message
    if (rocket.structuralFailure) {
      _setStatus(
        `💥 Structural failure at ${(rocket.altitude / 1000).toFixed(1)} km — ` +
        `dynamic pressure exceeded structural limits at Max-Q. ` +
        `Try reducing thrust through the lower atmosphere.`,
        'danger'
      );
    } else if (rocket.inOrbit) {
      _setStatus(
        `🛸 Orbit achieved! Reached ${(rocket.altitude / 1000).toFixed(0)} km ` +
        `at ${Math.round(rocket.speed)} m/s. Mission success.`,
        'success'
      );
    } else {
      _setStatus(
        `🏁 Mission complete — max altitude ${(rocket.maxAltitude / 1000).toFixed(1)} km. ` +
        `Increase fuel mass or Isp to go higher.`,
        'warning'
      );
    }

    // Final chart draw
    window.__Chart.draw(
      window.__Sim.state.history,
      events,
      rocket
    );
  };

  // Called if launch is blocked (e.g. TWR < 1)
  window.onLaunchBlocked = function(reason) {
    _setStatus(reason, 'danger');
  };

  // Called on reset
  window.onSimReset = function(rocket) {
    if (window.__Anim) window.__Anim.reset();
    if (window.__Effects) window.__Effects.reset();
    _resetTelemetry();
  };

  // ============================================================
  // DARK MODE
  // ============================================================

  function toggleDark() {
    isDark = !isDark;
    document.body.classList.toggle('dark', isDark);
    els.btnDark.textContent = isDark ? '☀️' : '🌙';

    // Redraw chart with new colors
    if (isLaunched) {
      window.__Chart.draw(
        window.__Sim.state.history,
        window.__Sim.state.events,
        window.__Sim.state.rocket
      );
    } else {
      window.__Chart.drawEmpty();
    }
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  function _getConfig() {
    const thrust     = parseFloat(els.slThrust.value)  * 1000; // kN → N
    const fuelMass   = parseFloat(els.slFuel.value)    * 1000; // t  → kg
    const dryMass    = parseFloat(els.slDry.value)     * 1000;
    const payloadMass = parseFloat(els.slPayload.value) * 1000;
    const isp        = parseFloat(els.slIsp.value);
    const tot        = fuelMass + dryMass + payloadMass;
    return { thrust, fuelMass, dryMass, payloadMass, isp, tot };
  }

  function _initSim() {
    const c = _getConfig();
    window.initSimulation({
      thrust:       c.thrust,
      fuelMass:     c.fuelMass,
      dryMass:      c.dryMass,
      payloadMass:  c.payloadMass,
      isp:          c.isp,
      dragCoeff:    0.3,
      diameter:     3.7,
    });
    window.setSimSpeed(parseInt(els.slSpeed.value));
  }

  function _stopSim() {
    cancelAnimationFrame(window.__Sim?.state?.animFrame);
    window.__Sim.state.running = false;
    isLaunched = false;
    isPaused   = false;
    els.btnLaunch.textContent = 'Launch 🚀';
    els.btnLaunch.classList.remove('abort');
    els.btnPause.disabled = true;
    els.btnPause.textContent = '⏸ Pause';
  }

  function _updateMissionCard(c) {
    if (window.__Budget) window.__Budget.update(c);
    const G0  = window.PHYSICS?.G0 || 9.807;
    const dv  = c.isp * G0 * Math.log(c.tot / (c.dryMass + c.payloadMass));
    const twr = c.thrust / (c.tot * G0);
    const burnTime = c.fuelMass / (c.thrust / (c.isp * G0));
    const massRatio = c.tot / (c.dryMass + c.payloadMass);
    const capable = dv >= 7800 && twr >= 1.0;
    const canLift = twr >= 1.0;

    els.mcDv.textContent    = Math.round(dv).toLocaleString() + ' m/s';
    els.mcTwr.textContent   = twr.toFixed(2);
    els.mcBurn.textContent  = Math.round(burnTime) + ' s';
    els.mcRatio.textContent = massRatio.toFixed(2);

    if (capable) {
      els.mcStatus.textContent = '✅ Orbit capable — TWR > 1.0';
      els.missionCard.className = 'mission-card capable';
    } else if (canLift) {
      els.mcStatus.textContent = `⚠️ Suborbital — needs ${Math.round(7800 - dv).toLocaleString()} more m/s`;
      els.missionCard.className = 'mission-card';
    } else {
      els.mcStatus.textContent = `❌ Cannot lift off — TWR ${twr.toFixed(2)} < 1.0`;
      els.missionCard.className = 'mission-card incapable';
    }
  }

  function _updateTelemetry(rocket) {
    els.tAlt.textContent  = (rocket.altitude / 1000).toFixed(1) + ' km';
    els.tVel.textContent  = Math.round(rocket.speed) + ' m/s';
    els.tG.textContent    = (rocket.gForce || 0).toFixed(1) + ' G';
    els.tQ.textContent    = Math.round(rocket.dynPressure || 0).toLocaleString() + ' Pa';
    els.tTime.textContent = 'T+' + Math.round(rocket.time) + 's';

    // Fuel percentage
    const fuelPct = initialFuel > 0
      ? Math.max(0, Math.round((rocket.fuelMass / initialFuel) * 100))
      : 0;
    els.tFuel.textContent = fuelPct + '%';

    // Color code G-force (red if getting dangerous)
    els.tG.style.color = rocket.gForce > 6
      ? 'var(--red)'
      : rocket.gForce > 4
      ? 'var(--orange)'
      : '';
  }

  function _updateStatusFromRocket(rocket) {
    if (rocket.status === 'POWERED_FLIGHT') {
      const mach = (rocket.speed / 343).toFixed(2);
      _setStatus(
        `Powered flight · ${(rocket.altitude / 1000).toFixed(1)} km · ` +
        `${Math.round(rocket.speed)} m/s (Mach ${mach}) · ` +
        `${(rocket.gForce || 0).toFixed(1)}G`,
        'info'
      );
    } else if (rocket.status === 'COASTING') {
      _setStatus(
        `Engine burnout — coasting at ${(rocket.altitude / 1000).toFixed(1)} km, ` +
        `${Math.round(rocket.speed)} m/s. Apogee approaching.`,
        'info'
      );
    }
  }

  function _syncEventBadges(events) {
    const existing = els.eventsList.querySelectorAll('.event-badge').length;
    if (events.length === existing) return; // Nothing new

    // Rebuild event list
    if (events.length === 0) {
      els.eventsList.innerHTML =
        '<span class="event-empty">No events yet — launch the rocket</span>';
      return;
    }

    els.eventsList.innerHTML = '';
    events.forEach(event => {
      const cfg = EVENT_DISPLAY[event.type];
      if (!cfg) return;
      const badge = document.createElement('span');
      badge.className = `event-badge ${cfg.cls}`;
      badge.title = `t=${event.time.toFixed(1)}s · alt=${(event.altitude / 1000).toFixed(1)}km`;
      badge.textContent = cfg.label;
      els.eventsList.appendChild(badge);
    });
  }

  function _setStatus(html, type = 'info') {
    els.statusBar.innerHTML = html;
    els.statusBar.className = 'status-bar';
    if (type === 'success') els.statusBar.classList.add('success');
    if (type === 'danger')  els.statusBar.classList.add('danger');
    if (type === 'warning') els.statusBar.classList.add('warning');
  }

  function _resetTelemetry() {
    els.tAlt.textContent  = '0 km';
    els.tVel.textContent  = '0 m/s';
    els.tG.textContent    = '0.0 G';
    els.tFuel.textContent = '100%';
    els.tQ.textContent    = '0 Pa';
    els.tTime.textContent = 'T+0s';
    els.tG.style.color    = '';
  }

  function _handleKeyboard(e) {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (!isLaunched) toggleLaunch();
        else togglePause();
        break;
      case 'r':
      case 'R':
        reset();
        break;
      case 'd':
      case 'D':
        toggleDark();
        break;
    }
  }

  // ============================================================
  // START ON PAGE LOAD
  // ============================================================

  document.addEventListener('DOMContentLoaded', init);

  // ============================================================
  // PUBLIC API (called from HTML onclick attributes)
  // ============================================================

  return {
    selectPreset,
    onSlider,
    onSpeedSlider,
    toggleLaunch,
    togglePause,
    reset,
    toggleDark,
  };

})();

// Wire up dark mode button (HTML calls UI.toggleDark via onclick,
// but the header button uses id="btn-dark" directly)
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-dark')
    ?.addEventListener('click', () => UI.toggleDark());
});
