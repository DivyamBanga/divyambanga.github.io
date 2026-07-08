/* Hi, curious dev. Vanilla HTML, CSS and JS. Try pressing Cmd/Ctrl+K. */

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== Theme (dark unless you chose light) ===== */
  const themeBtn = document.getElementById('themeBtn');
  const effectiveTheme = () => root.getAttribute('data-theme') || 'dark';

  function setMetaThemeColor() {
    const c = effectiveTheme() === 'dark' ? '#121211' : '#fafaf8';
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.content = c; });
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

  /* The signature in the title block: measured so the pen can trace
     it. The block is mid-rise when this runs (translated down by its
     entrance animation), so its current transform is subtracted to
     get the settled position. */
  function signaturePlan() {
    const svg = document.querySelector('.sig');
    if (!svg || !svg.viewBox) return null;
    const paths = Array.from(svg.querySelectorAll('path'));
    if (!paths.length || typeof paths[0].getTotalLength !== 'function') return null;
    const block = svg.closest('.tblock');
    let dx = 0, dy = 0;
    try {
      const t = getComputedStyle(block).transform;
      if (t && t !== 'none') { const m = new DOMMatrix(t); dx = m.m41; dy = m.m42; }
    } catch (e) {}
    const rect = svg.getBoundingClientRect();
    const g = grid.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const sx = rect.width / vb.width;
    const sy = rect.height / vb.height;
    const ox = rect.left - dx - g.left;
    const oy = rect.top - dy - g.top;
    return {
      toGrid(p) { return { x: ox + p.x * sx, y: oy + p.y * sy }; },
      paths: paths.map((path) => ({ path, len: path.getTotalLength() }))
    };
  }

  const GLYPHS = '#%&/\\<>[]{}=+*~^?!01';
  const introTimers = [];  // pending decode/finish timeouts for this run
  const liveDecodes = [];  // decodes currently animating
  function decode(el, dur) {
    const orig = el.getAttribute('aria-label') || el.textContent;
    const n = orig.length;
    if (!n) return;
    // Screen readers announce the real text, not the scramble frames.
    el.setAttribute('aria-label', orig);
    const t0 = performance.now();
    let tail = '';
    let tick = 0;
    const handle = { done: false, stop() { handle.done = true; el.textContent = orig; } };
    liveDecodes.push(handle);
    (function step() {
      if (handle.done) return;
      const p = Math.min(1, (performance.now() - t0) / dur);
      const keep = Math.floor(p * n);
      if (tick++ % 2 === 0 || tail.length !== n - keep) {
        tail = '';
        for (let i = keep; i < n; i++) {
          tail += orig[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
      }
      el.textContent = p < 1 ? orig.slice(0, keep) + tail : orig;
      if (p < 1) requestAnimationFrame(step); else handle.done = true;
    })();
  }
  function decodeAt(el, atMs) {
    if (!el) return;
    introTimers.push(setTimeout(() => decode(el, 380 + el.textContent.length * 22), atMs));
  }

  /* Lifecycle: the entrance finishes on schedule, can be skipped by
     any click or key, and can be replayed from the command palette. */
  let drafting = false;
  let penAnim = null;
  const sigAnims = [];
  let settleTimer = 0;

  function scheduleIntroDone(ms) {
    introTimers.push(setTimeout(finishIntro, ms));
  }

  function finishIntro() {
    if (!drafting) return;
    drafting = false;
    window.removeEventListener('pointerdown', skipIntro, true);
    window.removeEventListener('keydown', skipIntro, true);
    while (introTimers.length) clearTimeout(introTimers.pop());
    while (liveDecodes.length) liveDecodes.pop().stop();
    while (sigAnims.length) { try { sigAnims.pop().finish(); } catch (e) {} }
    if (penAnim) { try { penAnim.finish(); } catch (e) {} penAnim = null; }
    // The last cool/rise animations outlast the intro clock; keep the
    // gate class until they settle so nothing pops. Skips settle now.
    const wait = grid.classList.contains('is-skipped') ? 30 : 1400;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => grid.classList.remove('is-drafting', 'is-skipped'), wait);
    window.dispatchEvent(new Event('intro:done'));
    initGlow();
    initXhair();
  }

  function skipIntro() {
    if (!drafting) return;
    grid.classList.add('is-skipped');
    finishIntro();
  }

  function replayIntro() {
    if (drafting) return;
    clearTimeout(settleTimer);
    if (glowWrap) glowWrap.classList.remove('is-on');
    if (xhairWrap) xhairWrap.classList.remove('is-on');
    grid.classList.remove('is-drafting', 'is-skipped');
    void grid.offsetWidth; // style flush, so re-adding restarts every animation
    grid.classList.add('is-drafting');
    runIntro();
  }

  /* ===== Hairline glow =====
     After the entrance, the grid stays quietly alive: strips laid over
     every hairline carry a radial highlight that follows the cursor. */
  let glowBuilt = false;
  let glowWrap = null;
  function initGlow() {
    if (glowBuilt) {
      // Rebuilt intro (replay): just bring the glow back.
      if (glowWrap) requestAnimationFrame(() => glowWrap.classList.add('is-on'));
      return;
    }
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    glowBuilt = true;

    const wrap = document.createElement('div');
    glowWrap = wrap;
    wrap.className = 'glowlines';
    wrap.setAttribute('aria-hidden', 'true');
    grid.appendChild(wrap);

    function build() {
      const geo = gridGeometry();
      const px = window.scrollX + geo.rect.left;
      const py = window.scrollY + geo.rect.top;
      const lines = [
        { x: 0, y: 0, w: geo.W, h: 1 },                           // frame top
        { x: geo.W - 1, y: 0, w: 1, h: geo.H },                   // frame right
        { x: 0, y: geo.H - 1, w: geo.W, h: 1 },                   // frame bottom
        { x: 0, y: 0, w: 1, h: geo.H },                           // frame left
        { x: geo.xDiv, y: 0, w: 1, h: geo.H },                    // column divider
        { x: 0, y: geo.y1, w: geo.xDiv, h: 1 },                   // hero / projects
        { x: 0, y: geo.y2, w: geo.xDiv, h: 1 },                   // projects / off
        { x: geo.xDiv, y: geo.y3, w: geo.W - geo.xDiv, h: 1 }     // timeline / contact
      ];
      wrap.replaceChildren(...lines.map((l) => {
        const s = document.createElement('i');
        s.className = 'glowline';
        s.style.cssText =
          'left:' + l.x + 'px;top:' + l.y + 'px;width:' + l.w + 'px;height:' + l.h + 'px;' +
          '--ox:' + (px + l.x) + 'px;--oy:' + (py + l.y) + 'px;';
        return s;
      }));
    }
    build();
    requestAnimationFrame(() => wrap.classList.add('is-on'));

    let raf = 0, mx = 0, my = 0;
    window.addEventListener('pointermove', (e) => {
      mx = e.pageX;
      my = e.pageY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        root.style.setProperty('--mx', mx + 'px');
        root.style.setProperty('--my', my + 'px');
      });
    }, { passive: true });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 160);
    });
  }

  /* ===== Drafting crosshair =====
     A parallel rule for the sheet: hairlines through the pointer, a
     mono readout of sheet coordinates, and CAD-style snap when the
     pointer nears a real grid line. Steps aside over words. */
  let xhairBuilt = false;
  let xhairWrap = null;
  function initXhair() {
    if (xhairBuilt) {
      if (xhairWrap) requestAnimationFrame(() => xhairWrap.classList.add('is-on'));
      return;
    }
    if (reducedMotion) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)').matches) return;
    xhairBuilt = true;

    const wrap = document.createElement('div');
    xhairWrap = wrap;
    wrap.className = 'xhair';
    wrap.setAttribute('aria-hidden', 'true');
    const v = document.createElement('i'); v.className = 'xhair__v';
    const h = document.createElement('i'); h.className = 'xhair__h';
    const label = document.createElement('span'); label.className = 'xhair__label';
    wrap.append(v, h, label);
    document.body.appendChild(wrap);

    const SNAP = 8;
    let geo = null;
    function refreshGeo() {
      const g = gridGeometry();
      const L = g.rect.left, T = g.rect.top;
      geo = {
        ox: L, oy: T,
        xs: [L, L + g.xDiv, L + g.W - 1],
        // horizontal lines snap only along their real extent
        ys: [
          { y: T, x0: L, x1: L + g.W },
          { y: T + g.y1, x0: L, x1: L + g.xDiv },
          { y: T + g.y2, x0: L, x1: L + g.xDiv },
          { y: T + g.y3, x0: L + g.xDiv, x1: L + g.W },
          { y: T + g.H - 1, x0: L, x1: L + g.W }
        ]
      };
    }

    let raf = 0, ex = -100, ey = -100, hidden = false;
    function update() {
      raf = 0;
      if (!geo) refreshGeo();
      let x = ex, y = ey, sx = false, sy = false;
      for (const gx of geo.xs) if (Math.abs(ex - gx) < SNAP) { x = gx; sx = true; break; }
      for (const gy of geo.ys) {
        if (Math.abs(ey - gy.y) < SNAP && ex > gy.x0 - 24 && ex < gy.x1 + 24) { y = gy.y; sy = true; break; }
      }
      v.style.transform = 'translateX(' + x + 'px)';
      h.style.transform = 'translateY(' + y + 'px)';
      v.classList.toggle('is-snap', sx);
      h.classList.toggle('is-snap', sy);
      label.style.transform = 'translate(' + (x + 11) + 'px,' + (y + 13) + 'px)';
      label.textContent = 'x ' + Math.round(x - geo.ox) + ' · y ' + Math.round(y - geo.oy);
    }
    window.addEventListener('pointermove', (e) => {
      ex = e.clientX; ey = e.clientY;
      const t = e.target;
      const overWords = !!(t && t.closest &&
        t.closest('p, h1, h2, h3, a, button, li, time, input, textarea, .tblock, dialog'));
      if (overWords !== hidden) { hidden = overWords; wrap.classList.toggle('is-hidden', hidden); }
      if (!raf) raf = requestAnimationFrame(update);
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => wrap.classList.remove('is-on'));
    document.documentElement.addEventListener('pointerenter', () => wrap.classList.add('is-on'));
    window.addEventListener('resize', () => setTimeout(refreshGeo, 200));
    palette.addEventListener('close', () => wrap.classList.remove('is-hidden'));
    requestAnimationFrame(() => wrap.classList.add('is-on'));
  }

  function runIntro() {
    drafting = true;
    window.addEventListener('pointerdown', skipIntro, true);
    window.addEventListener('keydown', skipIntro, true);
    const heroH1 = document.querySelector('.cell--hero h1');
    if (reducedMotion) { scheduleIntroDone(300); return; }

    if (!window.matchMedia('(min-width: 1024px)').matches) {
      // Phones draw their own compact entrance; decodes ride along.
      decodeAt(heroH1, 250);
      document.querySelectorAll('.cell h2').forEach((el) => decodeAt(el, 450));
      document.querySelectorAll('.proj h3').forEach((el, i) => decodeAt(el, 600 + i * 90));
      scheduleIntroDone(1700);
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

    // The last act: the pen glides to the title block and signs the
    // sheet, stroke by stroke, at a deliberate signing speed.
    const sig = signaturePlan();
    const SIG_V = 230;    // signature speed, svg units per second
    const SIG_GAP = 0.09; // micro pen-lift between strokes
    const tSig = tEnd + HOP;
    let tSigEnd = tEnd;
    if (sig) {
      tSigEnd = tSig;
      sig.paths.forEach((p, i) => { tSigEnd += p.len / SIG_V + (i ? SIG_GAP : 0); });
    }
    const total = tSigEnd + OUTRO;

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
      if (sig) {
        // Lift, glide to the title block, sign, and bloom out there.
        at(tEnd + HOP * 0.45, xDiv, geo.y2 - 10, 0.5, 0);
        const s0 = sig.toGrid(sig.paths[0].path.getPointAtLength(0));
        at(tSig - HOP * 0.2, s0.x, s0.y - 6, 0.5, 0);
        let t = tSig;
        sig.paths.forEach(({ path, len }, i) => {
          if (i) {
            const p0 = sig.toGrid(path.getPointAtLength(0));
            at(t + SIG_GAP * 0.5, p0.x, p0.y - 3, 0.55, 0.3);
            t += SIG_GAP;
          }
          const dur = len / SIG_V;
          const steps = Math.max(6, Math.ceil(len / 9));
          for (let s = 0; s <= steps; s++) {
            const p = sig.toGrid(path.getPointAtLength((len * s) / steps));
            at(t + (dur * s) / steps, p.x, p.y, 0.8);
          }
          t += dur;
        });
        const lastP = sig.paths[sig.paths.length - 1];
        const pEnd = sig.toGrid(lastP.path.getPointAtLength(lastP.len));
        at(total, pEnd.x + 6, pEnd.y - 5, 2.0, 0);  // bloom out off the flourish
      } else {
        at(total, xDiv, geo.y2, 2.4, 0);            // bloom out
      }
      penAnim = pen.animate(kf, { duration: total * 1000, easing: 'linear', fill: 'forwards' });
      penAnim.finished.then(() => pen.remove()).catch(() => pen.remove());
    }

    // The signature ink follows the same clock as the pen tip.
    if (sig) {
      let t = tSig;
      sig.paths.forEach(({ path, len }, i) => {
        if (i) t += SIG_GAP;
        const dur = len / SIG_V;
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        sigAnims.push(path.animate(
          [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
          { duration: dur * 1000, delay: t * 1000, easing: 'linear', fill: 'both' }
        ));
        t += dur;
      });
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

    scheduleIntroDone((total + 0.15) * 1000);
  }
  runIntro();

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
    let timer = 0;
    let lastAdvance = 0;
    rotator.replaceChildren(buildWord(words[0], false));
    rotator.style.width = rotator.getBoundingClientRect().width + 'px';

    function advance(instant) {
      index = (index + 1) % words.length;
      if (instant) {
        // Rapid clicks resolve immediately: repetition earns no flourish.
        rotator.querySelectorAll('.rotator__word').forEach((w) => w.remove());
        const swap = buildWord(words[index], false);
        rotator.appendChild(swap);
        rotator.style.width = swap.getBoundingClientRect().width + 'px';
        return;
      }
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
    }

    function startRotator() {
      clearInterval(timer);
      timer = setInterval(() => { if (!document.hidden) advance(false); }, 2800);
    }
    startRotator();

    // The word is a fidget: click (or tap) to flip it yourself.
    rotator.addEventListener('click', () => {
      const now = performance.now();
      advance(now - lastAdvance < 800);
      lastAdvance = now;
      startRotator();
    });
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

  /* ===== Title block: live REV date and Waterloo local time ===== */
  const revEl = document.getElementById('tbRev');
  if (revEl) {
    const CK = 'tb-rev';
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(CK) || 'null'); } catch (e) {}
    if (cached && Date.now() - cached.t < 21600000) {
      revEl.textContent = cached.v;
    } else {
      fetch('https://api.github.com/repos/DivyamBanga/divyambanga.github.io')
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then((d) => {
          const iso = (d.pushed_at || '').slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
          revEl.textContent = iso;
          try { localStorage.setItem(CK, JSON.stringify({ t: Date.now(), v: iso })); } catch (e) {}
        })
        .catch(() => {}); // the baked date stands
    }
  }

  const clockEl = document.getElementById('tbClock');
  if (clockEl) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', hour12: false
    });
    const tick = () => { clockEl.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  }

  /* ===== Command palette (Cmd/Ctrl+K) ===== */
  const palette = document.getElementById('palette');
  const paletteInput = document.getElementById('paletteInput');
  const paletteList = document.getElementById('paletteList');

  function openRepo(url) {
    window.open(url, '_blank', 'noopener');
  }

  /* Hidden commands don't appear in the default list; they answer
     only when someone types for them. Word travels. */
  const commands = [
    { label: 'Cortex', hint: 'won CxC', run: () => openRepo('https://github.com/Vibhor7-7/Cortex-CxC') },
    { label: 'Lucid', hint: 'HackCanada finalist', run: () => openRepo('https://github.com/DivyamBanga/Lucid') },
    { label: 'myFarm', hint: 'won NASA Space Apps', run: () => openRepo('https://github.com/Doomsy1/NASA') },
    { label: 'Copy email', hint: 'dbanga@uwaterloo.ca', run: copyEmail },
    { label: 'Email me', run: () => { location.href = 'mailto:dbanga@uwaterloo.ca'; } },
    { label: 'Resume', hint: 'PDF', run: () => window.open('assets/DivyamResumeSv.pdf', '_blank', 'noopener') },
    { label: 'GitHub', run: () => window.open('https://github.com/DivyamBanga', '_blank', 'noopener') },
    { label: 'LinkedIn', run: () => window.open('https://www.linkedin.com/in/divyambanga', '_blank', 'noopener') },
    { label: 'Switch appearance', hint: 'light / dark', run: toggleTheme },
    { label: 'Construction lines', hint: 'G', run: () => toggleBlueprint() },
    { label: 'Spill ink', hint: 'make a mess', hidden: true, match: 'spill ink mess paint storm splash splat',
      run: () => { if (window.__ink) window.__ink.storm(16); } },
    { label: 'Replay the entrance', hint: 'draw it again', hidden: true, match: 'replay redraw entrance intro again draft pen',
      run: replayIntro }
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
      ? commands.filter((c) => (c.label + ' ' + (c.hint || '') + ' ' + (c.match || '')).toLowerCase().includes(q))
      : commands.filter((c) => !c.hidden);
    selected = Math.min(selected, Math.max(0, filtered.length - 1));
    paletteList.replaceChildren(...filtered.map((c, i) => {
      const li = document.createElement('li');
      li.id = 'palette-opt-' + i;
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
      li.textContent = 'Nothing here — though not everything is listed.';
      paletteList.replaceChildren(li);
      paletteInput.removeAttribute('aria-activedescendant');
      return;
    }
    paletteInput.setAttribute('aria-activedescendant', 'palette-opt-' + selected);
    const active = document.getElementById('palette-opt-' + selected);
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }

  function runCommand(c) {
    closePalette();
    c.run();
  }

  function openPalette() {
    if (palette.open) return;
    paletteInput.value = '';
    paletteInput.placeholder = 'Search';
    selected = 0;
    renderPalette();
    palette.showModal();
  }

  function closePalette() {
    if (palette.open) palette.close();
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
      palette.open ? closePalette() : openPalette();
    }
  });

  /* ===== The email link copies itself ===== */
  const emailLink = document.querySelector('.cell--contact a[href^="mailto:"]');
  if (emailLink && navigator.clipboard) {
    emailLink.setAttribute('aria-live', 'polite');
    emailLink.setAttribute('title', 'Click to copy');
    let emailRestore = 0;
    emailLink.addEventListener('click', (e) => {
      e.preventDefault();
      navigator.clipboard.writeText('dbanga@uwaterloo.ca').then(() => {
        const old = 'dbanga@uwaterloo.ca';
        emailLink.textContent = 'Copied.';
        clearTimeout(emailRestore);
        emailRestore = setTimeout(() => { emailLink.textContent = old; }, 1200);
      }, () => { location.href = emailLink.href; });
    });
  }

  /* ===== Construction lines (G) =====
     The working grid the sheet was drawn on: baseline rows, guides
     extended past the frame, registration marks, an annotation. */
  let bp = null;
  function renderBlueprint() {
    const g = gridGeometry();
    const sx = window.scrollX, sy = window.scrollY;
    const L = g.rect.left + sx, T = g.rect.top + sy;
    bp.style.height = Math.max(document.documentElement.scrollHeight, window.innerHeight) + 'px';
    const xs = [L, L + g.xDiv, L + g.W - 1];
    const ys = [T, T + g.y1, T + g.y2, T + g.y3, T + g.H - 1];
    const parts = [];
    xs.forEach((x) => parts.push('<i class="bp__v" style="left:' + x + 'px"></i>'));
    ys.forEach((y) => parts.push('<i class="bp__h" style="top:' + y + 'px"></i>'));
    parts.push('<i class="bp__rows" style="left:' + L + 'px;top:' + T + 'px;width:' + g.W + 'px;height:' + g.H + 'px"></i>');
    [[L, T], [L + g.W, T], [L, T + g.H], [L + g.W, T + g.H]].forEach((c) =>
      parts.push('<i class="bp__reg" style="left:' + (c[0] - 4.5) + 'px;top:' + (c[1] - 4.5) + 'px"></i>'));
    parts.push('<span class="bp__annot" style="left:' + L + 'px;top:' + Math.max(4, T - 18) + 'px">SHEET ' +
      Math.round(g.W) + '×' + Math.round(g.H) + ' · 2 COL · BASELINE 23</span>');
    bp.innerHTML = parts.join('');
  }
  function toggleBlueprint() {
    if (!bp) {
      bp = document.createElement('div');
      bp.className = 'blueprint';
      bp.setAttribute('aria-hidden', 'true');
      document.body.appendChild(bp);
    }
    if (bp.classList.contains('is-on')) {
      bp.classList.remove('is-on');
    } else {
      renderBlueprint();
      requestAnimationFrame(() => bp.classList.add('is-on'));
    }
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'g' && e.key !== 'G') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (drafting) return; // during the entrance, a key only skips it
    const t = e.target;
    if (palette.open || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) return;
    toggleBlueprint();
  });
  window.addEventListener('resize', () => {
    if (bp && bp.classList.contains('is-on')) setTimeout(renderBlueprint, 200);
  });

  /* ===== Redline dimensions on the project cards ===== */
  if (window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)').matches) {
    document.querySelectorAll('.proj').forEach((card) => {
      const tag = document.createElement('span');
      tag.className = 'proj__dim';
      tag.setAttribute('aria-hidden', 'true');
      card.appendChild(tag);
      const measure = () => {
        tag.textContent = Math.round(card.offsetWidth) + ' × ' + Math.round(card.offsetHeight);
      };
      card.addEventListener('mouseenter', measure);
      measure();
    });
  }

  /* ===== A note for the curious ===== */
  try {
    console.log(
      '%c✎ drafted by hand%c\n\nvanilla HTML/CSS/JS — no framework, no build step.\n⌘K has more than it shows. type ink() for a storm.\nsource → https://github.com/DivyamBanga/divyambanga.github.io\nsay hi → dbanga@uwaterloo.ca',
      'font: 600 13px ui-monospace, SFMono-Regular, Menlo, monospace; padding: 4px 8px; border: 1px solid #8f8f88;',
      'font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: #8f8f88;'
    );
    window.ink = function (n) {
      if (window.__ink) { window.__ink.storm(n || 16); return 'there it goes.'; }
      return 'the ink is asleep (WebGL off or reduced motion).';
    };
  } catch (e) {}

});
