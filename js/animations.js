/**
 * animations.js — Telemetry Animations & Visual Effects
 * Day 7: Makes the UI feel alive during flight.
 *
 * This file adds:
 *   1. Telemetry card flash animations when values change significantly
 *   2. Animated mission event badge entrance (slide + fade in)
 *   3. G-force color coding (green → yellow → orange → red)
 *   4. Fuel bar that drains visually as fuel depletes
 *   5. Max-Q warning pulse when approaching structural limit
 *   6. Mach number display alongside velocity
 *   7. Status bar color transitions
 *   8. Altitude milestone celebrations (50km, 100km, 200km)
 *
 * HOW IT WORKS:
 * This file exports window.__Anim which ui.js calls on every tick.
 * It reads the current and previous rocket state and applies
 * CSS class changes / style updates to make the UI reactive.
 */

const Animations = (() => {

  // ---- Previous state (for detecting changes) ----
  let _prev = {
    altitude:    0,
    speed:       0,
    gForce:      0,
    dynPressure: 0,
    fuelPct:     100,
    status:      'READY',
  };

  // ---- Milestone altitudes already celebrated ----
  const _milestones = new Set();

  // ---- Flash timeout handles (to cancel previous flashes) ----
  const _flashTimers = {};

  // ============================================================
  // TELEMETRY CARD FLASH
  // Briefly highlights a card when its value changes significantly
  // ============================================================

  /**
   * Flash a telemetry card to draw attention to a changing value.
   * @param {string} elementId - The telem-card element containing the value
   * @param {string} type      - 'up', 'down', or 'alert'
   */
  function flashCard(elementId, type = 'up') {
    const el = document.getElementById(elementId);
    if (!el) return;

    // Find the parent telem-card
    const card = el.closest('.telem-card') || el;

    // Cancel any existing flash
    if (_flashTimers[elementId]) {
      clearTimeout(_flashTimers[elementId]);
      card.classList.remove('flash-up', 'flash-down', 'flash-alert');
    }

    // Apply flash class
    const cls = type === 'alert' ? 'flash-alert'
               : type === 'down' ? 'flash-down'
               : 'flash-up';
    card.classList.add(cls);

    // Remove after animation completes
    _flashTimers[elementId] = setTimeout(() => {
      card.classList.remove(cls);
    }, 600);
  }

  // ============================================================
  // G-FORCE COLOR CODING
  // Green (safe) → Yellow (moderate) → Orange (high) → Red (danger)
  // Real astronauts experience ~3G at max-Q, ~4G at engine cutoff
  // ============================================================

  function updateGForceColor(gForce) {
    const el = document.getElementById('t-g');
    if (!el) return;

    let color;
    if      (gForce < 2)  color = '';              // Default — safe
    else if (gForce < 4)  color = '#854F0B';       // Orange — moderate
    else if (gForce < 6)  color = '#D85A30';       // Red-orange — high
    else                  color = '#A32D2D';        // Red — danger

    el.style.color = color;
    el.style.fontWeight = gForce > 4 ? '700' : '600';
  }

  // ============================================================
  // DYNAMIC PRESSURE WARNING
  // Pulses the Dyn-Q card when approaching structural limits
  // Max-Q for real rockets is usually 20,000–30,000 Pa
  // Our structural failure threshold is 80,000 Pa
  // ============================================================

  function updateDynPressureWarning(dynPressure) {
    const el = document.getElementById('t-q');
    const card = el?.closest('.telem-card');
    if (!card) return;

    if (dynPressure > 60000) {
      card.classList.add('warning-pulse');
      el.style.color = '#A32D2D';
    } else if (dynPressure > 30000) {
      card.classList.remove('warning-pulse');
      el.style.color = '#D85A30';
    } else {
      card.classList.remove('warning-pulse');
      el.style.color = '';
    }
  }

  // ============================================================
  // MACH NUMBER
  // Show Mach number alongside velocity
  // Speed of sound varies with altitude but we use ~343 m/s
  // ============================================================

  function updateMachDisplay(speed, altitude) {
    const el = document.getElementById('t-vel');
    if (!el) return;

    // Speed of sound decreases with altitude (roughly)
    const soundSpeed = altitude < 11000
      ? 343 - 0.004 * altitude   // decreases in troposphere
      : 295;                      // roughly constant in stratosphere

    const mach = speed / soundSpeed;

    if (mach >= 0.5) {
      el.textContent = Math.round(speed) + ' m/s  (Mach ' + mach.toFixed(2) + ')';
    } else {
      el.textContent = Math.round(speed) + ' m/s';
    }
  }

  // ============================================================
  // FUEL BAR
  // Visual fuel depletion indicator inside the fuel card
  // ============================================================

  function updateFuelBar(fuelPct) {
    let bar = document.getElementById('fuel-bar');

    // Create bar if it doesn't exist yet
    if (!bar) {
      const card = document.getElementById('t-fuel')?.closest('.telem-card');
      if (!card) return;

      bar = document.createElement('div');
      bar.id = 'fuel-bar';
      bar.style.cssText = `
        height: 3px;
        border-radius: 2px;
        margin-top: 6px;
        transition: width 0.3s ease, background-color 0.3s ease;
        width: 100%;
      `;
      card.appendChild(bar);
    }

    // Color: green → yellow → orange → red as fuel depletes
    const color = fuelPct > 50 ? '#3B6D11'
                : fuelPct > 25 ? '#854F0B'
                : fuelPct > 10 ? '#D85A30'
                : '#A32D2D';

    bar.style.width           = fuelPct + '%';
    bar.style.backgroundColor = color;
  }

  // ============================================================
  // ALTITUDE MILESTONES
  // Show a brief celebration when hitting key altitudes
  // ============================================================

  const MILESTONES = [
    { alt: 10000,  label: '10 km — Troposphere exit'    },
    { alt: 50000,  label: '50 km — Stratosphere'        },
    { alt: 100000, label: '100 km — Space! 🚀'          },
    { alt: 200000, label: '200 km — LEO altitude ⭐'    },
  ];

  function checkMilestones(altitude, statusBar) {
    MILESTONES.forEach(ms => {
      if (!_milestones.has(ms.alt) && altitude >= ms.alt) {
        _milestones.add(ms.alt);
        _showMilestone(ms.label, statusBar);
      }
    });
  }

  function _showMilestone(label, statusBar) {
    if (!statusBar) return;
    const prev = statusBar.textContent;
    const prevClass = statusBar.className;

    statusBar.textContent = '🎯 Milestone: ' + label;
    statusBar.className = 'status-bar success';

    setTimeout(() => {
      // Restore previous status after 2.5 seconds
      statusBar.textContent = prev;
      statusBar.className = prevClass;
    }, 2500);
  }

  // ============================================================
  // MISSION EVENT BADGE ANIMATION
  // Badges slide in from the left when a new event fires
  // ============================================================

  // Track how many badges we've already animated
  let _animatedBadges = 0;

  function animateNewBadges() {
    const badges = document.querySelectorAll('.event-badge');
    badges.forEach((badge, i) => {
      if (i >= _animatedBadges) {
        // New badge — animate it in
        badge.style.opacity   = '0';
        badge.style.transform = 'translateX(-8px)';
        badge.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        // Trigger animation on next frame
        requestAnimationFrame(() => {
          setTimeout(() => {
            badge.style.opacity   = '1';
            badge.style.transform = 'translateX(0)';
          }, 50 * (i - _animatedBadges)); // Stagger multiple badges
        });
      }
    });
    _animatedBadges = badges.length;
  }

  // ============================================================
  // STATUS BAR TRANSITIONS
  // Smooth color transition when mission status changes
  // ============================================================

  function updateStatusBar(status, statusBar) {
    if (!statusBar) return;
    if (status === _prev.status) return;

    // Add transition style
    statusBar.style.transition = 'background-color 0.4s ease, border-color 0.4s ease';
  }

  // ============================================================
  // MAIN UPDATE FUNCTION
  // Called every frame from ui.js onSimTick
  // ============================================================

  /**
   * @param {object} rocket     - Current rocket state from simulation.js
   * @param {Element} statusBar - The status bar DOM element
   */
  function update(rocket, statusBar) {
    if (!rocket) return;

    const {
      altitude    = 0,
      speed       = 0,
      gForce      = 0,
      dynPressure = 0,
      status      = 'READY',
    } = rocket;

    // Calculate fuel percentage
    const fuelPct = rocket.fuelMass != null && rocket._initFuel
      ? Math.max(0, Math.round((rocket.fuelMass / rocket._initFuel) * 100))
      : (rocket.fuelPct || 0);

    // ---- G-force color ----
    updateGForceColor(gForce);

    // ---- Dynamic pressure warning ----
    updateDynPressureWarning(dynPressure);

    // ---- Mach number ----
    updateMachDisplay(speed, altitude);

    // ---- Fuel bar ----
    // fuelPct is updated by ui.js — we just sync the bar
    const fuelEl = document.getElementById('t-fuel');
    if (fuelEl) {
      const pct = parseInt(fuelEl.textContent) || 0;
      updateFuelBar(pct);
    }

    // ---- Altitude milestones ----
    checkMilestones(altitude, statusBar);

    // ---- Flash cards on significant changes ----
    if (Math.abs(altitude - _prev.altitude) > 5000) {
      flashCard('t-alt', 'up');
    }
    if (Math.abs(speed - _prev.speed) > 200) {
      flashCard('t-vel', 'up');
    }
    if (gForce > 4 && _prev.gForce <= 4) {
      flashCard('t-g', 'alert');
    }
    if (dynPressure > 30000 && _prev.dynPressure <= 30000) {
      flashCard('t-q', 'alert');
    }

    // ---- Status bar transition ----
    updateStatusBar(status, statusBar);

    // ---- Animate any new event badges ----
    animateNewBadges();

    // ---- Save previous state ----
    _prev = { altitude, speed, gForce, dynPressure, status };
  }

  // ============================================================
  // RESET
  // Called when simulation resets
  // ============================================================

  function reset() {
    _prev = { altitude: 0, speed: 0, gForce: 0, dynPressure: 0, status: 'READY' };
    _milestones.clear();
    _animatedBadges = 0;

    // Remove fuel bar
    const bar = document.getElementById('fuel-bar');
    if (bar) bar.remove();

    // Reset G-force color
    const gEl = document.getElementById('t-g');
    if (gEl) { gEl.style.color = ''; gEl.style.fontWeight = ''; }

    // Reset Q color
    const qEl = document.getElementById('t-q');
    const qCard = qEl?.closest('.telem-card');
    if (qCard) qCard.classList.remove('warning-pulse');
    if (qEl) qEl.style.color = '';

    // Reset velocity to plain text
    const vEl = document.getElementById('t-vel');
    if (vEl) vEl.textContent = '0 m/s';
  }

  return { update, reset, flashCard, animateNewBadges };

})();

window.__Anim = Animations;
