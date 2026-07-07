/* Hi, curious dev. Vanilla HTML, CSS and JS. Try pressing Cmd/Ctrl+K. */

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== Theme (dark unless you chose light) ===== */
  const themeBtn = document.getElementById('themeBtn');
  const effectiveTheme = () => root.getAttribute('data-theme') || 'dark';

  function setMetaThemeColor() {
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = effectiveTheme() === 'dark' ? '#121211' : '#fafaf8';
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
  setMetaThemeColor();
  updateThemeLabel();

  /* ===== Entrance: the draftsman =====
     styles.css declares the line-drawing timeline in custom properties.
     Here we measure the real grid and overwrite the segment durations
     so the pen moves at constant speed on any screen, drive a glowing
     pen tip along the exact same path, and decode the headings as the
     pen encloses their cells. Ends by announcing intro:done, which the
     ink wisp (fluid.js) and the hairline glow listen for. */
  const grid = document.querySelector('.grid');

  function gridGeometry() {
    const g = grid.getBoundingClientRect();
    const top = (sel) => document.querySelector(sel).getBoundingClientRect().top - g.top;
    return {
      rect: g,
      W: g.width,
      H: g.height,
      xDiv: document.querySelector('.col--right').getBoundingClientRect().left - g.left,
      y1: top('.cell--projects'),
      y2: top('.cell--off'),
      y3: top('.cell--contact')
    };
  }

  const GLYPHS = '#%&/\\<>[]{}=+*~^?!01';
  function decode(el, dur) {
    const orig = el.textContent;
    const n = orig.length;
    if (!n) return;
    const t0 = performance.now();
    let tail = '';
    let tick = 0;
    (function step() {
      const p = Math.min(1, (performance.now() - t0) / dur);
      const keep = Math.floor(p * n);
      if (tick++ % 2 === 0 || tail.length !== n - keep) {
        tail = '';
        for (let i = keep; i < n; i++) {
          tail += orig[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
      }
      el.textContent = p < 1 ? orig.slice(0, keep) + tail : orig;
      if (p < 1) requestAnimationFrame(step);
    })();
  }
  function decodeAt(el, atMs) {
    if (!el) return;
    setTimeout(() => decode(el, 380 + el.textContent.length * 22), atMs);
  }

  function introDone(ms) {
    setTimeout(() => window.dispatchEvent(new Event('intro:done')), ms);
  }

  (function intro() {
    const heroH1 = document.querySelector('.cell--hero h1');
    if (reducedMotion) { introDone(300); return; }

    if (!window.matchMedia('(min-width: 1024px)').matches) {
      // Phones keep the plain fade, plus a light decode pass on top.
      decodeAt(heroH1, 250);
      document.querySelectorAll('.cell h2').forEach((el) => decodeAt(el, 450));
      document.querySelectorAll('.proj h3').forEach((el, i) => decodeAt(el, 600 + i * 90));
      introDone(1400);
      return;
    }

    const geo = gridGeometry();
    const W = geo.W, H = geo.H, xDiv = geo.xDiv;
    const V = 2600; // pen speed, px per second
    const LEAD = 0.3, HOP = 0.28, HOP2 = 0.23, OUTRO = 0.4;
    const u = {
      top: W / V, right: H / V, bottom: W / V, left: H / V,
      vdiv: H / V, h1: xDiv / V, h3: (W - xDiv) / V, h2: xDiv / V
    };
    grid.style.setProperty('--lead', LEAD + 's');
    grid.style.setProperty('--hop', HOP + 's');
    grid.style.setProperty('--hop2', HOP2 + 's');
    for (const k in u) grid.style.setProperty('--u-' + k, u[k].toFixed(4) + 's');

    const tTop = LEAD;
    const tRight = tTop + u.top;
    const tBottom = tRight + u.right;
    const tLeft = tBottom + u.bottom;
    const tFrame = tLeft + u.left;         // frame closed, back at the origin
    const tVdiv = tFrame + HOP;
    const tH1 = tVdiv + u.vdiv + HOP2;
    const tH3 = tH1 + u.h1 + HOP2;
    const tH2 = tH3 + u.h3 + HOP2;
    const tEnd = tH2 + u.h2;
    const total = tEnd + OUTRO;

    // The pen tip: one linear timeline through every corner, so it
    // always sits exactly on the tip of the line being drawn. It goes
    // invisible while it glides between lines, like a pen lifting.
    const pen = document.createElement('div');
    pen.className = 'pen';
    pen.setAttribute('aria-hidden', 'true');
    if (typeof pen.animate === 'function') {
      grid.appendChild(pen);
      const kf = [];
      const at = (t, x, y, s, o) => kf.push({
        offset: Math.min(1, t / total),
        transform: 'translate(' + x + 'px, ' + y + 'px) scale(' + (s == null ? 1 : s) + ')',
        opacity: o == null ? 1 : o
      });
      at(0, 0, 0, 0, 0);
      at(LEAD * 0.7, 0, 0, 1.6, 1);                 // touch down
      at(tTop, 0, 0);
      at(tRight, W, 0);
      at(tBottom, W, H);
      at(tLeft, 0, H);
      at(tFrame, 0, 0);
      at(tFrame + HOP * 0.45, 0, -10, 0.5, 0);      // lift
      at(tVdiv - HOP * 0.3, xDiv, -10, 0.5, 0);
      at(tVdiv, xDiv, 0);
      at(tVdiv + u.vdiv, xDiv, H);
      at(tVdiv + u.vdiv + HOP2 * 0.45, xDiv, H + 8, 0.5, 0);
      at(tH1 - HOP2 * 0.3, -8, geo.y1, 0.5, 0);
      at(tH1, 0, geo.y1);
      at(tH1 + u.h1, xDiv, geo.y1);
      at(tH1 + u.h1 + HOP2 * 0.45, xDiv, geo.y1 - 8, 0.5, 0);
      at(tH3 - HOP2 * 0.3, xDiv, geo.y3 - 8, 0.5, 0);
      at(tH3, xDiv, geo.y3);
      at(tH3 + u.h3, W, geo.y3);
      at(tH3 + u.h3 + HOP2 * 0.45, W, geo.y3 - 8, 0.5, 0);
      at(tH2 - HOP2 * 0.3, -8, geo.y2, 0.5, 0);
      at(tH2, 0, geo.y2);
      at(tEnd, xDiv, geo.y2);
      at(total, xDiv, geo.y2, 2.4, 0);              // bloom out
      const anim = pen.animate(kf, { duration: total * 1000, easing: 'linear', fill: 'forwards' });
      anim.finished.then(() => pen.remove()).catch(() => pen.remove());
    }

    // Headings decode as the pen encloses their cell.
    const S = 1000;
    decodeAt(heroH1, (tTop + u.top * 0.5) * S);
    decodeAt(document.querySelector('.cell--timeline h2'), (tVdiv + u.vdiv * 0.5) * S);
    decodeAt(document.querySelector('.cell--projects h2'), (tH1 + u.h1) * S);
    document.querySelectorAll('.proj h3').forEach((el, i) =>
      decodeAt(el, (tH1 + u.h1 + 0.12 + 0.1 * i) * S));
    decodeAt(document.querySelector('.cell--contact h2'), (tH3 + u.h3 * 0.6) * S);
    decodeAt(document.querySelector('.cell--off h2'), (tH2 + u.h2 * 0.7) * S);

    introDone((total + 0.15) * 1000);
  })();

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
