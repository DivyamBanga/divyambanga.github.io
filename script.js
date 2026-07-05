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

  /* ===== Rotating word (3D prism roll) ===== */
  const rotator = document.getElementById('rotator');
  const words = ['a builder', 'an engineer', 'a runner', 'a player', 'a developer', 'a winner', 'a designer'];

  function measureWord(text) {
    const probe = document.createElement('span');
    probe.className = 'rotator__word';
    probe.style.visibility = 'hidden';
    probe.style.position = 'absolute';
    probe.textContent = text;
    rotator.appendChild(probe);
    const w = probe.offsetWidth;
    probe.remove();
    return w;
  }

  if (rotator && !reducedMotion) {
    let index = 0;
    rotator.style.width = measureWord(words[0]) + 'px';

    setInterval(() => {
      index = (index + 1) % words.length;
      const oldWord = rotator.querySelector('.rotator__word:not(.is-out)');
      const next = document.createElement('span');
      next.className = 'rotator__word is-in';
      next.textContent = words[index];
      if (oldWord) {
        oldWord.classList.remove('is-in');
        oldWord.classList.add('is-out');
        setTimeout(() => oldWord.remove(), 600);
      }
      rotator.appendChild(next);
      rotator.style.width = measureWord(words[index]) + 'px';
    }, 2600);
  }

  /* ===== Project detail strip ===== */
  const strip = document.getElementById('projstrip');
  const stripDefault = strip.innerHTML;
  const moreBtns = Array.from(document.querySelectorAll('.proj__more'));
  let activeProj = null;

  function closeStrip() {
    activeProj = null;
    strip.innerHTML = stripDefault;
    moreBtns.forEach((b) => {
      b.setAttribute('aria-expanded', 'false');
      b.textContent = 'more';
    });
  }

  function openProject(id) {
    const tpl = document.getElementById('detail-' + id);
    if (!tpl) return;
    activeProj = id;
    strip.replaceChildren(tpl.content.cloneNode(true));
    moreBtns.forEach((b) => {
      const active = b.dataset.proj === id;
      b.setAttribute('aria-expanded', String(active));
      b.textContent = active ? 'less' : 'more';
    });
  }

  moreBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (activeProj === btn.dataset.proj) closeStrip();
      else openProject(btn.dataset.proj);
    });
  });

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

  function showProject(id) {
    openProject(id);
    document.querySelector('.cell--projects').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const commands = [
    { label: 'Cortex', hint: 'won CxC', run: () => showProject('cortex') },
    { label: 'Lucid', hint: 'HackCanada finalist', run: () => showProject('lucid') },
    { label: 'myFarm', hint: 'won NASA Space Apps', run: () => showProject('myfarm') },
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

  /* ===== Watercolor paint trail =====
     A canvas behind the text. Each mouse move drops soft blobs of
     slowly shifting color that spread a little and fade out. */
  const canvas = document.getElementById('paint');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (canvas && finePointer && !reducedMotion) {
    const ctx = canvas.getContext('2d');
    let dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    }
    resize();
    window.addEventListener('resize', resize);

    const blobs = [];
    const MAX_BLOBS = 340;
    let hue = Math.random() * 360;
    let last = null;

    function emit(x, y) {
      hue = (hue + 9) % 360;
      blobs.push({
        x: x + (Math.random() - 0.5) * 12 * dpr,
        y: y + (Math.random() - 0.5) * 12 * dpr,
        r: (14 + Math.random() * 22) * dpr,
        hue: hue + (Math.random() * 40 - 20),
        life: 1
      });
      if (blobs.length > MAX_BLOBS) blobs.splice(0, blobs.length - MAX_BLOBS);
    }

    window.addEventListener('pointermove', (e) => {
      const x = e.clientX * dpr;
      const y = e.clientY * dpr;
      if (last) {
        const dx = x - last.x;
        const dy = y - last.y;
        const steps = Math.min(8, Math.max(1, Math.round(Math.hypot(dx, dy) / (16 * dpr))));
        for (let i = 1; i <= steps; i++) emit(last.x + (dx * i) / steps, last.y + (dy * i) / steps);
      } else {
        emit(x, y);
      }
      last = { x, y };
    }, { passive: true });

    (function frame() {
      if (blobs.length) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = blobs.length - 1; i >= 0; i--) {
          const b = blobs[i];
          b.life -= 0.018;
          b.r *= 1.008;
          if (b.life <= 0) { blobs.splice(i, 1); continue; }
          const alpha = 0.16 * b.life;
          const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
          g.addColorStop(0, 'hsla(' + b.hue + ', 65%, 60%, ' + alpha + ')');
          g.addColorStop(1, 'hsla(' + b.hue + ', 65%, 60%, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      requestAnimationFrame(frame);
    })();
  }
});
