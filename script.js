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
      if (document.hidden) return;
      index = (index + 1) % words.length;
      const oldWord = rotator.querySelector('.rotator__word:not(.is-out)');
      const next = document.createElement('span');
      next.className = 'rotator__word is-in';
      next.textContent = words[index];
      if (oldWord) {
        oldWord.classList.remove('is-in');
        oldWord.classList.add('is-out');
        setTimeout(() => oldWord.remove(), 750);
      }
      rotator.appendChild(next);
      rotator.style.width = measureWord(words[index]) + 'px';
    }, 2800);
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
     A canvas above the page (pointer-events off, low alpha, so text
     stays readable and nothing can hide it). Each movement drops
     irregular washes of shifting color that bloom outward like
     pigment in water, drift a little, and fade. */
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

    const drops = [];
    const MAX_DROPS = 160;
    const VERTS = 9;
    let hue = Math.random() * 360;
    let last = null;

    function emit(x, y, speed) {
      hue = (hue + 11) % 360;
      // Irregular edge: each vertex keeps its own radius multiplier.
      const jag = [];
      for (let i = 0; i < VERTS; i++) jag.push(0.72 + Math.random() * 0.56);
      drops.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 0.4 * dpr,
        vy: (Math.random() - 0.5) * 0.4 * dpr - 0.08 * dpr,
        r0: (6 + Math.random() * 10) * dpr,
        grow: (34 + Math.random() * 44 + Math.min(40, speed * 0.35)) * dpr,
        hue: hue + (Math.random() * 36 - 18),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.012,
        jag: jag,
        life: 1,
        decay: 0.008 + Math.random() * 0.005
      });
      if (drops.length > MAX_DROPS) drops.splice(0, drops.length - MAX_DROPS);
    }

    window.addEventListener('pointermove', (e) => {
      const x = e.clientX * dpr;
      const y = e.clientY * dpr;
      if (last) {
        const dx = x - last.x;
        const dy = y - last.y;
        const dist = Math.hypot(dx, dy);
        const steps = Math.min(4, Math.max(1, Math.round(dist / (30 * dpr))));
        for (let i = 1; i <= steps; i++) {
          emit(last.x + (dx * i) / steps, last.y + (dy * i) / steps, dist / dpr);
        }
      } else {
        emit(x, y, 0);
      }
      last = { x, y };
    }, { passive: true });

    function drawDrop(d) {
      const t = 1 - d.life;
      // Pigment blooms fast, then settles.
      const r = d.r0 + d.grow * (1 - Math.pow(1 - t, 2.4));
      const fade = d.life > 0.75 ? (1 - d.life) * 4 : d.life / 0.75;
      const alpha = 0.14 * fade;
      if (alpha <= 0.002) return;

      const g = ctx.createRadialGradient(d.x, d.y, r * 0.15, d.x, d.y, r * 1.12);
      g.addColorStop(0, 'hsla(' + d.hue + ', 62%, 58%, ' + alpha + ')');
      g.addColorStop(0.72, 'hsla(' + d.hue + ', 62%, 58%, ' + alpha * 0.55 + ')');
      g.addColorStop(1, 'hsla(' + d.hue + ', 62%, 58%, 0)');
      ctx.fillStyle = g;

      // Wobbly closed curve through the jagged vertices.
      ctx.beginPath();
      const pts = [];
      for (let i = 0; i < VERTS; i++) {
        const a = d.rot + (i / VERTS) * Math.PI * 2;
        pts.push([d.x + Math.cos(a) * r * d.jag[i], d.y + Math.sin(a) * r * d.jag[i]]);
      }
      for (let i = 0; i < VERTS; i++) {
        const p = pts[i];
        const n = pts[(i + 1) % VERTS];
        const mx = (p[0] + n[0]) / 2;
        const my = (p[1] + n[1]) / 2;
        if (i === 0) ctx.moveTo(mx, my);
        else ctx.quadraticCurveTo(p[0], p[1], mx, my);
      }
      const p0 = pts[0];
      const m0x = (pts[VERTS - 1][0] + p0[0]) / 2;
      const m0y = (pts[VERTS - 1][1] + p0[1]) / 2;
      ctx.quadraticCurveTo(p0[0], p0[1], m0x, m0y);
      ctx.closePath();
      ctx.fill();
    }

    (function frame() {
      if (drops.length) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = drops.length - 1; i >= 0; i--) {
          const d = drops[i];
          d.life -= d.decay;
          if (d.life <= 0) { drops.splice(i, 1); continue; }
          d.x += d.vx;
          d.y += d.vy;
          d.rot += d.vr;
          drawDrop(d);
        }
      }
      requestAnimationFrame(frame);
    })();
  }
});
