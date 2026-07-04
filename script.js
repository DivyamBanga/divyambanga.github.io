/* Console greeting for the curious devs who pop open DevTools. */
console.log("%c👋 Hey, curious dev — this is vanilla HTML, CSS & JS. Press ⌘K.", "font:600 13px ui-sans-serif,system-ui");

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;

  /* ===== Theme (dock button, persisted, follows system by default) ===== */
  const themeBtn = document.getElementById('themeBtn');
  const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effectiveTheme = () => root.getAttribute('data-theme') || (systemDark() ? 'dark' : 'light');

  // Keep browser chrome in sync only when the user overrides the system theme;
  // otherwise the media-based <meta name="theme-color"> tags handle it.
  function setMetaThemeColor() {
    const override = root.getAttribute('data-theme');
    let m = document.getElementById('tc-dynamic');
    if (!override) { if (m) m.remove(); return; }
    if (!m) {
      m = document.createElement('meta');
      m.name = 'theme-color';
      m.id = 'tc-dynamic';
      document.head.appendChild(m);
    }
    m.content = override === 'dark' ? '#0a0c10' : '#e9edf3';
  }
  setMetaThemeColor();

  function toggleTheme() {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    setMetaThemeColor();
  }
  themeBtn.addEventListener('click', toggleTheme);

  /* ===== Local time (in the island detail) ===== */
  const clock = document.getElementById('localtime');
  function tick() {
    clock.textContent = new Intl.DateTimeFormat('en-CA', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
    }).format(new Date());
  }
  tick();
  setInterval(tick, 30000);

  /* ===== Dynamic Island expand/collapse ===== */
  const island = document.getElementById('island');
  island.addEventListener('click', () => {
    const open = island.classList.toggle('is-open');
    island.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (island.classList.contains('is-open') && !island.contains(e.target)) {
      island.classList.remove('is-open');
      island.setAttribute('aria-expanded', 'false');
    }
  });

  /* ===== Project case-study sheets ===== */
  const sheet = document.getElementById('sheet');
  const sheetBody = document.getElementById('sheetBody');
  const scrim = document.getElementById('scrim');
  let lastFocus = null;

  function openSheet(id) {
    const tpl = document.getElementById('sheet-' + id);
    if (!tpl) return;
    lastFocus = document.activeElement;
    sheetBody.replaceChildren(tpl.content.cloneNode(true));
    sheet.hidden = false;
    scrim.hidden = false;
    document.body.classList.add('is-modal');
    // Double rAF so the browser paints the hidden->shown state before transitioning.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      sheet.classList.add('is-open');
      scrim.classList.add('is-visible');
    }));
    document.getElementById('sheetClose').focus();
  }

  function closeSheet() {
    sheet.classList.remove('is-open');
    scrim.classList.remove('is-visible');
    document.body.classList.remove('is-modal');
    setTimeout(() => { sheet.hidden = true; scrim.hidden = true; }, 500);
    if (lastFocus) lastFocus.focus();
  }

  document.querySelectorAll('[data-sheet]').forEach((btn) => {
    btn.addEventListener('click', () => openSheet(btn.dataset.sheet));
  });
  document.getElementById('sheetClose').addEventListener('click', closeSheet);
  scrim.addEventListener('click', () => {
    if (!sheet.hidden) closeSheet();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheet.hidden) closeSheet();
  });

  /* ===== Dock magnification (pointer devices only) ===== */
  const dock = document.getElementById('dock');
  const dockItems = Array.from(dock.querySelectorAll('.dock__item'));
  const canMagnify =
    window.matchMedia('(pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (canMagnify) {
    const MAX_SCALE = 0.45;   // extra scale at cursor center
    const RANGE = 110;        // px falloff radius

    dock.addEventListener('mousemove', (e) => {
      for (const item of dockItems) {
        const r = item.getBoundingClientRect();
        const dist = Math.abs(e.clientX - (r.left + r.width / 2));
        const boost = Math.max(0, 1 - dist / RANGE);
        const s = 1 + MAX_SCALE * boost * boost;
        item.style.transform = 'translateY(' + (-8 * boost * boost).toFixed(2) + 'px) scale(' + s.toFixed(3) + ')';
      }
    });
    dock.addEventListener('mouseleave', () => {
      for (const item of dockItems) item.style.transform = '';
    });
  }
});
