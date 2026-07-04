/* Hi, curious dev. Vanilla HTML, CSS and JS. Try pressing Cmd/Ctrl+K. */

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;

  /* ===== Theme ===== */
  const themeBtn = document.getElementById('themeBtn');
  const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effectiveTheme = () => root.getAttribute('data-theme') || (systemDark() ? 'dark' : 'light');

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
    m.content = override === 'dark' ? '#121211' : '#fafaf8';
  }

  function updateThemeLabel() {
    themeBtn.textContent = effectiveTheme() === 'dark' ? 'Light mode' : 'Dark mode';
  }

  function toggleTheme() {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    setMetaThemeColor();
    updateThemeLabel();
  }

  themeBtn.addEventListener('click', toggleTheme);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateThemeLabel);
  setMetaThemeColor();
  updateThemeLabel();

  /* ===== Project details ===== */
  const projectCells = Array.from(document.querySelectorAll('.cell--project'));

  // The detail blocks ship with `hidden` so they stay closed without JS.
  // Remove it here and let the CSS collapse handle open and close.
  projectCells.forEach((cell) => {
    cell.querySelector('.proj__more').hidden = false;
  });

  function setProject(cell, open) {
    cell.classList.toggle('is-open', open);
    cell.querySelector('.proj').setAttribute('aria-expanded', String(open));
  }

  projectCells.forEach((cell) => {
    const btn = cell.querySelector('.proj');
    btn.addEventListener('click', () => {
      setProject(cell, !cell.classList.contains('is-open'));
    });
  });

  function openProject(id) {
    const cell = document.getElementById(id);
    if (!cell) return;
    setProject(cell, true);
    cell.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ===== Command palette (Cmd/Ctrl+K) ===== */
  const palette = document.getElementById('palette');
  const paletteInput = document.getElementById('paletteInput');
  const paletteList = document.getElementById('paletteList');

  const commands = [
    { label: 'Cortex', hint: 'won CxC', run: () => openProject('cortex') },
    { label: 'Lucid', hint: 'HackCanada finalist', run: () => openProject('lucid') },
    { label: 'myFarm', hint: 'won NASA Space Apps', run: () => openProject('myfarm') },
    { label: 'Copy email', hint: 'dbanga@uwaterloo.ca', run: copyEmail },
    { label: 'Email me', run: () => { location.href = 'mailto:dbanga@uwaterloo.ca'; } },
    { label: 'Resume', hint: 'PDF', run: () => window.open('assets/DivyamResumeSv.pdf', '_blank', 'noopener') },
    { label: 'GitHub', run: () => window.open('https://github.com/DivyamBanga', '_blank', 'noopener') },
    { label: 'LinkedIn', run: () => window.open('https://www.linkedin.com/in/divyambanga', '_blank', 'noopener') },
    { label: 'Switch appearance', hint: 'light / dark', run: toggleTheme }
  ];

  function copyEmail() {
    const done = () => { paletteInput.placeholder = 'Copied'; };
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
      const label = document.createElement('span');
      label.textContent = c.label;
      li.append(label);
      if (c.hint) {
        const k = document.createElement('span');
        k.className = 'k';
        k.textContent = c.hint;
        li.append(k);
      }
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
    palette.hidden = false;
    paletteInput.value = '';
    paletteInput.placeholder = 'Search';
    selected = 0;
    renderPalette();
    paletteInput.focus();
  }

  function closePalette() {
    palette.hidden = true;
  }

  document.getElementById('paletteBtn').addEventListener('click', openPalette);
  palette.addEventListener('click', (e) => { if (e.target === palette) closePalette(); });
  paletteInput.addEventListener('input', () => { selected = 0; renderPalette(); });
  paletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && filtered.length) {
      e.preventDefault();
      selected = (selected + 1) % filtered.length;
      renderPalette();
    } else if (e.key === 'ArrowUp' && filtered.length) {
      e.preventDefault();
      selected = (selected - 1 + filtered.length) % filtered.length;
      renderPalette();
    } else if (e.key === 'Enter' && filtered[selected]) {
      runCommand(filtered[selected]);
    }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      palette.hidden ? openPalette() : closePalette();
    } else if (e.key === 'Escape' && !palette.hidden) {
      closePalette();
    }
  });
});
