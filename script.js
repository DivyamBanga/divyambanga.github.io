/* Hi, curious dev. Vanilla HTML, CSS and JS. Try pressing Cmd/Ctrl+K. */

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  function applyTheme() {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    setMetaThemeColor();
    updateThemeLabel();
  }

  // Crossfade the whole page between light and dark where supported.
  function toggleTheme() {
    if (document.startViewTransition && !reducedMotion) {
      document.startViewTransition(applyTheme);
    } else {
      applyTheme();
    }
  }

  themeBtn.addEventListener('click', toggleTheme);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateThemeLabel);
  setMetaThemeColor();
  updateThemeLabel();

  /* ===== Rotating word (per-letter cascade) ===== */
  const rotator = document.getElementById('rotator');
  const words = ['a builder', 'an engineer', 'a runner', 'a player', 'a developer', 'a winner', 'a designer'];

  function buildWord(text, entering) {
    const w = document.createElement('span');
    w.className = 'rotator__word';
    Array.from(text).forEach((ch, i) => {
      const l = document.createElement('span');
      l.className = 'rotator__l' + (entering ? ' l-in' : '');
      // Old letters leave first, new letters follow a beat behind.
      l.style.setProperty('--d', (entering ? 120 + i * 26 : i * 22) + 'ms');
      l.textContent = ch === ' ' ? ' ' : ch;
      w.appendChild(l);
    });
    return w;
  }

  if (rotator && !reducedMotion) {
    let index = 0;
    rotator.replaceChildren(buildWord(words[0], false));
    rotator.style.width = rotator.getBoundingClientRect().width + 'px';

    setInterval(() => {
      if (document.hidden) return;
      index = (index + 1) % words.length;
      const oldWord = rotator.querySelector('.rotator__word:not(.is-out)');
      if (oldWord) {
        oldWord.classList.add('is-out');
        oldWord.querySelectorAll('.rotator__l').forEach((l, i) => {
          l.classList.remove('l-in');
          l.style.setProperty('--d', (i * 22) + 'ms');
          l.classList.add('l-out');
        });
        setTimeout(() => oldWord.remove(), 900);
      }
      const next = buildWord(words[index], true);
      rotator.appendChild(next);
      requestAnimationFrame(() => {
        rotator.style.width = next.getBoundingClientRect().width + 'px';
      });
    }, 2800);
  }

  /* ===== GitHub line in Off the clock ===== */
  const ghline = document.getElementById('ghline');
  fetch('https://github-contributions-api.jogruber.de/v4/DivyamBanga?y=last')
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      const total = data.total && data.total.lastYear;
      if (!total) return;
      ghline.textContent = 'Plus ' + total.toLocaleString('en-CA') + ' GitHub contributions in the last year.';
      ghline.hidden = false;
    })
    .catch(() => {});

  /* ===== Command palette (Cmd/Ctrl+K) ===== */
  const palette = document.getElementById('palette');
  const paletteInput = document.getElementById('paletteInput');
  const paletteList = document.getElementById('paletteList');

  function openRepo(url) {
    window.open(url, '_blank', 'noopener');
  }

  const commands = [
    { label: 'Cortex', hint: 'won CxC', run: () => openRepo('https://github.com/Vibhor7-7/Cortex-CxC') },
    { label: 'Lucid', hint: 'HackCanada finalist', run: () => openRepo('https://github.com/DivyamBanga/Lucid') },
    { label: 'myFarm', hint: 'won NASA Space Apps', run: () => openRepo('https://github.com/Doomsy1/NASA') },
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
