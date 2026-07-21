/**
 * simulation.js — Rocket Simulation Loop
 * Day 3: Runs the physics engine tick by tick.
 *        Models fuel burn, gravity turn, and mission events.
 *
 * This file sits between physics.js (pure math) and the UI.
 * It owns the game loop, the rocket state, and mission tracking.
 *
 * GRAVITY TURN:
 * Real rockets don't fly straight up — they pitch over gradually
 * after launch to build horizontal velocity for orbit.
 * This is called a gravity turn. We model it as:
 *   - 0–10 km:   fly straight up (pitch = 0°)
 *   - 10–60 km:  pitch over gradually (0° → 90°)
 *   - 60 km+:    fly horizontal (pitch = 90°)
 *
 * WHY: Vertical velocity gets you out of the atmosphere.
 *      Horizontal velocity keeps you in orbit.
 *      Without the turn, you go up and come straight back down.
 */

// ============================================================
// ROCKET PRESETS
// Real-world rocket configurations used as starting points.
// All values sourced from public engineering databases.
// Thrust = TOTAL thrust of all engines combined.
// ============================================================

const ROCKET_PRESETS = {

  falcon9: {
    name:       'Falcon 9',
    company:    'SpaceX',
    thrust:     7_607_000,   // N  — 9x Merlin 1D engines at sea level
    fuelMass:   411_000,     // kg — RP-1 + LOX propellant (first stage)
    dryMass:    25_600,      // kg — empty first stage structure
    payloadMass: 13_500,     // kg — typical payload to LEO
    isp:        282,         // s  — sea level Isp of Merlin 1D
    diameter:   3.7,         // m  — fairing diameter
    dragCoeff:  0.3,
    description: 'The workhorse of commercial spaceflight. Two stages, reusable first stage.'
  },

  electron: {
    name:       'Electron',
    company:    'Rocket Lab',
    thrust:     192_000,     // N  — 9x Rutherford engines
    fuelMass:   9_000,       // kg — RP-1 + LOX
    dryMass:    950,         // kg
    payloadMass: 300,        // kg — small satellite launcher
    isp:        311,         // s  — Rutherford engine vacuum Isp
    diameter:   1.2,
    dragCoeff:  0.28,
    description: 'Small satellite launcher. Electric pump-fed engines — unique in the industry.'
  },

  saturn5: {
    name:       'Saturn V',
    company:    'NASA',
    thrust:     34_020_000,  // N  — 5x Rocketdyne F-1 engines
    fuelMass:   2_077_000,   // kg — RP-1 + LOX (first stage S-IC)
    dryMass:    130_000,     // kg — first stage dry mass
    payloadMass: 45_000,     // kg — payload to LEO (actual: 130t to LEO)
    isp:        263,         // s  — F-1 sea level Isp
    diameter:   10.1,
    dragCoeff:  0.35,
    description: 'Still the most powerful rocket ever flown. Took humans to the Moon (1969–1972).'
  },

  starship: {
    name:       'Starship',
    company:    'SpaceX',
    thrust:     74_000_000,  // N  — 33x Raptor engines (Super Heavy booster)
    fuelMass:   3_400_000,   // kg — methane + LOX
    dryMass:    200_000,     // kg
    payloadMass: 100_000,    // kg — target payload to LEO
    isp:        327,         // s  — Raptor sea level Isp
    diameter:   9.0,
    dragCoeff:  0.4,
    description: 'Largest rocket ever built. Fully reusable. Designed for Mars.'
  },

  custom: {
    name:       'Custom Rocket',
    company:    'You',
    thrust:     2_000_000,
    fuelMass:   150_000,
    dryMass:    20_000,
    payloadMass: 8_000,
    isp:        300,
    diameter:   4.0,
    dragCoeff:  0.3,
    description: 'Your custom design. Adjust the sliders to build your ideal rocket.'
  }

};

// ============================================================
// MISSION EVENTS
// Key moments during a rocket's flight.
// These get logged and displayed in the telemetry panel.
// ============================================================

const MissionEvent = {
  LAUNCH:             'LAUNCH',
  MAX_Q:              'MAX_Q',              // Maximum dynamic pressure
  MACH_1:             'MACH_1',            // Breaking the sound barrier
  ENGINE_CUTOFF:      'ENGINE_CUTOFF',     // Fuel depleted
  KARMAN_LINE:        'KARMAN_LINE',       // Entered space (100 km)
  APOGEE:             'APOGEE',            // Highest point reached
  ORBIT_ACHIEVED:     'ORBIT_ACHIEVED',   // Made it to LEO
  STRUCTURAL_FAILURE: 'STRUCTURAL_FAILURE',
  LANDED:             'LANDED'
};

// ============================================================
// GRAVITY TURN MODEL
// Calculates pitch angle based on altitude.
// Returns degrees from vertical (0 = straight up, 90 = horizontal)
// ============================================================

/**
 * @param {number} altitude - Current altitude in meters
 * @returns {number} - Pitch angle in degrees (0=vertical, 90=horizontal)
 */
function gravityTurnAngle(altitude) {
  const TURN_START = 10_000;   // Begin pitching at 10 km
  const TURN_END   = 60_000;   // Full horizontal by 60 km

  if (altitude < TURN_START) return 0;                    // Straight up
  if (altitude > TURN_END)   return 90;                   // Full horizontal

  // Smooth cosine interpolation between 0° and 90°
  const progress = (altitude - TURN_START) / (TURN_END - TURN_START);
  return 90 * (1 - Math.cos(progress * Math.PI / 2));
}

// ============================================================
// SIMULATION STATE
// The single source of truth for everything happening in the sim.
// All UI reads from here. Never modify directly — use the API below.
// ============================================================

const SimState = {
  // Core state
  running:   false,
  paused:    false,
  animFrame: null,
  lastTime:  null,

  // Rocket state (updated every tick)
  rocket: null,

  // Data history (for graph rendering)
  // Each entry: { t, alt, velV, velH, speed, gForce, dynPressure, pitch }
  history: [],
  MAX_HISTORY: 600,

  // Mission events log
  // Each entry: { time, altitude, event, value }
  events: [],

  // Mission flags (set once, never cleared mid-flight)
  maxQReached:      false,
  mach1Reached:     false,
  karmanReached:    false,
  apogeeLogged:     false,

  // Speed multiplier (1x–8x)
  speedMultiplier: 1,
};

// ============================================================
// SIMULATION CORE
// The main tick function — called ~60 times per second.
// Each tick: calculate forces → update state → log data → notify UI.
// ============================================================

/**
 * One simulation tick.
 * Uses the physics engine from physics.js to advance the rocket state.
 *
 * @param {DOMHighResTimeStamp} timestamp - from requestAnimationFrame
 */
function simulationTick(timestamp) {
  if (!SimState.running || SimState.paused) return;

  // Calculate real elapsed time since last frame
  const realDt = SimState.lastTime
    ? Math.min((timestamp - SimState.lastTime) / 1000, 0.1)  // cap at 100ms
    : 0.016; // first frame assumes 60fps
  SimState.lastTime = timestamp;

  // Scale by speed multiplier, then sub-step for numerical accuracy
  const totalDt = realDt * SimState.speedMultiplier;
  const SUB_STEPS = 8;  // Run physics 8x per frame for stability
  const dt = totalDt / SUB_STEPS;

  for (let i = 0; i < SUB_STEPS; i++) {
    if (SimState.rocket.status !== 'POWERED_FLIGHT' &&
        SimState.rocket.status !== 'COASTING') break;

    // Calculate gravity turn pitch angle
    const pitch = gravityTurnAngle(SimState.rocket.altitude);

    // Advance physics by one sub-step
    SimState.rocket = window.__Physics.integrateStep(
      { ...SimState.rocket, pitchAngle: pitch },
      dt
    );

    // Check and log mission events
    _checkMissionEvents(SimState.rocket);
  }

  // Record data point for graph
  _recordHistory(SimState.rocket);

  // Notify UI layer (defined in ui.js)
  if (typeof onSimTick === 'function') {
    onSimTick(SimState.rocket, SimState.history, SimState.events);
  }

  // Check if mission is over
  if (_isMissionOver(SimState.rocket)) {
    _endMission(SimState.rocket);
    return;
  }

  // Schedule next frame
  SimState.animFrame = requestAnimationFrame(simulationTick);
}

// ============================================================
// MISSION EVENT DETECTION
// Checks for key moments and logs them once each.
// ============================================================

function _checkMissionEvents(rocket) {
  const { altitude, speed, dynPressure, status, time } = rocket;
  const SPEED_OF_SOUND = 343; // m/s at sea level (approximate)
  const KARMAN = 100_000;

  // Mach 1 — first time exceeding speed of sound
  if (!SimState.mach1Reached && speed >= SPEED_OF_SOUND) {
    SimState.mach1Reached = true;
    _logEvent(MissionEvent.MACH_1, time, altitude, speed);
  }

  // Max-Q — track highest dynamic pressure point
  if (!SimState.maxQReached && rocket.burnout === false) {
    const prev = SimState.history[SimState.history.length - 1];
    if (prev && dynPressure < prev.dynPressure && prev.dynPressure > 5000) {
      SimState.maxQReached = true;
      _logEvent(MissionEvent.MAX_Q, time, altitude, prev.dynPressure);
    }
  }

  // Kármán line — entered space
  if (!SimState.karmanReached && altitude >= KARMAN) {
    SimState.karmanReached = true;
    _logEvent(MissionEvent.KARMAN_LINE, time, altitude, speed);
  }

  // Engine cutoff — fuel depleted
  if (rocket.burnout && !SimState.history.some(h => h.burnout)) {
    _logEvent(MissionEvent.ENGINE_CUTOFF, time, altitude, speed);
  }
}

function _logEvent(type, time, altitude, value) {
  SimState.events.push({ type, time, altitude, value });
  console.log(`[Mission Event] ${type} at t=${time.toFixed(1)}s alt=${(altitude/1000).toFixed(1)}km`);
}

function _recordHistory(rocket) {
  SimState.history.push({
    t:           rocket.time,
    alt:         rocket.altitude,
    velV:        rocket.velocityV,
    velH:        rocket.velocityH,
    speed:       rocket.speed,
    gForce:      rocket.gForce,
    dynPressure: rocket.dynPressure,
    pitch:       gravityTurnAngle(rocket.altitude),
    burnout:     rocket.burnout,
    status:      rocket.status
  });

  // Trim old history to avoid memory bloat
  if (SimState.history.length > SimState.MAX_HISTORY) {
    SimState.history.shift();
  }
}

function _isMissionOver(rocket) {
  return rocket.structuralFailure ||
         rocket.inOrbit           ||
         rocket.hasLanded         ||
         rocket.altitude > window.__Physics.PHYSICS.MAX_ALTITUDE;
}

function _endMission(rocket) {
  SimState.running = false;
  cancelAnimationFrame(SimState.animFrame);

  // Log final event
  const finalEvent = rocket.structuralFailure ? MissionEvent.STRUCTURAL_FAILURE
                   : rocket.inOrbit           ? MissionEvent.ORBIT_ACHIEVED
                   : MissionEvent.LANDED;
  _logEvent(finalEvent, rocket.time, rocket.altitude, rocket.speed);

  // Notify UI
  if (typeof onMissionEnd === 'function') {
    onMissionEnd(rocket, SimState.events);
  }
}

// ============================================================
// PUBLIC API
// These are the functions called by ui.js to control the sim.
// ============================================================

/**
 * Initialize simulation with a rocket configuration.
 * Call this before startSimulation().
 *
 * @param {object} config - Rocket parameters (see physics.js buildInitialState)
 */
function initSimulation(config) {
  cancelAnimationFrame(SimState.animFrame);

  // Reset all state
  SimState.running        = false;
  SimState.paused         = false;
  SimState.lastTime       = null;
  SimState.history        = [];
  SimState.events         = [];
  SimState.maxQReached    = false;
  SimState.mach1Reached   = false;
  SimState.karmanReached  = false;
  SimState.apogeeLogged   = false;

  // Build initial rocket state from config
  SimState.rocket = window.__Physics.buildInitialState(config);

  // Notify UI of reset
  if (typeof onSimReset === 'function') {
    onSimReset(SimState.rocket);
  }
}

/**
 * Start the simulation.
 * Requires initSimulation() to have been called first.
 */
function startSimulation() {
  if (SimState.running || !SimState.rocket) return;

  // Validate TWR — can't lift off without enough thrust
  const twr = SimState.rocket.thrust /
              (SimState.rocket.mass * window.__Physics.PHYSICS.G0);
  if (twr < 1.0) {
    if (typeof onLaunchBlocked === 'function') {
      onLaunchBlocked(`Thrust-to-weight ratio is ${twr.toFixed(2)} — must be > 1.0 to lift off. Increase thrust or reduce mass.`);
    }
    return;
  }

  SimState.running  = true;
  SimState.paused   = false;
  SimState.lastTime = null;

  // CRITICAL FIX: set status to POWERED_FLIGHT so simulationTick doesn't
  // immediately break on the status check (initial status is 'READY')
  SimState.rocket = { ...SimState.rocket, status: 'POWERED_FLIGHT' };

  // Log launch event
  _logEvent(MissionEvent.LAUNCH, 0, 0, twr);

  SimState.animFrame = requestAnimationFrame(simulationTick);
}

/**
 * Toggle pause/resume.
 */
function pauseSimulation() {
  if (!SimState.running) return;
  SimState.paused = !SimState.paused;

  if (!SimState.paused) {
    SimState.lastTime = null; // Reset timer to avoid big dt jump after pause
    SimState.animFrame = requestAnimationFrame(simulationTick);
  }

  return SimState.paused;
}

/**
 * Reset everything to pre-launch state.
 */
function resetSimulation() {
  cancelAnimationFrame(SimState.animFrame);
  SimState.running = false;
  SimState.paused  = false;

  if (SimState.rocket) {
    initSimulation({
      thrust:      SimState.rocket.thrust,
      fuelMass:    SimState.rocket.fuelMass + (SimState.rocket.mass - SimState.rocket.dryMass - SimState.rocket.fuelMass),
      dryMass:     SimState.rocket.dryMass,
      payloadMass: 0,
      isp:         SimState.rocket.isp,
      dragCoeff:   SimState.rocket.dragCoeff,
      diameter:    SimState.rocket.diameter,
    });
  }
}

/**
 * Set simulation speed multiplier.
 * @param {number} multiplier - 1 to 8
 */
function setSimSpeed(multiplier) {
  SimState.speedMultiplier = Math.max(1, Math.min(8, multiplier));
}

/**
 * Apply a disturbance to the rocket (simulates wind gust, engine anomaly).
 * @param {number} deltaV - velocity change in m/s (positive = upward boost, negative = loss)
 */
function injectDisturbance(deltaV = -50) {
  if (!SimState.rocket || !SimState.running) return;
  SimState.rocket = {
    ...SimState.rocket,
    velocityV: SimState.rocket.velocityV + deltaV,
  };
}

/**
 * Load a preset rocket configuration.
 * @param {string} presetName - Key from ROCKET_PRESETS
 */
function loadPreset(presetName) {
  const preset = ROCKET_PRESETS[presetName];
  if (!preset) {
    console.warn('Unknown preset:', presetName);
    return null;
  }
  initSimulation(preset);
  return preset;
}

/**
 * Get current simulation state snapshot (for UI reads).
 * @returns {object}
 */
function getSimState() {
  return {
    ...SimState,
    rocket:  SimState.rocket  ? { ...SimState.rocket }  : null,
    history: [...SimState.history],
    events:  [...SimState.events],
  };
}

// ============================================================
// EXPORTS — make everything available globally
// ============================================================

window.__Sim = {
  init:             initSimulation,
  start:            startSimulation,
  pause:            pauseSimulation,
  reset:            resetSimulation,
  setSpeed:         setSimSpeed,
  disturbance:      injectDisturbance,
  loadPreset,
  getState:         getSimState,
  state:            SimState,
  presets:          ROCKET_PRESETS,
  gravityTurnAngle,
  MissionEvent,
};

// Also expose key functions as globals for easy access from ui.js
window.ROCKET_PRESETS    = ROCKET_PRESETS;
window.initSimulation    = initSimulation;
window.startSimulation   = startSimulation;
window.pauseSimulation   = pauseSimulation;
window.resetSimulation   = resetSimulation;
window.setSimSpeed       = setSimSpeed;
window.injectDisturbance = injectDisturbance;
window.loadPreset        = loadPreset;
window.gravityTurnAngle  = gravityTurnAngle;
