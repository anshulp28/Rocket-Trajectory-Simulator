/**
 * physics.js — Core Physics Engine
 * Day 2: All the math that makes the rocket fly.
 *
 * This file is pure math — zero DOM, zero drawing.
 * Every function takes numbers in, returns numbers out.
 * That makes it easy to test, debug, and understand.
 *
 * UNIT SYSTEM (used consistently throughout):
 *   Distance  → meters (m)
 *   Velocity  → meters per second (m/s)
 *   Mass      → kilograms (kg)
 *   Force     → Newtons (N)
 *   Time      → seconds (s)
 *   Angle     → degrees (converted to radians internally)
 *   Pressure  → Pascals (Pa)
 *   Temp      → Kelvin (K)
 */

// ============================================================
// CONSTANTS
// Physical constants used throughout the simulation.
// These are the actual values used by aerospace engineers.
// ============================================================

const PHYSICS = {

  // Gravity
  G0:             9.807,       // Standard gravity (m/s²) — used in Isp calculation
  EARTH_RADIUS:   6_371_000,   // Earth's radius in meters (6,371 km)
  EARTH_MASS:     5.972e24,    // Earth's mass in kg
  BIG_G:          6.674e-11,   // Universal gravitational constant (N·m²/kg²)

  // Atmosphere
  SEA_LEVEL_PRESSURE:   101_325,  // Pa — standard sea level pressure
  SEA_LEVEL_DENSITY:    1.225,    // kg/m³ — standard sea level air density
  SEA_LEVEL_TEMP:       288.15,   // K — standard sea level temperature (15°C)
  TEMP_LAPSE_RATE:      0.0065,   // K/m — temperature drops 6.5°C per 1000m
  MOLAR_MASS_AIR:       0.02897,  // kg/mol
  GAS_CONSTANT:         8.314,    // J/(mol·K) — universal gas constant
  KARMAN_LINE:          100_000,  // 100 km — where space begins

  // Orbital mechanics
  LEO_VELOCITY:         7_800,    // m/s — velocity needed for Low Earth Orbit
  LEO_ALTITUDE:         200_000,  // 200 km — minimum stable orbit altitude

  // Simulation limits
  MAX_ALTITUDE:         2_000_000, // 2,000 km — simulation ceiling
  MAX_ACCELERATION:     100,       // m/s² — above this, rocket breaks apart (≈10 G)
  MAX_Q_LIMIT:          50_000,    // Pa — max dynamic pressure before structural failure

};

// ============================================================
// GRAVITY MODEL
// Gravity gets weaker as you go higher.
// Formula: g = G * M / r²  (Newton's law of gravitation)
// At sea level: 9.807 m/s². At 400km (ISS): ~8.7 m/s².
// ============================================================

/**
 * Calculate gravitational acceleration at a given altitude.
 * @param {number} altitude - Height above sea level in meters
 * @returns {number} - Gravitational acceleration in m/s²
 */
function gravityAtAltitude(altitude) {
  const r = PHYSICS.EARTH_RADIUS + altitude;
  return (PHYSICS.BIG_G * PHYSICS.EARTH_MASS) / (r * r);
}

// ============================================================
// ATMOSPHERIC MODEL
// Uses the International Standard Atmosphere (ISA) model.
// The atmosphere has layers — we model the troposphere (0–11km)
// and stratosphere (11–86km). Above 86km it's essentially vacuum.
// ============================================================

/**
 * Calculate air temperature at a given altitude.
 * In the troposphere, temperature drops linearly with altitude.
 * Above 11km (tropopause) it stays roughly constant at -56.5°C.
 *
 * @param {number} altitude - Height in meters
 * @returns {number} - Temperature in Kelvin
 */
function temperatureAtAltitude(altitude) {
  if (altitude <= 11_000) {
    // Troposphere: linear lapse rate
    return PHYSICS.SEA_LEVEL_TEMP - PHYSICS.TEMP_LAPSE_RATE * altitude;
  } else if (altitude <= 20_000) {
    // Lower stratosphere: isothermal (constant temp)
    return 216.65;
  } else if (altitude <= 32_000) {
    // Upper stratosphere: temp rises slightly
    return 216.65 + 0.001 * (altitude - 20_000);
  } else if (altitude <= 86_000) {
    // Mesosphere: temp drops again
    return 228.65 - 0.0028 * (altitude - 32_000);
  } else {
    // Above mesosphere: near vacuum, temperature model breaks down
    return 186.87;
  }
}

/**
 * Calculate air pressure at a given altitude.
 * Uses the barometric formula derived from hydrostatic equilibrium.
 *
 * @param {number} altitude - Height in meters
 * @returns {number} - Air pressure in Pascals
 */
function pressureAtAltitude(altitude) {
  if (altitude <= 0) return PHYSICS.SEA_LEVEL_PRESSURE;
  if (altitude > PHYSICS.KARMAN_LINE) return 0; // Space — no atmosphere

  const T = temperatureAtAltitude(altitude);
  const T0 = PHYSICS.SEA_LEVEL_TEMP;
  const P0 = PHYSICS.SEA_LEVEL_PRESSURE;

  if (altitude <= 11_000) {
    // Troposphere formula
    const exponent = (PHYSICS.G0 * PHYSICS.MOLAR_MASS_AIR) /
                     (PHYSICS.GAS_CONSTANT * PHYSICS.TEMP_LAPSE_RATE);
    return P0 * Math.pow(T / T0, exponent);
  } else {
    // Stratosphere and above — exponential decay
    const P11 = pressureAtAltitude(11_000); // Pressure at tropopause
    const T11 = temperatureAtAltitude(11_000);
    return P11 * Math.exp(
      -(PHYSICS.G0 * PHYSICS.MOLAR_MASS_AIR * (altitude - 11_000)) /
      (PHYSICS.GAS_CONSTANT * T11)
    );
  }
}

/**
 * Calculate air density at a given altitude.
 * Uses ideal gas law: ρ = P / (R_specific × T)
 *
 * @param {number} altitude - Height in meters
 * @returns {number} - Air density in kg/m³
 */
function densityAtAltitude(altitude) {
  if (altitude > PHYSICS.KARMAN_LINE) return 0;
  const P = pressureAtAltitude(altitude);
  const T = temperatureAtAltitude(altitude);
  const R_specific = PHYSICS.GAS_CONSTANT / PHYSICS.MOLAR_MASS_AIR; // 287 J/(kg·K)
  return P / (R_specific * T);
}

// ============================================================
// DRAG MODEL
// Aerodynamic drag: the force that slows the rocket down.
// Formula: F_drag = ½ × ρ × v² × Cd × A
//   ρ  = air density (kg/m³)
//   v  = velocity (m/s)
//   Cd = drag coefficient (dimensionless, ~0.3 for rockets)
//   A  = cross-sectional area (m²)
// ============================================================

/**
 * Calculate aerodynamic drag force on the rocket.
 *
 * @param {number} velocity    - Current speed in m/s
 * @param {number} altitude    - Current altitude in meters
 * @param {number} dragCoeff   - Drag coefficient (Cd), typically 0.2–0.5
 * @param {number} crossSection - Cross-sectional area in m²
 * @returns {number} - Drag force in Newtons (always opposing motion)
 */
function dragForce(velocity, altitude, dragCoeff, crossSection) {
  const rho = densityAtAltitude(altitude);
  return 0.5 * rho * velocity * velocity * dragCoeff * crossSection;
}

/**
 * Calculate dynamic pressure (q) — the aerodynamic pressure on the rocket.
 * Max-Q is the moment when this is highest, usually around 10–15 km altitude.
 * This is the most stressful moment for the rocket structure.
 * The Falcon 9 throttles down at Max-Q to protect itself.
 *
 * @param {number} velocity  - Current speed in m/s
 * @param {number} altitude  - Current altitude in meters
 * @returns {number} - Dynamic pressure in Pascals
 */
function dynamicPressure(velocity, altitude) {
  const rho = densityAtAltitude(altitude);
  return 0.5 * rho * velocity * velocity;
}

// ============================================================
// ROCKET EQUATION
// The Tsiolkovsky Rocket Equation — the most important equation
// in spaceflight. It tells you how much velocity a rocket can
// achieve given its fuel and engine efficiency.
//
// Δv = Isp × g₀ × ln(m₀ / mf)
//
// Where ln() is the natural logarithm.
// This is why rockets are mostly fuel — the mass ratio (m₀/mf)
// needs to be huge to reach orbital velocity.
// ============================================================

/**
 * Calculate maximum delta-v using the Tsiolkovsky Rocket Equation.
 *
 * @param {number} isp          - Specific impulse in seconds (engine efficiency)
 * @param {number} wetMass      - Total mass at launch (rocket + fuel) in kg
 * @param {number} dryMass      - Mass without fuel (structure + payload) in kg
 * @returns {number} - Maximum achievable delta-v in m/s
 */
function rocketEquation(isp, wetMass, dryMass) {
  if (dryMass <= 0 || wetMass <= dryMass) return 0;
  const massRatio = wetMass / dryMass;
  return isp * PHYSICS.G0 * Math.log(massRatio);
}

/**
 * Calculate thrust force from engine parameters.
 * Thrust = mass flow rate × exhaust velocity
 *        = (fuel burned per second) × Isp × g₀
 *
 * @param {number} isp          - Specific impulse in seconds
 * @param {number} massFlowRate - Fuel burned per second in kg/s
 * @returns {number} - Thrust in Newtons
 */
function calculateThrust(isp, massFlowRate) {
  return isp * PHYSICS.G0 * massFlowRate;
}

/**
 * Calculate mass flow rate needed to produce a given thrust.
 *
 * @param {number} thrust - Desired thrust in Newtons
 * @param {number} isp    - Specific impulse in seconds
 * @returns {number} - Mass flow rate in kg/s
 */
function massFlowRate(thrust, isp) {
  if (isp <= 0) return 0;
  return thrust / (isp * PHYSICS.G0);
}

// ============================================================
// FORCE SUMMATION
// At every instant, three forces act on the rocket:
//   1. Thrust   — upward (from engine)
//   2. Gravity  — downward (from Earth)
//   3. Drag     — opposing velocity (from atmosphere)
//
// Net force = Thrust - Gravity - Drag
// Acceleration = Net force / current mass  (F = ma → a = F/m)
// ============================================================

/**
 * Calculate the net acceleration on the rocket at this instant.
 * This is called every simulation tick (typically 60 times/second).
 *
 * @param {object} rocket - Current rocket state
 *   @param {number} rocket.thrust       - Current thrust in N
 *   @param {number} rocket.mass         - Current total mass in kg
 *   @param {number} rocket.velocity     - Current speed in m/s
 *   @param {number} rocket.altitude     - Current altitude in m
 *   @param {number} rocket.dragCoeff    - Drag coefficient
 *   @param {number} rocket.crossSection - Cross-sectional area in m²
 *   @param {number} rocket.pitchAngle   - Angle from vertical in degrees
 * @returns {object} - { verticalAccel, horizontalAccel, drag, gravity, netForce }
 */
function netAcceleration(rocket) {
  const { thrust, mass, velocity, altitude, dragCoeff, crossSection, pitchAngle = 0 } = rocket;

  // Convert pitch angle to radians
  const angleRad = (pitchAngle * Math.PI) / 180;

  // Thrust components (vertical and horizontal)
  const thrustVertical   = thrust * Math.cos(angleRad);
  const thrustHorizontal = thrust * Math.sin(angleRad);

  // Gravity (always downward, weakens with altitude)
  const gravity     = gravityAtAltitude(altitude);
  const gravityForce = mass * gravity;

  // Drag (opposes velocity direction)
  const drag = dragForce(velocity, altitude, dragCoeff, crossSection);

  // Net vertical force
  const netVertical = thrustVertical - gravityForce - drag * Math.cos(angleRad);

  // Net horizontal force
  const netHorizontal = thrustHorizontal - drag * Math.sin(angleRad);

  // Acceleration = F / m  (Newton's second law)
  const verticalAccel   = netVertical   / mass;
  const horizontalAccel = netHorizontal / mass;

  // Total acceleration magnitude (for G-force display)
  const totalAccel = Math.sqrt(verticalAccel ** 2 + horizontalAccel ** 2);

  return {
    verticalAccel,
    horizontalAccel,
    totalAccel,
    gForce:    totalAccel / PHYSICS.G0,  // Express as multiples of g
    drag,
    gravity:   gravityForce,
    netForce:  Math.sqrt(netVertical ** 2 + netHorizontal ** 2),
    dynPressure: dynamicPressure(velocity, altitude)
  };
}

// ============================================================
// EULER INTEGRATION
// We can't solve rocket physics with a simple formula because
// everything changes every instant (mass decreases as fuel burns,
// drag changes with speed and altitude, gravity weakens, etc.)
//
// Instead we use Euler integration: break time into tiny steps
// (dt = 0.1 seconds) and recalculate forces at each step.
// This is how real aerospace simulations work.
//
// New position = old position + velocity × dt
// New velocity = old velocity + acceleration × dt
// New mass     = old mass - fuel burned × dt
// ============================================================

/**
 * Advance the rocket simulation by one time step.
 * This is the core of the simulation — called hundreds of times per second.
 *
 * @param {object} state - Current rocket state
 * @param {number} dt    - Time step in seconds (typically 0.05–0.1s)
 * @returns {object}     - New rocket state after dt seconds
 */
function integrateStep(state, dt) {
  const {
    altitude, velocityV, velocityH, mass, fuelMass,
    thrust, isp, dragCoeff, crossSection, pitchAngle,
    time, maxQ, maxAltitude, burnout
  } = state;

  // Check if we still have fuel
  const fuelBurnRate = burnout ? 0 : massFlowRate(thrust, isp);
  const actualThrust = burnout ? 0 : thrust;
  const newFuelMass  = Math.max(0, fuelMass - fuelBurnRate * dt);
  const newMass      = mass - (fuelMass - newFuelMass); // Structure mass stays constant
  const hasBurnedOut = newFuelMass <= 0;

  // Calculate speed (magnitude of velocity vector)
  const speed = Math.sqrt(velocityV ** 2 + velocityH ** 2);

  // Get net acceleration
  const accel = netAcceleration({
    thrust:       actualThrust,
    mass:         newMass,
    velocity:     speed,
    altitude,
    dragCoeff,
    crossSection,
    pitchAngle
  });

  // Update velocities (Euler integration)
  const newVelocityV = velocityV + accel.verticalAccel   * dt;
  const newVelocityH = velocityH + accel.horizontalAccel * dt;

  // Update altitude and downrange distance
  const newAltitude  = Math.max(0, altitude + newVelocityV * dt);

  // Track mission statistics
  const newMaxQ       = Math.max(maxQ || 0, accel.dynPressure);
  const newMaxAlt     = Math.max(maxAltitude || 0, newAltitude);

  // Check for structural failure (exceeds Max-Q limit)
  const structuralFailure = accel.dynPressure > PHYSICS.MAX_Q_LIMIT;

  // Check if rocket has reached orbit
  const inOrbit = newAltitude >= PHYSICS.LEO_ALTITUDE &&
                  Math.abs(newVelocityH) >= PHYSICS.LEO_VELOCITY;

  // Check if rocket has landed / crashed
  const hasLanded = newAltitude <= 0 && state.time > 1;

  return {
    ...state,
    time:             time + dt,
    altitude:         newAltitude,
    velocityV:        newVelocityV,
    velocityH:        newVelocityH,
    speed:            Math.sqrt(newVelocityV ** 2 + newVelocityH ** 2),
    mass:             newMass,
    fuelMass:         newFuelMass,
    burnout:          hasBurnedOut,
    gForce:           accel.gForce,
    drag:             accel.drag,
    dynPressure:      accel.dynPressure,
    verticalAccel:    accel.verticalAccel,
    horizontalAccel:  accel.horizontalAccel,
    maxQ:             newMaxQ,
    maxAltitude:      newMaxAlt,
    structuralFailure,
    inOrbit,
    hasLanded,

    // Mission status
    status: structuralFailure ? 'STRUCTURAL_FAILURE'
          : inOrbit           ? 'ORBIT_ACHIEVED'
          : hasLanded         ? 'LANDED'
          : hasBurnedOut      ? 'COASTING'
          : 'POWERED_FLIGHT'
  };
}

// ============================================================
// INITIAL STATE BUILDER
// Creates a valid starting state for a rocket configuration.
// ============================================================

/**
 * Build the initial simulation state from rocket parameters.
 *
 * @param {object} config - Rocket configuration
 * @returns {object} - Initial simulation state
 */
function buildInitialState(config) {
  const {
    dryMass      = 20_000,   // kg  — empty rocket (structure + engines)
    fuelMass     = 80_000,   // kg  — propellant mass
    payloadMass  = 5_000,    // kg  — payload to orbit
    thrust       = 600_000,  // N   — engine thrust
    isp          = 282,      // s   — specific impulse (RP-1/LOX ≈ 282s)
    dragCoeff    = 0.3,      // Cd  — drag coefficient
    diameter     = 3.7,      // m   — rocket diameter
    pitchAngle   = 0,        // deg — initial pitch (0 = straight up)
  } = config;

  const totalMass    = dryMass + fuelMass + payloadMass;
  const crossSection = Math.PI * (diameter / 2) ** 2; // Area = π r²
  const deltaV       = rocketEquation(isp, totalMass, dryMass + payloadMass);
  const burnDuration = fuelMass / massFlowRate(thrust, isp);
  const twr          = thrust / (totalMass * PHYSICS.G0); // Thrust-to-weight ratio

  return {
    // Motion
    altitude:    0,
    velocityV:   0,       // Vertical velocity (m/s)
    velocityH:   0,       // Horizontal velocity (m/s)
    speed:       0,
    time:        0,

    // Rocket properties
    mass:        totalMass,
    fuelMass,
    dryMass:     dryMass + payloadMass,
    thrust,
    isp,
    dragCoeff,
    crossSection,
    pitchAngle,
    diameter,

    // Forces
    gForce:      0,
    drag:        0,
    dynPressure: 0,
    verticalAccel: 0,
    horizontalAccel: 0,

    // Mission tracking
    maxQ:        0,
    maxAltitude: 0,
    burnout:     false,
    inOrbit:     false,
    hasLanded:   false,
    structuralFailure: false,
    status:      'READY',

    // Computed mission stats (shown before launch)
    stats: {
      totalMass,
      deltaV:       Math.round(deltaV),
      burnDuration: Math.round(burnDuration),
      twr:          twr.toFixed(2),
      massRatio:    (totalMass / (dryMass + payloadMass)).toFixed(2),
      maxTheoreticalAlt: deltaV > PHYSICS.LEO_VELOCITY ? 'Orbit capable' : `~${Math.round(deltaV / 10)}m`
    }
  };
}

// ============================================================
// UNIT CONVERSION HELPERS
// Aerospace engineers use many different units.
// These helpers make the display layer clean.
// ============================================================

const Units = {
  metersToKm:   m  => (m / 1000).toFixed(1),
  metersToMi:   m  => (m / 1609.34).toFixed(1),
  msToKmh:      ms => (ms * 3.6).toFixed(0),
  msToMach:     ms => (ms / 343).toFixed(2),   // Speed of sound ≈ 343 m/s at sea level
  kgToTons:     kg => (kg / 1000).toFixed(1),
  paToAtm:      pa => (pa / 101325).toFixed(4),
  radToDeg:     r  => (r * 180 / Math.PI).toFixed(1),
  degToRad:     d  => (d * Math.PI / 180),
  formatLarge:  n  => n >= 1e6 ? (n/1e6).toFixed(2)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : Math.round(n).toString()
};

// ============================================================
// EXPORT
// Make everything available to other files.
// ============================================================

window.__Physics = {
  PHYSICS,
  gravityAtAltitude,
  temperatureAtAltitude,
  pressureAtAltitude,
  densityAtAltitude,
  dragForce,
  dynamicPressure,
  rocketEquation,
  calculateThrust,
  massFlowRate,
  netAcceleration,
  integrateStep,
  buildInitialState,
  Units
};

// Also available as individual globals for easy access
window.PHYSICS        = PHYSICS;
window.integrateStep  = integrateStep;
window.buildInitialState = buildInitialState;
window.Units          = Units;
