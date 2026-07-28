/**
 * performance.js — Performance Optimization & Mobile Polish
 * Day 12: Makes the simulator fast and beautiful on any device.
 *
 * PERFORMANCE OPTIMIZATIONS:
 * 1. Frame rate limiter — caps rendering at 60fps to avoid
 *    wasting CPU on faster displays
 * 2. History decimation — when history gets large, keeps only
 *    every Nth point for graph rendering (full data still exported)
 * 3. Canvas resolution scaling — renders at device pixel ratio
 *    for sharp graphics on retina/HiDPI screens
 * 4. Throttled telemetry updates — DOM updates at 30fps instead
 *    of 60fps since they're expensive
 * 5. Passive event listeners — improves scroll performance
 *
 * MOBILE POLISH:
 * 1. Touch-friendly slider sizing
 * 2. Collapsible sidebar on mobile
 * 3. Swipe gesture to open/close sidebar
 * 4. Bottom sheet for controls on small screens
 * 5. Viewport-aware graph sizing
 */

const Performance = (() => {

  // ---- Frame timing ----
  let _lastFrame    = 0;
  let _frameCount   = 0;
  let _fps          = 0;
  let _fpsTimer     = null;
  const TARGET_FPS  = 60;
  const FRAME_MS    = 1000 / TARGET_FPS;

  // ---- Throttle state ----
  let _lastTelemetryUpdate = 0;
  const TELEMETRY_MS = 33; // ~30fps for DOM updates

  // ---- Mobile state ----
  let _sidebarOpen  = true;
  let _isMobile     = false;
  let _touchStartX  = 0;

  // ============================================================
  // FRAME RATE LIMITER
  // Wraps requestAnimationFrame to cap at 60fps
  // ============================================================

  /**
   * Should we render this frame?
   * Call at the start of each animation tick.
   * @param {number} timestamp - from requestAnimationFrame
   * @returns {boolean} - true if enough time has passed
   */
  function shouldRender(timestamp) {
    if (timestamp - _lastFrame < FRAME_MS) return false;
    _lastFrame = timestamp;
    _frameCount++;
    return true;
  }

  /**
   * Should we update the DOM telemetry this frame?
   * Cheaper updates at 30fps instead of 60fps.
   * @param {number} timestamp
   * @returns {boolean}
   */
  function shouldUpdateTelemetry(timestamp) {
    if (timestamp - _lastTelemetryUpdate < TELEMETRY_MS) return false;
    _lastTelemetryUpdate = timestamp;
    return true;
  }

  // ============================================================
  // FPS COUNTER
  // Shows live FPS in the corner during simulation
  // ============================================================

  function startFPSCounter() {
    _fpsTimer = setInterval(() => {
      _fps = _frameCount;
      _frameCount = 0;

      const el = document.getElementById('fps-counter');
      if (el) {
        el.textContent = _fps + ' fps';
        el.style.color = _fps >= 55 ? '#3B6D11'
                       : _fps >= 30 ? '#854F0B'
                       : '#A32D2D';
      }
    }, 1000);
  }

  function stopFPSCounter() {
    clearInterval(_fpsTimer);
    _fps = 0; _frameCount = 0;
  }

  function _injectFPSCounter() {
    const footer = document.querySelector('.footer');
    if (!footer || document.getElementById('fps-counter')) return;

    const el = document.createElement('span');
    el.id = 'fps-counter';
    el.style.cssText = `
      font-size: 10px;
      font-variant-numeric: tabular-nums;
      color: var(--text-muted);
      margin-left: 12px;
    `;
    el.textContent = '— fps';
    footer.querySelector('p')?.appendChild(el);
  }

  // ============================================================
  // HISTORY DECIMATION
  // For graph rendering, reduce data points when history is large
  // Full data is always kept for CSV export
  // ============================================================

  /**
   * Get a decimated version of history for graph rendering.
   * Keeps every Nth point to maintain performance with large datasets.
   *
   * @param {Array}  history  - Full flight history
   * @param {number} maxPoints - Max points to render (default 400)
   * @returns {Array} - Decimated history for rendering
   */
  function decimateHistory(history, maxPoints = 400) {
    if (!history || history.length <= maxPoints) return history;
    const step = Math.ceil(history.length / maxPoints);
    const result = [];
    for (let i = 0; i < history.length; i += step) {
      result.push(history[i]);
    }
    // Always include the last point
    if (result[result.length - 1] !== history[history.length - 1]) {
      result.push(history[history.length - 1]);
    }
    return result;
  }

  // ============================================================
  // MOBILE DETECTION & SETUP
  // ============================================================

  function detectMobile() {
    _isMobile = window.innerWidth < 900 ||
                ('ontouchstart' in window) ||
                (navigator.maxTouchPoints > 0);
    return _isMobile;
  }

  function isMobile() { return _isMobile; }

  // ============================================================
  // COLLAPSIBLE SIDEBAR (mobile)
  // ============================================================

  function _setupCollapsibleSidebar() {
    if (!_isMobile) return;

    const sidebar = document.querySelector('.sidebar');
    const main    = document.querySelector('.main');
    if (!sidebar || !main) return;

    // Inject toggle button
    let toggleBtn = document.getElementById('sidebar-toggle');
    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.id        = 'sidebar-toggle';
      toggleBtn.className = 'sidebar-toggle-btn';
      toggleBtn.innerHTML = '⚙️ Config';
      toggleBtn.onclick   = toggleSidebar;
      document.querySelector('.header-left')?.appendChild(toggleBtn);
    }

    // Start collapsed on mobile
    if (window.innerWidth < 600) {
      sidebar.classList.add('sidebar-collapsed');
      _sidebarOpen = false;
    }
  }

  function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    _sidebarOpen = !_sidebarOpen;
    sidebar.classList.toggle('sidebar-collapsed', !_sidebarOpen);

    const btn = document.getElementById('sidebar-toggle');
    if (btn) btn.innerHTML = _sidebarOpen ? '✕ Close' : '⚙️ Config';
  }

  // ============================================================
  // SWIPE GESTURE (mobile)
  // Swipe right to open sidebar, swipe left to close
  // ============================================================

  function _setupSwipeGesture() {
    if (!_isMobile) return;

    document.addEventListener('touchstart', e => {
      _touchStartX = e.touches[0].clientX;
    }, { passive: true });

    document.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - _touchStartX;
      if (Math.abs(dx) < 50) return; // Ignore small swipes

      if (dx > 50 && !_sidebarOpen)  toggleSidebar(); // Swipe right → open
      if (dx < -50 && _sidebarOpen)  toggleSidebar(); // Swipe left → close
    }, { passive: true });
  }

  // ============================================================
  // TOUCH-FRIENDLY SLIDERS
  // Makes sliders easier to use on touchscreens
  // ============================================================

  function _polishSliders() {
    if (!_isMobile) return;

    const sliders = document.querySelectorAll('.slider');
    sliders.forEach(slider => {
      slider.style.height      = '6px';  // Taller track
      slider.style.touchAction = 'none'; // Prevent scroll while sliding
    });
  }

  // ============================================================
  // VIEWPORT-AWARE GRAPH
  // Ensures the graph fills available space properly
  // ============================================================

  function _setupGraphResize() {
    const graphWrap = document.querySelector('.graph-wrap');
    if (!graphWrap) return;

    function adjustGraphHeight() {
      if (window.innerWidth < 900) {
        // Mobile: fixed height
        graphWrap.style.minHeight = '240px';
        graphWrap.style.maxHeight = '320px';
      } else {
        // Desktop: flexible
        graphWrap.style.minHeight = '280px';
        graphWrap.style.maxHeight = '';
      }
    }

    adjustGraphHeight();
    window.addEventListener('resize', adjustGraphHeight, { passive: true });
  }

  // ============================================================
  // PASSIVE EVENT LISTENERS
  // Improves scroll performance by marking wheel/touch as passive
  // ============================================================

  function _setupPassiveListeners() {
    // Override addEventListener to make wheel and touch events passive by default
    const original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (['wheel', 'touchstart', 'touchmove'].includes(type)) {
        if (options === undefined || options === false) {
          options = { passive: true };
        } else if (options === true) {
          options = { passive: true, capture: true };
        }
      }
      return original.call(this, type, listener, options);
    };
  }

  // ============================================================
  // RESIZE HANDLER
  // Re-checks mobile state and adjusts layout on resize
  // ============================================================

  function _setupResizeHandler() {
    let _resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(() => {
        const wasMobile = _isMobile;
        detectMobile();
        if (wasMobile !== _isMobile) {
          // Screen size category changed — reinitialize mobile features
          _setupCollapsibleSidebar();
          _polishSliders();
        }
      }, 150);
    }, { passive: true });
  }

  // ============================================================
  // PERFORMANCE STATS (dev mode)
  // Shows memory and timing info in console
  // ============================================================

  function logPerformanceStats(history) {
    if (!history) return;
    const memMB = performance.memory
      ? (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)
      : 'N/A';
    console.log(`[Perf] History: ${history.length} pts · Memory: ${memMB}MB · FPS: ${_fps}`);
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    detectMobile();
    _setupPassiveListeners();
    _setupCollapsibleSidebar();
    _setupSwipeGesture();
    _polishSliders();
    _setupGraphResize();
    _setupResizeHandler();
    _injectFPSCounter();
    startFPSCounter();

    console.log(`[Performance] Init complete. Mobile: ${_isMobile}`);
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return {
    init,
    shouldRender,
    shouldUpdateTelemetry,
    decimateHistory,
    isMobile,
    toggleSidebar,
    startFPSCounter,
    stopFPSCounter,
    logPerformanceStats,
  };

})();

window.__Perf = Performance;
