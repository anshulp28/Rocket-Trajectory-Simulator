/**
 * theme.js — Dark Mode & UI Theme Polish
 * Day 15: Makes the simulator look stunning in both light and dark mode.
 */

const Theme = (() => {

  let _isDark = false;

  function init() {
    _detectSystemPreference();
    _loadSavedPreference();
    _applyTheme(_isDark);
    _setupScrollEffect();
    _setupMicroAnimations();
    _setupLaunchButtonPulse();
    _hookDarkModeButton();
    _setupTransitions();
    updateAllSliderFills();
  }

  function _detectSystemPreference() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      _isDark = true;
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('rocket-theme')) {
        _isDark = e.matches;
        _applyTheme(_isDark);
      }
    });
  }

  function _loadSavedPreference() {
    const saved = localStorage.getItem('rocket-theme');
    if (saved === 'dark')  _isDark = true;
    if (saved === 'light') _isDark = false;
  }

  function _applyTheme(dark) {
    document.body.classList.toggle('dark', dark);
    const btn = document.getElementById('btn-dark');
    if (btn) btn.textContent = dark ? '☀️' : '🌙';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#18181a' : '#f5f5f4';
  }

  function toggle() {
    _isDark = !_isDark;
    _applyTheme(_isDark);
    localStorage.setItem('rocket-theme', _isDark ? 'dark' : 'light');
    updateAllSliderFills();
  }

  function isDark() { return _isDark; }

  function _setupTransitions() {
    const style = document.createElement('style');
    style.textContent = `
      body, .header, .sidebar, .content, .telem-card,
      .mission-card, .status-bar, .events-panel, .footer,
      .preset-btn, .btn, .graph-wrap, .rocket-history-card,
      .explain-panel, .budget-bar, .mission-summary {
        transition: background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease !important;
      }
    `;
    document.head.appendChild(style);
  }

  function _setupScrollEffect() {
    const header = document.querySelector('.header');
    if (!header) return;
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY > 10;
      header.style.backdropFilter = scrolled ? 'blur(8px)' : 'none';
      header.style.backgroundColor = scrolled
        ? (_isDark ? 'rgba(24,24,26,0.85)' : 'rgba(255,255,255,0.85)') : '';
    }, { passive: true });
  }

  function _setupLaunchButtonPulse() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes launchPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(24,95,165,0.4); }
        50%       { box-shadow: 0 0 0 8px rgba(24,95,165,0); }
      }
      .btn-launch:not(.abort):not(:disabled) {
        animation: launchPulse 2.5s ease-in-out infinite;
      }
      .btn-launch.abort { animation: none; }
      .btn-launch:not(.abort):not(:disabled):hover {
        filter: brightness(1.1);
      }
    `;
    document.head.appendChild(style);
  }

  function _setupMicroAnimations() {
    const style = document.createElement('style');
    style.textContent = `
      .preset-btn {
        transition: transform 0.15s ease, background-color 0.15s ease,
                    border-color 0.15s ease, box-shadow 0.15s ease !important;
      }
      .preset-btn:hover:not(.active) {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      }
      .preset-btn.active {
        box-shadow: 0 0 0 2px rgba(24,95,165,0.2);
      }
      .telem-card:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      }
      .graph-wrap:hover {
        box-shadow: 0 0 0 2px rgba(24,95,165,0.15);
      }
      @keyframes badgePop {
        0%   { transform: scale(0.8); opacity: 0; }
        60%  { transform: scale(1.05); }
        100% { transform: scale(1); opacity: 1; }
      }
      .event-badge { animation: badgePop 0.3s ease forwards; }
      body.dark .graph-wrap { background: #1e1e20; }
      body.dark canvas { filter: brightness(0.95); }
      .btn:focus-visible, .slider:focus-visible, .preset-btn:focus-visible {
        outline: 2px solid var(--blue);
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  function _hookDarkModeButton() {
    const btn = document.getElementById('btn-dark');
    if (!btn) return;
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => toggle());
  }

  function updateSliderFill(sliderId) {
    const slider = document.getElementById(sliderId);
    if (!slider) return;
    const pct = ((parseFloat(slider.value) - parseFloat(slider.min)) /
                 (parseFloat(slider.max) - parseFloat(slider.min))) * 100;
    slider.style.background =
      `linear-gradient(to right, var(--blue) ${pct}%, var(--border) ${pct}%)`;
  }

  function updateAllSliderFills() {
    ['sl-thrust','sl-fuel','sl-dry','sl-payload','sl-isp','sl-speed'].forEach(updateSliderFill);
  }

  return { init, toggle, isDark, updateSliderFill, updateAllSliderFills };

})();

window.__Theme = Theme;
