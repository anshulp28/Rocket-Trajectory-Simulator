/**
 * audio.js — Sound Effects & Engine Audio
 * Day 17: Makes the simulator feel real with procedural audio.
 *
 * FEATURES:
 * 1. Engine rumble — low frequency noise that grows with thrust
 * 2. Mach 1 boom — sharp crack when breaking sound barrier
 * 3. Stage separation clunk — mechanical thud at burnout
 * 4. Orbit achievement chime — success sound
 * 5. Structural failure explosion — dramatic boom
 * 6. Countdown beeps — 3, 2, 1 before launch
 * 7. Master volume control
 * 8. Mute toggle
 *
 * HOW IT WORKS:
 * Uses the Web Audio API — built into every browser, no libraries needed.
 * All sounds are generated procedurally (mathematically) — no audio files.
 * This is called "synthesis" and is the same technique used in games.
 */

const Audio = (() => {

  let _ctx      = null;
  let _muted    = false;
  let _volume   = 0.4;
  let _engineNode = null;
  let _engineGain = null;
  let _running    = false;

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    _injectAudioControls();
  }

  function _getCtx() {
    if (!_ctx) {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  // ============================================================
  // ENGINE RUMBLE
  // Continuous low-frequency noise during powered flight
  // Pitch and volume scale with thrust level
  // ============================================================

  function startEngine() {
    if (_muted || _engineNode) return;
    const ctx = _getCtx();

    // Noise buffer (2 seconds, looped)
    const bufLen  = ctx.sampleRate * 2;
    const buffer  = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data    = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    // Source node (looped noise)
    _engineNode = ctx.createBufferSource();
    _engineNode.buffer = buffer;
    _engineNode.loop   = true;

    // Low-pass filter — makes it sound like a deep rumble
    const filter = ctx.createBiquadFilter();
    filter.type            = 'lowpass';
    filter.frequency.value = 120; // Hz — very low, bass-heavy
    filter.Q.value         = 2;

    // Gain (volume)
    _engineGain = ctx.createGain();
    _engineGain.gain.value = _muted ? 0 : _volume * 0.6;

    // Connect: source → filter → gain → output
    _engineNode.connect(filter);
    filter.connect(_engineGain);
    _engineGain.connect(ctx.destination);
    _engineNode.start();
    _running = true;
  }

  function stopEngine() {
    if (!_engineNode) return;
    try {
      _engineGain.gain.linearRampToValueAtTime(0, _getCtx().currentTime + 0.5);
      setTimeout(() => {
        try { _engineNode?.stop(); } catch(e) {}
        _engineNode = null;
        _engineGain = null;
      }, 600);
    } catch(e) {
      _engineNode = null;
    }
    _running = false;
  }

  function updateEngineIntensity(thrustFraction) {
    if (!_engineGain || _muted) return;
    const targetVol = _volume * 0.3 + thrustFraction * _volume * 0.4;
    _engineGain.gain.linearRampToValueAtTime(
      targetVol, _getCtx().currentTime + 0.1);
  }

  // ============================================================
  // ONE-SHOT SOUND EFFECTS
  // ============================================================

  /**
   * Play a synthesized sound effect.
   * @param {string} type - Sound type
   */
  function play(type) {
    if (_muted) return;
    const ctx = _getCtx();

    switch(type) {

      case 'countdown': {
        // Short beep
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type            = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(_volume * 0.3, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
        break;
      }

      case 'launch': {
        // Low rumble build-up
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(40, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 1.5);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(_volume * 0.5, ctx.currentTime + 0.3);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 1.5);
        break;
      }

      case 'mach1': {
        // Sharp crack — sonic boom
        const bufLen = Math.floor(ctx.sampleRate * 0.3);
        const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data   = buffer.getChannelData(0);
        for (let i = 0; i < bufLen; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
        }
        const src  = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer     = buffer;
        gain.gain.value = _volume * 0.8;
        src.connect(gain); gain.connect(ctx.destination);
        src.start();
        break;
      }

      case 'burnout': {
        // Engine cutoff thud + fading rumble
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type            = 'sawtooth';
        osc.frequency.value = 60;
        osc.frequency.linearRampToValueAtTime(20, ctx.currentTime + 0.8);
        gain.gain.setValueAtTime(_volume * 0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.8);
        break;
      }

      case 'orbit': {
        // Triumphant ascending chime
        [523, 659, 784, 1047].forEach((freq, i) => {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type            = 'sine';
          osc.frequency.value = freq;
          const t = ctx.currentTime + i * 0.15;
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(_volume * 0.4, t + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(t); osc.stop(t + 0.6);
        });
        break;
      }

      case 'failure': {
        // Explosion — low boom + noise burst
        const bufLen = Math.floor(ctx.sampleRate * 1.5);
        const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data   = buffer.getChannelData(0);
        for (let i = 0; i < bufLen; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.4));
        }
        const src    = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain   = ctx.createGain();
        src.buffer           = buffer;
        filter.type          = 'lowpass';
        filter.frequency.value = 200;
        gain.gain.value      = _volume;
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        src.start();

        // Additional low boom
        const osc  = ctx.createOscillator();
        const og   = ctx.createGain();
        osc.type            = 'sine';
        osc.frequency.value = 50;
        og.gain.setValueAtTime(_volume * 0.8, ctx.currentTime);
        og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
        osc.connect(og); og.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 1.0);
        break;
      }

      case 'karman': {
        // Whoosh — passing into space
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.5);
        osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 1.0);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(_volume * 0.3, ctx.currentTime + 0.3);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 1.0);
        break;
      }
    }
  }

  // ============================================================
  // COUNTDOWN SEQUENCE
  // Plays 3 beeps before launch
  // ============================================================

  function playCountdown(onComplete) {
    if (_muted) { if (onComplete) onComplete(); return; }
    let count = 3;
    const tick = () => {
      if (count > 0) {
        play('countdown');
        count--;
        setTimeout(tick, 1000);
      } else {
        play('launch');
        if (onComplete) onComplete();
      }
    };
    tick();
  }

  // ============================================================
  // VOLUME & MUTE CONTROLS
  // ============================================================

  function setVolume(vol) {
    _volume = Math.max(0, Math.min(1, vol));
    if (_engineGain) _engineGain.gain.value = _muted ? 0 : _volume * 0.6;
  }

  function toggleMute() {
    _muted = !_muted;
    if (_engineGain) _engineGain.gain.value = _muted ? 0 : _volume * 0.6;
    const btn = document.getElementById('audio-mute-btn');
    if (btn) btn.textContent = _muted ? '🔇' : '🔊';
    return _muted;
  }

  // ============================================================
  // INJECT AUDIO CONTROLS INTO HEADER
  // ============================================================

  function _injectAudioControls() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight || document.getElementById('audio-controls')) return;

    const wrap = document.createElement('div');
    wrap.id        = 'audio-controls';
    wrap.className = 'audio-controls';
    wrap.innerHTML = `
      <button class="btn btn-ghost" id="audio-mute-btn"
        onclick="window.__Audio?.toggleMute()"
        title="Toggle sound (sounds play on launch)">🔊</button>
      <input type="range" id="audio-vol" min="0" max="1" value="0.4"
        step="0.05" class="audio-vol-slider"
        oninput="window.__Audio?.setVolume(parseFloat(this.value))"
        title="Volume" style="width:50px;height:3px;accent-color:var(--blue);">
    `;

    const darkBtn = document.getElementById('btn-dark');
    darkBtn
      ? headerRight.insertBefore(wrap, darkBtn)
      : headerRight.appendChild(wrap);
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return {
    init,
    play,
    playCountdown,
    startEngine,
    stopEngine,
    updateEngineIntensity,
    toggleMute,
    setVolume,
  };

})();

window.__Audio = Audio;
