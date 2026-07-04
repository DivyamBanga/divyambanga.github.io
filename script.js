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

  /* ===== Spotlight palette (⌘K / Ctrl+K) ===== */
  const palette = document.getElementById('palette');
  const paletteInput = document.getElementById('paletteInput');
  const paletteList = document.getElementById('paletteList');

  const commands = [
    { ic: '◳', label: 'Cortex — case study', hint: '1st / 95+', run: () => openSheet('cortex') },
    { ic: '◉', label: 'Lucid — case study', hint: 'HackCanada', run: () => openSheet('lucid') },
    { ic: '❋', label: 'myFarm — case study', hint: 'NASA winner', run: () => openSheet('myfarm') },
    { ic: '✉', label: 'Copy email', hint: 'dbanga@uwaterloo.ca', run: copyEmail },
    { ic: '↗', label: 'Email me', run: () => { location.href = 'mailto:dbanga@uwaterloo.ca'; } },
    { ic: '⇩', label: 'Open résumé', hint: 'PDF', run: () => window.open('assets/DivyamResumeSv.pdf', '_blank', 'noopener') },
    { ic: '', label: 'GitHub profile', run: () => window.open('https://github.com/DivyamBanga', '_blank', 'noopener') },
    { ic: 'in', label: 'LinkedIn', run: () => window.open('https://www.linkedin.com/in/divyambanga', '_blank', 'noopener') },
    { ic: '◐', label: 'Toggle appearance', hint: 'light / dark', run: toggleTheme }
  ];

  function copyEmail() {
    const done = () => { paletteInput.placeholder = 'Copied dbanga@uwaterloo.ca ✓'; };
    if (navigator.clipboard) navigator.clipboard.writeText('dbanga@uwaterloo.ca').then(done, done);
  }

  let filtered = commands;
  let selected = 0;

  function renderPalette() {
    const q = paletteInput.value.trim().toLowerCase();
    filtered = q
      ? commands.filter((c) => (c.label + ' ' + (c.hint || '')).toLowerCase().includes(q))
      : commands;
    selected = Math.min(selected, Math.max(0, filtered.length - 1));
    paletteList.replaceChildren(...filtered.map((c, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === selected));
      const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = c.ic;
      const label = document.createElement('span'); label.textContent = c.label;
      li.append(ic, label);
      if (c.hint) { const k = document.createElement('span'); k.className = 'k'; k.textContent = c.hint; li.append(k); }
      li.addEventListener('click', () => runCommand(c));
      li.addEventListener('mousemove', () => { if (selected !== i) { selected = i; renderPalette(); } });
      return li;
    }));
    if (!filtered.length) {
      const li = document.createElement('li');
      li.className = 'palette__empty';
      li.textContent = 'No results';
      paletteList.replaceChildren(li);
    }
  }

  function runCommand(c) {
    closePalette();
    c.run();
  }

  function openPalette() {
    if (!sheet.hidden) closeSheet();
    palette.hidden = false;
    paletteInput.value = '';
    paletteInput.placeholder = 'Search projects, actions…';
    selected = 0;
    renderPalette();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      palette.classList.add('is-open');
      paletteInput.focus();
    }));
  }

  function closePalette() {
    palette.classList.remove('is-open');
    setTimeout(() => { palette.hidden = true; }, 250);
  }

  document.getElementById('paletteBtn').addEventListener('click', openPalette);
  palette.addEventListener('click', (e) => { if (e.target === palette) closePalette(); });
  paletteInput.addEventListener('input', () => { selected = 0; renderPalette(); });
  paletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); selected = (selected + 1) % filtered.length; renderPalette(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selected = (selected - 1 + filtered.length) % filtered.length; renderPalette(); }
    else if (e.key === 'Enter' && filtered[selected]) { runCommand(filtered[selected]); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      palette.hidden ? openPalette() : closePalette();
    } else if (e.key === 'Escape' && !palette.hidden) {
      closePalette();
    }
  });

  /* ===== GitHub contribution mini-graph ===== */
  const ghGraph = document.getElementById('ghGraph');
  const ghCount = document.getElementById('ghCount');

  fetch('https://github-contributions-api.jogruber.de/v4/DivyamBanga?y=last')
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      const days = data.contributions || [];
      if (!days.length) return;
      // Show only as many full weeks as fit the tile.
      const weeksToShow = 16;
      const recent = days.slice(-weeksToShow * 7);
      const max = Math.max(1, ...recent.map((d) => d.count));
      ghGraph.replaceChildren(...recent.map((d) => {
        const cell = document.createElement('i');
        cell.style.setProperty('--v', (d.count / max).toFixed(2));
        return cell;
      }));
      const total = (data.total && data.total.lastYear) ||
        days.reduce((n, d) => n + d.count, 0);
      ghCount.textContent = total.toLocaleString('en-CA') + ' contributions in the last year';
    })
    .catch(() => { /* tile already links to the profile; leave the fallback text */ });
});
