/**
 * effects.js — Stage Separation & Disturbance Effects
 * Day 8: Visual stage separation animation + disturbance injection.
 *
 * STAGE SEPARATION:
 * Real rockets drop their first stage when fuel runs out to
 * shed dead weight. This file detects engine burnout and
 * triggers a visual separation effect on the canvas.
 *
 * DISTURBANCE INJECTION:
 * Simulates a sudden external force — wind gust, engine anomaly,
 * or atmospheric turbulence. Kicks the rocket's velocity and
 * shows a visual warning flash.
 *
 * HOW IT WORKS:
 * - Hooks into the simulation tick via window.__Effects
 * - Draws separation effects directly on the trajectory canvas
 * - Exposes injectDisturbance() for the UI button
 */

const Effects = (() => {

  // ---- State ----
  let _separationTriggered = false;
  let _separationAlt       = 0;
  let _separationTime      = 0;
  let _separationParticles = [];
  let _disturbanceFlash    = 0; // frames remaining for flash

  // ---- Canvas context (set on init) ----
  let _canvas = null;
  let _ctx    = null;

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init(canvasId) {
    _canvas = document.getElementById(canvasId);
    if (_canvas) _ctx = _canvas.getContext('2d');
  }

  // ============================================================
  // STAGE SEPARATION
  // Triggered once when engine burns out (fuelMass reaches 0)
  // ============================================================

  /**
   * Check if stage separation should trigger this tick.
   * @param {object} rocket - Current rocket state
   * @param {Array}  history - Flight history array
   */
  function checkStageSeparation(rocket, history) {
    // Trigger once when burnout detected
    if (!_separationTriggered && rocket.burnout && history.length > 0) {
      _separationTriggered = true;
      _separationAlt       = rocket.altitude;
      _separationTime      = rocket.time;

      // Generate particles for separation animation
      _separationParticles = _generateParticles(20);

      // Show separation notification
      _showSeparationNotification(rocket.altitude, rocket.speed);

      // Add event badge
      _addEventBadge('STAGE_SEP', rocket.altitude, rocket.time);

      console.log(`[Stage Sep] Triggered at ${(rocket.altitude/1000).toFixed(1)}km, t=${rocket.time.toFixed(1)}s`);
    }

    // Animate particles (decay over time)
    if (_separationTriggered && _separationParticles.length > 0) {
      _separationParticles = _separationParticles
        .map(p => ({ ...p, life: p.life - 1, y: p.y + p.vy, x: p.x + p.vx, alpha: p.life / p.maxLife }))
        .filter(p => p.life > 0);
    }
  }

  // ============================================================
  // PARTICLE SYSTEM
  // Small glowing dots that burst outward on stage separation
  // ============================================================

  function _generateParticles(count) {
    return Array.from({ length: count }, () => ({
      x:       0,            // relative to separation point on canvas
      y:       0,
      vx:      (Math.random() - 0.5) * 6,
      vy:      (Math.random() - 0.5) * 6 + 2, // slight downward bias (falling stage)
      life:    30 + Math.floor(Math.random() * 30),
      maxLife: 60,
      size:    1 + Math.random() * 3,
      color:   Math.random() > 0.5 ? '#D85A30' : '#FAC775', // orange or yellow
      alpha:   1,
    }));
  }

  /**
   * Draw separation particles on the canvas.
   * Called from chart.js draw cycle.
   *
   * @param {number} sepX - Canvas X of separation point
   * @param {number} sepY - Canvas Y of separation point
   */
  function drawSeparationParticles(sepX, sepY) {
    if (!_ctx || _separationParticles.length === 0) return;

    _separationParticles.forEach(p => {
      _ctx.save();
      _ctx.globalAlpha = p.alpha * 0.8;
      _ctx.fillStyle   = p.color;
      _ctx.beginPath();
      _ctx.arc(sepX + p.x, sepY + p.y, p.size, 0, Math.PI * 2);
      _ctx.fill();
      _ctx.restore();
    });
  }

  /**
   * Draw stage separation marker line on the trajectory graph.
   * A small horizontal dashed line at the burnout altitude.
   *
   * @param {function} altToY  - Coordinate converter from chart.js
   * @param {number}   pw      - Plot width in pixels
   * @param {number}   padLeft - Left padding in pixels
   * @param {number}   maxAlt  - Max display altitude
   */
  function drawSeparationMarker(altToY, pw, padLeft, maxAlt) {
    if (!_ctx || !_separationTriggered || _separationAlt <= 0) return;

    const y = altToY(_separationAlt, maxAlt);

    // Dashed separator line
    _ctx.save();
    _ctx.strokeStyle = '#6B3FA0';
    _ctx.lineWidth   = 1;
    _ctx.setLineDash([3, 3]);
    _ctx.globalAlpha = 0.6;
    _ctx.beginPath();
    _ctx.moveTo(padLeft, y);
    _ctx.lineTo(padLeft + pw, y);
    _ctx.stroke();
    _ctx.setLineDash([]);
    _ctx.restore();

    // Label
    _ctx.save();
    _ctx.fillStyle  = '#6B3FA0';
    _ctx.font       = '10px -apple-system, sans-serif';
    _ctx.textAlign  = 'left';
    _ctx.globalAlpha = 0.8;
    _ctx.fillText('Stage sep — ' + (_separationAlt / 1000).toFixed(1) + ' km', padLeft + 4, y - 4);
    _ctx.restore();
  }

  // ============================================================
  // SEPARATION NOTIFICATION
  // Brief status bar message when stage separates
  // ============================================================

  function _showSeparationNotification(altitude, speed) {
    const bar = document.getElementById('status-bar');
    if (!bar) return;

    const prev      = bar.textContent;
    const prevClass = bar.className;

    bar.textContent = `🔥 Stage separation at ${(altitude/1000).toFixed(1)} km — coasting at ${Math.round(speed)} m/s`;
    bar.className   = 'status-bar warning';

    setTimeout(() => {
      bar.textContent = prev;
      bar.className   = prevClass;
    }, 3000);
  }

  // ============================================================
  // EVENT BADGE HELPER
  // Adds a stage separation badge to the events panel
  // ============================================================

  function _addEventBadge(type, altitude, time) {
    const list = document.getElementById('events-list');
    if (!list) return;

    // Remove empty state placeholder
    const empty = list.querySelector('.event-empty');
    if (empty) empty.remove();

    const badge = document.createElement('span');
    badge.className = 'event-badge burnout'; // reuse burnout style (purple)
    badge.style.opacity   = '0';
    badge.style.transform = 'translateX(-8px)';
    badge.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

    badge.innerHTML = `🔥 Stage Sep &nbsp;<small>${(altitude/1000).toFixed(0)}km · T+${time.toFixed(0)}s</small>`;
    list.appendChild(badge);

    // Animate in
    requestAnimationFrame(() => {
      setTimeout(() => {
        badge.style.opacity   = '1';
        badge.style.transform = 'translateX(0)';
      }, 50);
    });
  }

  // ============================================================
  // DISTURBANCE INJECTION
  // Simulates a sudden external force on the rocket
  // ============================================================

  /**
   * Inject a disturbance — kicks the rocket's vertical velocity.
   * @param {string} type - 'wind_gust' | 'engine_anomaly' | 'turbulence'
   */
  function injectDisturbance(type = 'wind_gust') {
    const SIM = window.__Sim?.state || window.SIM;
    if (!SIM || !SIM.running) {
      _showDisturbanceError();
      return;
    }

    const magnitudes = {
      wind_gust:      -80,   // sudden downward force
      engine_anomaly: -150,  // bigger velocity loss
      turbulence:     (Math.random() - 0.5) * 120, // random direction
    };

    const delta = magnitudes[type] || -80;

    // Apply to simulation state
    if (window.SIM) {
      window.SIM.velV += delta;
    }

    // Visual flash
    _disturbanceFlash = 10;
    _flashDisturbance(type, delta);

    console.log(`[Disturbance] ${type} applied: ${delta > 0 ? '+' : ''}${delta.toFixed(0)} m/s`);
  }

  function _flashDisturbance(type, delta) {
    const bar = document.getElementById('status-bar');
    if (!bar) return;

    const prev      = bar.textContent;
    const prevClass = bar.className;

    const labels = {
      wind_gust:      '💨 Wind gust',
      engine_anomaly: '⚠️ Engine anomaly',
      turbulence:     '〰️ Turbulence',
    };

    bar.textContent = `${labels[type] || '⚠️ Disturbance'} — velocity change: ${delta > 0 ? '+' : ''}${delta.toFixed(0)} m/s`;
    bar.className   = 'status-bar danger';

    // Flash the velocity card
    const velEl = document.getElementById('t-vel');
    const velCard = velEl?.closest('.telem-card');
    if (velCard) {
      velCard.style.transition = 'background 0.1s ease';
      velCard.style.background = '#FCEBEB';
      setTimeout(() => { velCard.style.background = ''; }, 400);
    }

    setTimeout(() => {
      bar.textContent = prev;
      bar.className   = prevClass;
    }, 2500);
  }

  function _showDisturbanceError() {
    const bar = document.getElementById('status-bar');
    if (!bar) return;
    const prev = bar.textContent, prevClass = bar.className;
    bar.textContent = '⚠️ Launch the rocket first before injecting a disturbance.';
    bar.className   = 'status-bar warning';
    setTimeout(() => { bar.textContent = prev; bar.className = prevClass; }, 2000);
  }

  // ============================================================
  // RESET
  // ============================================================

  function reset() {
    _separationTriggered = false;
    _separationAlt       = 0;
    _separationTime      = 0;
    _separationParticles = [];
    _disturbanceFlash    = 0;
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return {
    init,
    checkStageSeparation,
    drawSeparationParticles,
    drawSeparationMarker,
    injectDisturbance,
    reset,
    get separationTriggered() { return _separationTriggered; },
    get separationAlt()       { return _separationAlt; },
    get particles()           { return _separationParticles; },
  };

})();

window.__Effects = Effects;
