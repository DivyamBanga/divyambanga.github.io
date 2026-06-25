document.addEventListener('DOMContentLoaded', () => {
  /* ===== Theme toggle (system default, manual override persisted) ===== */
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  const icon = toggle.querySelector('i');

  const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effective = () => root.getAttribute('data-theme') || (systemDark() ? 'dark' : 'light');

  function syncIcon() {
    const dark = effective() === 'dark';
    icon.className = dark ? 'fas fa-sun' : 'fas fa-moon';
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }

  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  syncIcon();

  toggle.addEventListener('click', () => {
    const next = effective() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    syncIcon();
  });
});
