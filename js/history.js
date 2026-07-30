/**
 * history.js — Historical Rocket Context & Educational Panel
 * Day 13: Adds rich educational content to each rocket preset.
 *
 * FEATURES:
 * 1. Historical fact card — shows real-world context about each
 *    rocket when selected (first flight, missions, records)
 * 2. "Explain this" panel — when a mission event fires (Max-Q,
 *    Mach 1, burnout), shows a plain-English explanation of what
 *    just happened and why it matters
 * 3. Engineering deep-dive — expandable section explaining the
 *    physics concept behind each event
 * 4. Fun facts ticker — rotates interesting aerospace facts
 *    during flight to keep the experience educational
 *
 * WHY THIS IS IMPRESSIVE:
 * It shows you understand the engineering context, not just the
 * code. Cornell Engineering looks for students who can connect
 * technical concepts to real-world applications.
 */

const RocketHistory = (() => {

  // ============================================================
  // ROCKET HISTORICAL DATA
  // Real facts about each preset rocket
  // ============================================================

  const ROCKET_DATA = {
    falcon9: {
      name:        'Falcon 9',
      operator:    'SpaceX',
      firstFlight: 'June 4, 2010',
      totalFlights:'over 300 (as of 2024)',
      record:      'First orbital rocket to successfully land and reuse its first stage',
      missions:    'ISS resupply, Starlink deployment, crewed missions (Dragon)',
      funFact:     'The Falcon 9 first stage can land itself on a drone ship in the ocean — autonomously. It uses grid fins and cold gas thrusters to steer back.',
      engineFact:  'Each Merlin engine produces 845 kN of thrust burning RP-1 (kerosene) and liquid oxygen. Nine engines fire simultaneously at liftoff.',
      maxQFact:    'Falcon 9 throttles its engines DOWN at Max-Q to reduce aerodynamic stress — just like a car easing off the gas before a speed bump.',
      color:       '#185FA5'
    },
    electron: {
      name:        'Electron',
      operator:    'Rocket Lab',
      firstFlight: 'May 25, 2017',
      totalFlights:'~50 (as of 2024)',
      record:      'First rocket to use electric pump-fed engines (Rutherford engines)',
      missions:    'Commercial small satellite launches to LEO and SSO',
      funFact:     'Electron\'s Rutherford engines are almost entirely 3D printed — the combustion chamber, injector, pumps, and propellant valves are all additive manufactured.',
      engineFact:  'Electric pump-fed engines use battery-powered electric motors to pump propellant instead of traditional gas generators — simpler, lighter, and more reliable.',
      maxQFact:    'At Electron\'s scale, Max-Q occurs lower and at lower velocities than large rockets — the thin structure makes aerodynamic forces proportionally more dangerous.',
      color:       '#1D9E75'
    },
    saturn5: {
      name:        'Saturn V',
      operator:    'NASA',
      firstFlight: 'November 9, 1967',
      totalFlights:'13 (all successful)',
      record:      'Still the tallest, heaviest, and most powerful rocket ever flown',
      missions:    'Apollo 8-17 (Moon missions), Skylab space station launch',
      funFact:     'Saturn V is 111 meters tall — taller than the Statue of Liberty. At liftoff it consumed 20 tonnes of propellant per second and shook buildings miles away.',
      engineFact:  'Each F-1 engine produced 6.7 MN of thrust — more than the entire Falcon 9. Five F-1 engines powered the first stage, burning RP-1 and liquid oxygen.',
      maxQFact:    'Saturn V experienced Max-Q at about 13 km altitude traveling at ~1,500 m/s. Engineers called this "the point of maximum aerodynamic stress" — the most dangerous moment.',
      color:       '#854F0B'
    },
    starship: {
      name:        'Starship',
      operator:    'SpaceX',
      firstFlight: 'April 20, 2023 (first integrated test)',
      totalFlights:'Several test flights (ongoing development)',
      record:      'Largest and most powerful rocket ever built — surpasses Saturn V',
      missions:    'Mars colonization, lunar landing (NASA Artemis), point-to-point Earth travel',
      funFact:     'Starship is fully reusable — both the Super Heavy booster AND the Starship upper stage return and land. The booster is caught mid-air by giant mechanical arms called "Mechazilla."',
      engineFact:  'Raptor engines use methane and liquid oxygen — chosen because methane can be manufactured on Mars from CO₂ and water, enabling in-situ refueling for the return trip.',
      maxQFact:    'Starship\'s sheer size means Max-Q forces are enormous in absolute terms. The vehicle was designed with aerodynamic "flaps" that also double as control surfaces during re-entry.',
      color:       '#6B3FA0'
    },
    custom: {
      name:        'Custom Rocket',
      operator:    'You',
      firstFlight: 'Today',
      totalFlights:'As many as you want',
      record:      'Whatever you design it to be',
      missions:    'Defined by your engineering choices',
      funFact:     'Real rocket engineers do exactly what you\'re doing — adjusting mass, thrust, and Isp to optimize trajectory. This is called "mission design" and it\'s a full engineering discipline.',
      engineFact:  'The Tsiolkovsky rocket equation (Δv = Isp × g₀ × ln(m₀/mf)) governs every rocket ever built. Higher Isp = more efficient engine. Higher mass ratio = more delta-v.',
      maxQFact:    'Max-Q depends on your rocket\'s cross-sectional area, velocity, and atmospheric density. You can reduce Max-Q by flying slower through the lower atmosphere.',
      color:       '#9a9a95'
    }
  };

  // ============================================================
  // EVENT EXPLANATIONS
  // Plain-English explanations of mission events
  // ============================================================

  const EVENT_EXPLANATIONS = {
    LAUNCH: {
      title:    '🚀 Liftoff',
      summary:  'The engines ignite and thrust exceeds the rocket\'s weight. The rocket begins to accelerate upward.',
      detail:   'For liftoff to occur, thrust must exceed the total weight of the rocket (thrust-to-weight ratio > 1.0). In the first seconds, acceleration is relatively gentle — the rocket is heavy with fuel.',
      concept:  'Newton\'s 3rd Law: hot exhaust gases are expelled downward at high speed, pushing the rocket upward with equal force.'
    },
    MACH_1: {
      title:    '💨 Mach 1 — Breaking the Sound Barrier',
      summary:  'The rocket just exceeded the speed of sound (~343 m/s at sea level). This is called "going supersonic."',
      detail:   'At Mach 1, shock waves form around the vehicle. Drag increases sharply — this is called "transonic drag rise." Engineers design nose cones to be sharp and thin to minimize this effect.',
      concept:  'Sound travels at ~343 m/s at sea level. When an object exceeds this, pressure waves can no longer escape forward and pile up into a shockwave — the "sonic boom."'
    },
    MAX_Q: {
      title:    '⚠️ Max-Q — Maximum Dynamic Pressure',
      summary:  'This is the most aerodynamically stressful moment of the flight. The rocket structure is under maximum load.',
      detail:   'Dynamic pressure (q = ½ρv²) is highest when the rocket is moving fast but still in relatively dense air. Above this point, the atmosphere thins faster than the rocket speeds up, so stress decreases.',
      concept:  'Falcon 9 throttles down its engines at Max-Q to reduce stress on the vehicle — you can see this in every SpaceX livestream. The vehicle survives Max-Q by being an engineered thin-walled pressure vessel.'
    },
    KARMAN_LINE: {
      title:    '🌌 Kármán Line — You\'re in Space',
      summary:  'The rocket just crossed 100 km altitude — the internationally recognized boundary of space.',
      detail:   'At 100 km, the atmosphere is so thin that aerodynamic lift is essentially impossible. Vehicles must travel at orbital velocity to maintain altitude. This is where astronaut wings are awarded.',
      concept:  'The Kármán line is defined where aerodynamic forces become negligible compared to gravitational forces. It\'s a convenient boundary, not a sharp physical transition.'
    },
    ENGINE_CUTOFF: {
      title:    '🔥 Engine Cutoff — Fuel Depleted',
      summary:  'The engines have shut down — all propellant has been consumed. The rocket is now coasting on inertia.',
      detail:   'After burnout, the rocket follows a ballistic trajectory — only gravity and residual atmospheric drag act on it. The altitude it reaches depends entirely on its velocity at burnout.',
      concept:  'This is why the rocket equation matters: every kilogram of dry mass you carry to burnout is "dead weight" that the rocket has to accelerate the entire way. Lighter = faster.'
    },
    ORBIT_ACHIEVED: {
      title:    '⭐ Orbit Achieved',
      summary:  'The rocket reached LEO velocity at LEO altitude. It\'s now in orbit — falling around Earth continuously.',
      detail:   'An orbit isn\'t about going "up" — it\'s about going fast enough sideways that as you fall toward Earth, the surface curves away beneath you. At LEO, this requires ~7,800 m/s.',
      concept:  'Newton described orbit as "a projectile thrown so fast it falls around the Earth." The ISS orbits at 7,660 m/s — if it slowed down by just 200 m/s, it would deorbit within hours.'
    },
    STRUCTURAL_FAILURE: {
      title:    '💥 Structural Failure',
      summary:  'The dynamic pressure exceeded the rocket\'s structural limits. The vehicle broke apart.',
      detail:   'Real rockets are designed with safety margins — typically 1.25× the expected maximum load. Your rocket\'s dynamic pressure exceeded this threshold, likely because thrust was too high during the dense lower atmosphere.',
      concept:  'This is why Falcon 9 throttles down at Max-Q. The structural mass penalty of building a stronger rocket costs more delta-v than the lost thrust from throttling down.'
    }
  };

  // ============================================================
  // AEROSPACE FUN FACTS (rotate during flight)
  // ============================================================

  const FUN_FACTS = [
    'The ISS travels at 7.66 km/s — it orbits Earth every 92 minutes.',
    'Rocket engines are the most power-dense machines ever built.',
    'The Falcon 9 first stage performs a "boostback burn" to reverse course and return to the launch site.',
    'Liquid oxygen must be stored at -183°C — it boils at room temperature.',
    'The Tsiolkovsky rocket equation was derived in 1903, 50 years before the first orbital rocket.',
    'Specific impulse (Isp) is measured in seconds — it represents how long 1 kg of fuel can produce 1 N of thrust.',
    'Max-Q on Falcon 9 occurs at about 12-13 km altitude, ~80 seconds after liftoff.',
    'Saturn V produced more thrust than 85 Hoover Dams generate electricity.',
    'Astronauts experience 3-4 G during ascent — equivalent to 3-4× their body weight pressing on them.',
    'The Space Shuttle\'s main engines were the most complex machines ever built per unit volume.',
    'A rocket\'s mass ratio is typically 10:1 — 90% of its launch mass is propellant.',
    'Orbital velocity at 400 km (ISS) is 7,660 m/s — Mach 22.',
  ];

  let _factIndex   = 0;
  let _factTimer   = null;
  let _currentPreset = 'falcon9';

  // ============================================================
  // INJECT HISTORICAL CARD
  // Shows under the preset buttons when a preset is selected
  // ============================================================

  function showRocketCard(presetName) {
    _currentPreset = presetName;
    const data = ROCKET_DATA[presetName];
    if (!data) return;

    let card = document.getElementById('rocket-history-card');
    if (!card) {
      card = document.createElement('div');
      card.id        = 'rocket-history-card';
      card.className = 'rocket-history-card';

      const presetList = document.getElementById('preset-list');
      presetList?.insertAdjacentElement('afterend', card);
    }

    card.style.borderLeftColor = data.color;
    card.innerHTML = `
      <div class="rhc-header">
        <span class="rhc-name" style="color:${data.color}">${data.name}</span>
        <span class="rhc-operator">${data.operator}</span>
      </div>
      <div class="rhc-rows">
        <div class="rhc-row"><span class="rhc-label">First flight</span><span class="rhc-val">${data.firstFlight}</span></div>
        <div class="rhc-row"><span class="rhc-label">Total flights</span><span class="rhc-val">${data.totalFlights}</span></div>
        <div class="rhc-row"><span class="rhc-label">Notable for</span><span class="rhc-val">${data.record}</span></div>
      </div>
      <div class="rhc-fact">💡 ${data.funFact}</div>
      <details class="rhc-details">
        <summary>Engine details</summary>
        <p>${data.engineFact}</p>
      </details>
    `;
  }

  // ============================================================
  // EXPLAIN THIS PANEL
  // Pops up when a mission event fires
  // ============================================================

  function explainEvent(eventType) {
    const data = EVENT_EXPLANATIONS[eventType];
    if (!data) return;

    let panel = document.getElementById('explain-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id        = 'explain-panel';
      panel.className = 'explain-panel';

      const eventsPanel = document.getElementById('events-panel');
      eventsPanel?.insertAdjacentElement('afterend', panel);
    }

    panel.innerHTML = `
      <div class="ep-header">
        <span class="ep-title">${data.title}</span>
        <button class="ep-close" onclick="document.getElementById('explain-panel').style.display='none'">×</button>
      </div>
      <p class="ep-summary">${data.summary}</p>
      <details class="ep-details">
        <summary>What's happening physically?</summary>
        <p class="ep-detail">${data.detail}</p>
      </details>
      <details class="ep-details">
        <summary>The engineering concept</summary>
        <p class="ep-detail">${data.concept}</p>
      </details>
    `;

    panel.style.display = 'flex';

    // Auto-hide after 12 seconds
    setTimeout(() => { if (panel) panel.style.display = 'none'; }, 12000);
  }

  // ============================================================
  // FUN FACTS TICKER
  // Rotates aerospace facts during flight
  // ============================================================

  function startFactTicker() {
    _showFact();
    _factTimer = setInterval(_showFact, 8000);
  }

  function stopFactTicker() {
    clearInterval(_factTimer);
    const ticker = document.getElementById('fact-ticker');
    if (ticker) ticker.style.display = 'none';
  }

  function _showFact() {
    let ticker = document.getElementById('fact-ticker');
    if (!ticker) {
      ticker = document.createElement('div');
      ticker.id        = 'fact-ticker';
      ticker.className = 'fact-ticker';
      document.querySelector('.footer')?.prepend(ticker);
    }

    ticker.style.display = 'block';
    ticker.style.opacity = '0';
    ticker.textContent   = '🛸 ' + FUN_FACTS[_factIndex % FUN_FACTS.length];
    _factIndex++;

    requestAnimationFrame(() => {
      ticker.style.transition = 'opacity 0.5s ease';
      ticker.style.opacity    = '1';
    });
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    // Show card for default preset
    showRocketCard('falcon9');

    // Hook into preset selection
    const originalSelectPreset = window.UI?.selectPreset;
    if (originalSelectPreset) {
      window.UI.selectPreset = function(name) {
        originalSelectPreset.call(window.UI, name);
        showRocketCard(name);
      };
    }
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return { init, showRocketCard, explainEvent, startFactTicker, stopFactTicker };

})();

window.__History = RocketHistory;
