/**
 * simulation.js — Rocket Simulation Loop
 * Day 3 (fixed): Clean, simple simulation loop that actually works.
 *
 * Physics: physics.js
 * UI callbacks: defined in ui.js, called here
 */

// ============================================================
// ROCKET PRESETS
// ============================================================

const ROCKET_PRESETS = {
  falcon9: {
    name: 'Falcon 9', company: 'SpaceX',
    thrust: 7607000, fuelMass: 411000, dryMass: 25600,
    payloadMass: 13500, isp: 282, diameter: 3.7, dragCoeff: 0.3,
    description: 'The workhorse of commercial spaceflight.'
  },
  electron: {
    name: 'Electron', company: 'Rocket Lab',
    thrust: 192000, fuelMass: 9000, dryMass: 950,
    payloadMass: 300, isp: 311, diameter: 1.2, dragCoeff: 0.28,
    description: 'Small satellite launcher with electric pump-fed engines.'
  },
  saturn5: {
    name: 'Saturn V', company: 'NASA',
    thrust: 34020000, fuelMass: 2077000, dryMass: 130000,
    payloadMass: 45000, isp: 263, diameter: 10.1, dragCoeff: 0.35,
    description: 'Most powerful rocket ever flown. Took humans to the Moon.'
  },
  starship: {
    name: 'Starship', company: 'SpaceX',
    thrust: 74000000, fuelMass: 3400000, dryMass: 200000,
    payloadMass: 100000, isp: 327, diameter: 9.0, dragCoeff: 0.4,
    description: 'Largest rocket ever built. Fully reusable. Designed for Mars.'
  },
  custom: {
    name: 'Custom Rocket', company: 'You',
    thrust: 2000000, fuelMass: 150000, dryMass: 20000,
    payloadMass: 8000, isp: 300, diameter: 4.0, dragCoeff: 0.3,
    description: 'Your custom design.'
  }
};

// ============================================================
// GRAVITY TURN
// Rockets pitch from vertical to horizontal between 10-60km
// ============================================================

function gravityTurnAngle(altitude) {
  const START = 10000, END = 60000;
  if (altitude < START) return 0;
  if (altitude > END)   return 90;
  const p = (altitude - START) / (END - START);
  return 90 * (1 - Math.cos(p * Math.PI / 2));
}

// ============================================================
// CORE PHYSICS CONSTANTS (duplicated here for safety)
// ============================================================

const G0      = 9.807;
const BIG_G   = 6.674e-11;
const EARTH_M = 5.972e24;
const EARTH_R = 6371000;
const KARMAN  = 100000;
const LEO_ALT = 200000;
const LEO_VEL = 7800;

function getGravity(alt) {
  const r = EARTH_R + alt;
  return (BIG_G * EARTH_M) / (r * r);
}

function getAirDensity(alt) {
  if (alt > KARMAN) return 0;
  const T = alt <= 11000 ? 288.15 - 0.0065 * alt : 216.65;
  const P = alt <= 11000
    ? 101325 * Math.pow(T / 288.15, (G0 * 0.02897) / (8.314 * 0.0065))
    : 22632  * Math.exp(-(G0 * 0.02897 * (alt - 11000)) / (8.314 * 216.65));
  return P / (287 * T);
}

// ============================================================
// SIMULATION STATE
// ============================================================

let SIM = {
  running:    false,
  paused:     false,
  raf:        null,
  lastTime:   null,
  speedMult:  4,
  history:    [],
  events:     [],

  // Rocket state
  alt:        0,
  velV:       0,     // vertical velocity m/s
  velH:       0,     // horizontal velocity m/s
  speed:      0,
  mass:       0,
  fuelMass:   0,
  dryMass:    0,
  thrust:     0,
  isp:        0,
  dragCoeff:  0,
  crossSection: 0,
  time:       0,
  gForce:     0,
  dynPressure:0,
  maxAlt:     0,
  maxQ:       0,
  burnout:    false,
  failed:     false,
  orbited:    false,
  landed:     false,
  status:     'READY',

  // Flags for one-time event logging
  _mach1Done:   false,
  _maxQDone:    false,
  _karmanDone:  false,
  _burnoutDone: false,
};

// ============================================================
// SIMULATION TICK
// ============================================================

function simulationTick(ts) {
  if (!SIM.running || SIM.paused) return;

  // Delta time
  const realDt = SIM.lastTime ? Math.min((ts - SIM.lastTime) / 1000, 0.05) : 0.016;
  SIM.lastTime = ts;

  // Sub-step for numerical stability
  const totalDt = realDt * SIM.speedMult;
  const STEPS = 8;
  const dt = totalDt / STEPS;

  for (let i = 0; i < STEPS; i++) {
    if (SIM.failed || SIM.landed) break;

    // Fuel burn
    const fuelRate = SIM.burnout ? 0 : SIM.thrust / (SIM.isp * G0);
    const newFuel  = Math.max(0, SIM.fuelMass - fuelRate * dt);
    const burnout  = !SIM.burnout && newFuel <= 0;
    SIM.fuelMass   = newFuel;
    SIM.burnout    = SIM.burnout || burnout;
    SIM.mass       = SIM.dryMass + SIM.fuelMass;

    // Thrust (zero after burnout)
    const thrust = SIM.burnout ? 0 : SIM.thrust;

    // Physics forces
    const pitch    = gravityTurnAngle(SIM.alt);
    const pitchRad = pitch * Math.PI / 180;
    const speed    = Math.sqrt(SIM.velV * SIM.velV + SIM.velH * SIM.velH);
    const rho      = getAirDensity(SIM.alt);
    const drag     = 0.5 * rho * speed * speed * SIM.dragCoeff * SIM.crossSection;
    const gravity  = getGravity(SIM.alt);

    // Net forces
    const thrustV = thrust * Math.cos(pitchRad);
    const thrustH = thrust * Math.sin(pitchRad);
    const dragV   = drag * (speed > 0 ? SIM.velV / speed : 0);
    const dragH   = drag * (speed > 0 ? SIM.velH / speed : 0);

    const netV = thrustV - SIM.mass * gravity - dragV;
    const netH = thrustH - dragH;

    const accV = netV / SIM.mass;
    const accH = netH / SIM.mass;

    // Integrate velocity and position
    SIM.velV  += accV * dt;
    SIM.velH  += accH * dt;
    SIM.alt    = Math.max(0, SIM.alt + SIM.velV * dt);
    SIM.speed  = Math.sqrt(SIM.velV * SIM.velV + SIM.velH * SIM.velH);
    SIM.time  += dt;

    // Telemetry
    SIM.gForce      = Math.sqrt(accV * accV + accH * accH) / G0;
    SIM.dynPressure = 0.5 * rho * speed * speed;
    SIM.maxAlt      = Math.max(SIM.maxAlt, SIM.alt);
    SIM.maxQ        = Math.max(SIM.maxQ,   SIM.dynPressure);

    // Mission outcomes
    SIM.failed  = SIM.dynPressure > 80000 && SIM.alt < 70000;
    SIM.orbited = SIM.alt >= LEO_ALT && SIM.speed >= LEO_VEL * 0.85;
    SIM.landed  = SIM.alt <= 0 && SIM.time > 2;

    // Update status
    SIM.status = SIM.failed  ? 'STRUCTURAL_FAILURE'
               : SIM.orbited ? 'ORBIT_ACHIEVED'
               : SIM.landed  ? 'LANDED'
               : SIM.burnout ? 'COASTING'
               : 'POWERED_FLIGHT';

    // One-time mission events
    if (!SIM._mach1Done && speed >= 343) {
      SIM._mach1Done = true;
      SIM.events.push({ type: 'MACH_1', time: SIM.time, altitude: SIM.alt, value: speed });
    }
    if (!SIM._karmanDone && SIM.alt >= KARMAN) {
      SIM._karmanDone = true;
      SIM.events.push({ type: 'KARMAN_LINE', time: SIM.time, altitude: SIM.alt, value: speed });
    }
    if (!SIM._burnoutDone && burnout) {
      SIM._burnoutDone = true;
      SIM.events.push({ type: 'ENGINE_CUTOFF', time: SIM.time, altitude: SIM.alt, value: speed });
    }
  }

  // Record history point
  SIM.history.push({
    t:           SIM.time,
    alt:         SIM.alt,
    velV:        SIM.velV,
    velH:        SIM.velH,
    speed:       SIM.speed,
    gForce:      SIM.gForce,
    dynPressure: SIM.dynPressure,
    burnout:     SIM.burnout,
    status:      SIM.status
  });
  if (SIM.history.length > 800) SIM.history.shift();

  // Fire UI callback
  if (typeof window.onSimTick === 'function') {
    window.onSimTick(SIM, SIM.history, SIM.events);
  }

  // End mission if over
  if (SIM.failed || SIM.orbited || SIM.landed) {
    SIM.running = false;
    if (typeof window.onMissionEnd === 'function') {
      window.onMissionEnd(SIM, SIM.events);
    }
    return;
  }

  SIM.raf = requestAnimationFrame(simulationTick);
}

// ============================================================
// PUBLIC API
// ============================================================

function initSimulation(config) {
  cancelAnimationFrame(SIM.raf);

  const cs = Math.PI * Math.pow((config.diameter || 3.7) / 2, 2);

  SIM = {
    running: false, paused: false, raf: null, lastTime: null,
    speedMult: SIM.speedMult || 4,
    history: [], events: [],

    alt: 0, velV: 0, velH: 0, speed: 0,
    mass:        config.fuelMass + config.dryMass + (config.payloadMass || 0),
    fuelMass:    config.fuelMass,
    dryMass:     config.dryMass + (config.payloadMass || 0),
    thrust:      config.thrust,
    isp:         config.isp,
    dragCoeff:   config.dragCoeff || 0.3,
    crossSection: cs,
    time: 0, gForce: 0, dynPressure: 0,
    maxAlt: 0, maxQ: 0,
    burnout: false, failed: false, orbited: false, landed: false,
    status: 'READY',

    _mach1Done: false, _maxQDone: false,
    _karmanDone: false, _burnoutDone: false,
  };

  if (typeof window.onSimReset === 'function') window.onSimReset(SIM);
}

function startSimulation() {
  if (SIM.running) return;

  const twr = SIM.thrust / (SIM.mass * G0);
  if (twr < 1.0) {
    if (typeof window.onLaunchBlocked === 'function') {
      window.onLaunchBlocked(
        `TWR is ${twr.toFixed(2)} — must be > 1.0 to lift off. Increase thrust or reduce mass.`
      );
    }
    return;
  }

  SIM.running  = true;
  SIM.paused   = false;
  SIM.lastTime = null;
  SIM.status   = 'POWERED_FLIGHT';
  SIM.events.push({ type: 'LAUNCH', time: 0, altitude: 0, value: twr });
  SIM.raf = requestAnimationFrame(simulationTick);
}

function pauseSimulation() {
  if (!SIM.running) return;
  SIM.paused = !SIM.paused;
  if (!SIM.paused) {
    SIM.lastTime = null;
    SIM.raf = requestAnimationFrame(simulationTick);
  }
  return SIM.paused;
}

function resetSimulation() {
  cancelAnimationFrame(SIM.raf);
  SIM.running = false;
  SIM.paused  = false;
}

function setSimSpeed(multiplier) {
  SIM.speedMult = Math.max(1, Math.min(8, multiplier));
}

function loadPreset(name) {
  const preset = ROCKET_PRESETS[name];
  if (!preset) return null;
  initSimulation(preset);
  return preset;
}

// Expose globals
window.ROCKET_PRESETS    = ROCKET_PRESETS;
window.initSimulation    = initSimulation;
window.startSimulation   = startSimulation;
window.pauseSimulation   = pauseSimulation;
window.resetSimulation   = resetSimulation;
window.setSimSpeed       = setSimSpeed;
window.loadPreset        = loadPreset;
window.gravityTurnAngle  = gravityTurnAngle;
window.PHYSICS           = { G0, KARMAN, LEO_ALT, LEO_VEL, MAX_ALTITUDE: 2000000 };

// __Sim compatibility shim for chart.js
window.__Sim = {
  state:    SIM,
  presets:  ROCKET_PRESETS,
  MissionEvent: {
    MACH_1: 'MACH_1', MAX_Q: 'MAX_Q',
    KARMAN_LINE: 'KARMAN_LINE', ENGINE_CUTOFF: 'ENGINE_CUTOFF',
    ORBIT_ACHIEVED: 'ORBIT_ACHIEVED', STRUCTURAL_FAILURE: 'STRUCTURAL_FAILURE'
  }
};
