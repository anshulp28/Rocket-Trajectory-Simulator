/**
 * visualizer.js — Animated Rocket Visualization
 * Day 16: Draws a live animated rocket on a side-panel canvas.
 *
 * FEATURES:
 * 1. Animated rocket sprite — drawn with canvas shapes, no images needed
 * 2. Engine flame effect — animated exhaust that grows with thrust
 * 3. Altitude indicator — rocket rises on screen as altitude increases
 * 4. Atmosphere layers — color gradient showing troposphere, stratosphere, space
 * 5. Earth curvature — curved horizon at the bottom
 * 6. Stars — appear as rocket climbs above atmosphere
 * 7. Stage separation visual — rocket body separates at burnout
 * 8. Smoke trail — particle trail behind the rocket
 * 9. Speed lines — motion blur effect at high velocity
 * 10. Orbit ring — appears when orbit is achieved
 */

const Visualizer = (() => {

  let _canvas  = null;
  let _ctx     = null;
  let _raf     = null;
  let _running = false;
  let _particles = [];
  let _stars     = [];
  let _frame     = 0;

  // Current rocket state for animation
  let _state = {
    altitude:    0,
    speed:       0,
    gForce:      0,
    burnout:     false,
    failed:      false,
    orbited:     false,
    fuelPct:     100,
    status:      'READY'
  };

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    _injectVisualizerPanel();
    _canvas = document.getElementById('rocket-viz-canvas');
    if (!_canvas) return;
    _ctx = _canvas.getContext('2d');
    _generateStars(80);
    _resize();
    window.addEventListener('resize', _resize, { passive: true });
    _startLoop();
  }

  function _injectVisualizerPanel() {
    const graphWrap = document.querySelector('.graph-wrap');
    if (!graphWrap || document.getElementById('rocket-viz')) return;

    const panel = document.createElement('div');
    panel.id        = 'rocket-viz';
    panel.className = 'rocket-viz-panel';
    panel.innerHTML = `
      <canvas id="rocket-viz-canvas" aria-label="Animated rocket visualization"></canvas>
      <div class="viz-overlay">
        <span class="viz-label" id="viz-status">Ready for launch</span>
      </div>
    `;

    graphWrap.insertAdjacentElement('afterend', panel);
  }

  function _resize() {
    if (!_canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W   = _canvas.clientWidth;
    const H   = _canvas.clientHeight;
    _canvas.width  = Math.round(W * dpr);
    _canvas.height = Math.round(H * dpr);
    _ctx.scale(dpr, dpr);
  }

  // ============================================================
  // STAR GENERATION
  // ============================================================

  function _generateStars(count) {
    _stars = Array.from({ length: count }, () => ({
      x:    Math.random(),
      y:    Math.random() * 0.7,
      size: 0.5 + Math.random() * 1.5,
      twinkle: Math.random() * Math.PI * 2
    }));
  }

  // ============================================================
  // MAIN DRAW LOOP
  // ============================================================

  function _startLoop() {
    _running = true;
    const loop = () => {
      if (!_running) return;
      _frame++;
      _draw();
      _raf = requestAnimationFrame(loop);
    };
    _raf = requestAnimationFrame(loop);
  }

  function stop() {
    _running = false;
    cancelAnimationFrame(_raf);
  }

  // ============================================================
  // MAIN DRAW FUNCTION
  // ============================================================

  function _draw() {
    if (!_ctx || !_canvas) return;
    const W = _canvas.clientWidth;
    const H = _canvas.clientHeight;

    _ctx.clearRect(0, 0, W, H);

    // How high up are we (0 = ground, 1 = space)
    const altFrac = Math.min(1, _state.altitude / 150000);

    // ---- Sky gradient (changes with altitude) ----
    _drawSky(W, H, altFrac);

    // ---- Stars (fade in above 50km) ----
    _drawStars(W, H, altFrac);

    // ---- Earth horizon ----
    _drawEarth(W, H, altFrac);

    // ---- Atmosphere layers label ----
    _drawAtmosphereLayers(W, H, altFrac);

    // ---- Smoke particles ----
    _updateParticles(W, H);
    _drawParticles();

    // ---- Rocket ----
    const rocketY = H * 0.75 - altFrac * H * 0.55;
    const rocketX = W / 2;

    if (!_state.failed) {
      _drawRocket(rocketX, rocketY, W, H);
    } else {
      _drawExplosion(rocketX, rocketY, W, H);
    }

    // ---- Orbit ring ----
    if (_state.orbited) {
      _drawOrbitRing(W, H);
    }

    // ---- Speed lines ----
    if (_state.speed > 1000 && !_state.burnout) {
      _drawSpeedLines(W, H, rocketY);
    }

    // ---- Status label ----
    _updateStatusLabel();
  }

  // ============================================================
  // SKY GRADIENT
  // ============================================================

  function _drawSky(W, H, altFrac) {
    const grad = _ctx.createLinearGradient(0, 0, 0, H);

    if (altFrac < 0.3) {
      // Low altitude: blue sky
      const t = altFrac / 0.3;
      grad.addColorStop(0, `rgb(${lerp(30,10,t)}, ${lerp(80,20,t)}, ${lerp(180,60,t)})`);
      grad.addColorStop(1, `rgb(${lerp(100,30,t)}, ${lerp(150,50,t)}, ${lerp(220,80,t)})`);
    } else if (altFrac < 0.7) {
      // Mid altitude: dark blue to black
      const t = (altFrac - 0.3) / 0.4;
      grad.addColorStop(0, `rgb(${lerp(10,5,t)}, ${lerp(20,5,t)}, ${lerp(60,10,t)})`);
      grad.addColorStop(1, `rgb(${lerp(30,10,t)}, ${lerp(50,10,t)}, ${lerp(80,20,t)})`);
    } else {
      // Space: pure black
      grad.addColorStop(0, '#05050a');
      grad.addColorStop(1, '#0a0a12');
    }

    _ctx.fillStyle = grad;
    _ctx.fillRect(0, 0, W, H);
  }

  function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

  // ============================================================
  // STARS
  // ============================================================

  function _drawStars(W, H, altFrac) {
    const opacity = Math.max(0, (altFrac - 0.3) / 0.4);
    if (opacity <= 0) return;

    _stars.forEach(s => {
      s.twinkle += 0.05;
      const twinkleOpacity = opacity * (0.7 + 0.3 * Math.sin(s.twinkle));
      _ctx.beginPath();
      _ctx.arc(s.x * W, s.y * H, s.size, 0, Math.PI * 2);
      _ctx.fillStyle = `rgba(255, 255, 255, ${twinkleOpacity})`;
      _ctx.fill();
    });
  }

  // ============================================================
  // EARTH HORIZON
  // ============================================================

  function _drawEarth(W, H, altFrac) {
    const horizonY = H * (0.85 - altFrac * 0.3);
    const curveAmt = W * (0.3 + altFrac * 0.5);

    // Earth fill
    const earthGrad = _ctx.createLinearGradient(0, horizonY, 0, H);
    earthGrad.addColorStop(0, '#1a4a2a');
    earthGrad.addColorStop(0.3, '#0e2d1a');
    earthGrad.addColorStop(1, '#081508');
    _ctx.fillStyle = earthGrad;

    _ctx.beginPath();
    _ctx.moveTo(0, horizonY + 20);
    _ctx.quadraticCurveTo(W / 2, horizonY - curveAmt * 0.1, W, horizonY + 20);
    _ctx.lineTo(W, H);
    _ctx.lineTo(0, H);
    _ctx.closePath();
    _ctx.fill();

    // Atmosphere glow on horizon
    const glowGrad = _ctx.createLinearGradient(0, horizonY - 20, 0, horizonY + 30);
    glowGrad.addColorStop(0, 'rgba(100, 180, 255, 0)');
    glowGrad.addColorStop(0.5, `rgba(100, 180, 255, ${0.3 * (1 - altFrac)})`);
    glowGrad.addColorStop(1, 'rgba(100, 180, 255, 0)');
    _ctx.fillStyle = glowGrad;
    _ctx.fillRect(0, horizonY - 20, W, 50);
  }

  // ============================================================
  // ATMOSPHERE LAYER LABELS
  // ============================================================

  function _drawAtmosphereLayers(W, H, altFrac) {
    const layers = [
      { alt: 0,      label: 'Sea level',    frac: 0 },
      { alt: 11000,  label: 'Troposphere',  frac: 11/150 },
      { alt: 50000,  label: 'Stratosphere', frac: 50/150 },
      { alt: 100000, label: 'Kármán line',  frac: 100/150 },
    ];

    _ctx.font      = '9px -apple-system, sans-serif';
    _ctx.textAlign = 'left';

    layers.forEach(layer => {
      if (layer.frac > altFrac + 0.2) return;
      const screenFrac = (layer.frac - (altFrac - 0.3)) / 0.6;
      const y = H * (1 - screenFrac * 0.7);
      if (y < 0 || y > H) return;

      _ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      _ctx.lineWidth   = 0.5;
      _ctx.setLineDash([3, 3]);
      _ctx.beginPath();
      _ctx.moveTo(0, y);
      _ctx.lineTo(W, y);
      _ctx.stroke();
      _ctx.setLineDash([]);

      _ctx.fillStyle = 'rgba(255,255,255,0.4)';
      _ctx.fillText(layer.label, 4, y - 3);
    });
  }

  // ============================================================
  // ROCKET DRAWING
  // ============================================================

  function _drawRocket(x, y, W, H) {
    const scale   = Math.min(W, H) / 300;
    const height  = 60 * scale;
    const width   = 14 * scale;
    const powered = !_state.burnout && _state.status === 'POWERED_FLIGHT';

    _ctx.save();
    _ctx.translate(x, y);

    // Engine flame
    if (powered) {
      _drawFlame(width, height, scale);
      // Spawn smoke particles
      if (_frame % 2 === 0) {
        _spawnParticle(x, y + height / 2 + 10 * scale);
      }
    }

    // Rocket body
    const bodyGrad = _ctx.createLinearGradient(-width/2, 0, width/2, 0);
    bodyGrad.addColorStop(0,   '#b0b0b0');
    bodyGrad.addColorStop(0.3, '#f0f0f0');
    bodyGrad.addColorStop(0.7, '#d0d0d0');
    bodyGrad.addColorStop(1,   '#808080');
    _ctx.fillStyle = bodyGrad;
    _ctx.beginPath();
    _ctx.roundRect(-width/2, -height/2, width, height, 3);
    _ctx.fill();

    // Nose cone
    _ctx.fillStyle = '#e0e0e0';
    _ctx.beginPath();
    _ctx.moveTo(-width/2, -height/2);
    _ctx.lineTo(0, -height/2 - height * 0.3);
    _ctx.lineTo(width/2, -height/2);
    _ctx.closePath();
    _ctx.fill();

    // Fins
    const finH = height * 0.25;
    const finW = width * 0.8;
    [[-1], [1]].forEach(([dir]) => {
      _ctx.fillStyle = '#a0a0a0';
      _ctx.beginPath();
      _ctx.moveTo(dir * width/2, height/2);
      _ctx.lineTo(dir * (width/2 + finW), height/2 + finH * 0.3);
      _ctx.lineTo(dir * width/2, height/2 - finH);
      _ctx.closePath();
      _ctx.fill();
    });

    // Engine nozzle
    _ctx.fillStyle = '#606060';
    _ctx.beginPath();
    _ctx.moveTo(-width*0.4, height/2);
    _ctx.lineTo(-width*0.5, height/2 + height*0.12);
    _ctx.lineTo(width*0.5, height/2 + height*0.12);
    _ctx.lineTo(width*0.4, height/2);
    _ctx.closePath();
    _ctx.fill();

    // Window
    _ctx.beginPath();
    _ctx.arc(0, -height * 0.1, width * 0.25, 0, Math.PI * 2);
    _ctx.fillStyle = 'rgba(100, 180, 255, 0.6)';
    _ctx.fill();
    _ctx.strokeStyle = '#888';
    _ctx.lineWidth = 1;
    _ctx.stroke();

    _ctx.restore();
  }

  // ============================================================
  // ENGINE FLAME
  // ============================================================

  function _drawFlame(width, height, scale) {
    const flameH = (30 + Math.sin(_frame * 0.3) * 8) * scale;
    const flameW = width * (0.6 + Math.sin(_frame * 0.2) * 0.1);

    const flameGrad = _ctx.createLinearGradient(0, height/2, 0, height/2 + flameH);
    flameGrad.addColorStop(0,   'rgba(255, 255, 200, 0.95)');
    flameGrad.addColorStop(0.3, 'rgba(255, 150, 50, 0.8)');
    flameGrad.addColorStop(0.7, 'rgba(255, 80, 20, 0.6)');
    flameGrad.addColorStop(1,   'rgba(255, 50, 0, 0)');

    _ctx.fillStyle = flameGrad;
    _ctx.beginPath();
    _ctx.ellipse(0, height/2 + flameH/2, flameW/2, flameH/2, 0, 0, Math.PI * 2);
    _ctx.fill();

    // Inner bright core
    const coreGrad = _ctx.createLinearGradient(0, height/2, 0, height/2 + flameH * 0.4);
    coreGrad.addColorStop(0,   'rgba(255, 255, 255, 0.9)');
    coreGrad.addColorStop(1,   'rgba(255, 200, 100, 0)');
    _ctx.fillStyle = coreGrad;
    _ctx.beginPath();
    _ctx.ellipse(0, height/2 + flameH * 0.15, flameW * 0.25, flameH * 0.3, 0, 0, Math.PI * 2);
    _ctx.fill();
  }

  // ============================================================
  // SMOKE PARTICLES
  // ============================================================

  function _spawnParticle(x, y) {
    _particles.push({
      x, y,
      vx:   (Math.random() - 0.5) * 2,
      vy:   2 + Math.random() * 2,
      life: 40 + Math.random() * 20,
      maxLife: 60,
      size: 3 + Math.random() * 4
    });
    if (_particles.length > 60) _particles.shift();
  }

  function _updateParticles(W, H) {
    _particles = _particles
      .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 1, size: p.size * 1.03 }))
      .filter(p => p.life > 0 && p.y < H + 20);
  }

  function _drawParticles() {
    _particles.forEach(p => {
      const alpha = (p.life / p.maxLife) * 0.4;
      _ctx.beginPath();
      _ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      _ctx.fillStyle = `rgba(180, 180, 180, ${alpha})`;
      _ctx.fill();
    });
  }

  // ============================================================
  // SPEED LINES
  // ============================================================

  function _drawSpeedLines(W, H, rocketY) {
    const count    = Math.min(12, Math.floor(_state.speed / 200));
    const opacity  = Math.min(0.3, _state.speed / 5000);

    for (let i = 0; i < count; i++) {
      const x   = Math.random() * W;
      const len = 10 + Math.random() * 20;
      _ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
      _ctx.lineWidth   = 0.5;
      _ctx.beginPath();
      _ctx.moveTo(x, rocketY - len);
      _ctx.lineTo(x, rocketY + len * 2);
      _ctx.stroke();
    }
  }

  // ============================================================
  // EXPLOSION (structural failure)
  // ============================================================

  function _drawExplosion(x, y, W, H) {
    const t = (_frame % 60) / 60;
    for (let i = 0; i < 8; i++) {
      const angle  = (i / 8) * Math.PI * 2 + t;
      const radius = 20 + t * 30;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      _ctx.beginPath();
      _ctx.arc(px, py, 4 + Math.random() * 4, 0, Math.PI * 2);
      _ctx.fillStyle = `rgba(255, ${Math.floor(Math.random() * 150)}, 0, ${1 - t})`;
      _ctx.fill();
    }
  }

  // ============================================================
  // ORBIT RING
  // ============================================================

  function _drawOrbitRing(W, H) {
    const cx = W / 2, cy = H * 0.3;
    const rx = W * 0.35, ry = H * 0.08;

    _ctx.save();
    _ctx.strokeStyle = 'rgba(100, 200, 100, 0.4)';
    _ctx.lineWidth   = 1.5;
    _ctx.setLineDash([5, 5]);
    _ctx.beginPath();
    _ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    _ctx.stroke();
    _ctx.setLineDash([]);

    // Orbiting dot
    const angle = (_frame * 0.02) % (Math.PI * 2);
    const dotX  = cx + Math.cos(angle) * rx;
    const dotY  = cy + Math.sin(angle) * ry;
    _ctx.beginPath();
    _ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    _ctx.fillStyle = '#64c846';
    _ctx.fill();
    _ctx.restore();
  }

  // ============================================================
  // STATUS LABEL
  // ============================================================

  function _updateStatusLabel() {
    const el = document.getElementById('viz-status');
    if (!el) return;

    const labels = {
      READY:              'Ready for launch',
      POWERED_FLIGHT:     `↑ ${(_state.altitude/1000).toFixed(1)} km · ${Math.round(_state.speed)} m/s`,
      COASTING:           `↑ Coasting · ${(_state.altitude/1000).toFixed(1)} km`,
      ORBIT_ACHIEVED:     '⭐ Orbit achieved!',
      STRUCTURAL_FAILURE: '💥 Vehicle lost',
      LANDED:             `🌍 Max alt: ${(_state.altitude/1000).toFixed(1)} km`,
    };

    el.textContent = labels[_state.status] || _state.status;
  }

  // ============================================================
  // STATE UPDATE (called from ui.js onSimTick)
  // ============================================================

  function updateState(rocket) {
    if (!rocket) return;
    _state = {
      altitude: rocket.altitude   || 0,
      speed:    rocket.speed      || 0,
      gForce:   rocket.gForce     || 0,
      burnout:  rocket.burnout    || false,
      failed:   rocket.failed     || false,
      orbited:  rocket.orbited    || false,
      status:   rocket.status     || 'READY',
    };
  }

  function reset() {
    _state     = { altitude: 0, speed: 0, gForce: 0, burnout: false, failed: false, orbited: false, status: 'READY' };
    _particles = [];
  }

  return { init, updateState, reset, stop };

})();

window.__Visualizer = Visualizer;
