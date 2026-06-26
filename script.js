document.addEventListener('DOMContentLoaded', () => {
  /* ===== Theme toggle (iOS switch in the Display tile) ===== */
  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');

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
      m.id = 'tc-dynamic';
      m.setAttribute('name', 'theme-color');
      document.head.appendChild(m);
    }
    m.setAttribute('content', override === 'dark' ? '#0b0c0e' : '#f2f3f5');
  }

  const syncToggle = () => { if (themeToggle) themeToggle.checked = effectiveTheme() === 'dark'; };

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light' || savedTheme === 'dark') root.setAttribute('data-theme', savedTheme);
  syncToggle();
  setMetaThemeColor();

  if (themeToggle) {
    themeToggle.addEventListener('change', () => {
      const next = themeToggle.checked ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      setMetaThemeColor();
    });
  }
  // Reflect OS theme changes when the user hasn't picked a manual theme.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncToggle);

  /* ===== Brightness control (Display tile) — dims the page via a scrim ===== */
  const slider = document.getElementById('brightness');
  const scrim = document.getElementById('dimScrim');
  if (slider && scrim) {
    const fill = slider.querySelector('.cc-slider__fill');
    const KEY = 'pageBrightness';
    const MIN = 25;   // brightness floor so the page never dims to an unusable black
    const clamp = v => Math.max(0, Math.min(100, v));

    const stored = Number(localStorage.getItem(KEY));
    let level = (localStorage.getItem(KEY) !== null && Number.isFinite(stored)) ? clamp(stored) : 100;

    function render(persist) {
      if (fill) fill.style.height = level + '%';
      // Map the 0–100 slider to a brightness range of MIN–100% so direction is
      // intuitive (more fill = brighter) while a floor keeps the page usable.
      const brightness = MIN + (level / 100) * (100 - MIN);
      scrim.style.opacity = ((100 - brightness) / 100).toFixed(3);
      slider.setAttribute('aria-valuenow', String(Math.round(level)));
      slider.setAttribute('aria-valuetext', Math.round(level) + '%');
      if (persist) localStorage.setItem(KEY, String(Math.round(level)));
    }

    const setFromPointer = clientY => {
      const r = slider.getBoundingClientRect();
      level = clamp(((r.bottom - clientY) / r.height) * 100);   // fill rises from the bottom
      render(false);
    };
    const onMove = e => setFromPointer(e.clientY);
    const onUp = e => {
      slider.classList.remove('is-dragging');
      try { slider.releasePointerCapture(e.pointerId); } catch (_) {}
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      render(true);   // persist only on release
    };
    slider.addEventListener('pointerdown', e => {
      e.preventDefault();                       // no text selection / image drag
      slider.focus({ preventScroll: true });    // keep keyboard control after a drag
      slider.classList.add('is-dragging');
      try { slider.setPointerCapture(e.pointerId); } catch (_) {}
      setFromPointer(e.clientY);
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });

    slider.addEventListener('keydown', e => {
      const step = e.shiftKey ? 10 : 5;
      let handled = true;
      switch (e.key) {
        case 'ArrowUp': case 'ArrowRight': level = clamp(level + step); break;
        case 'ArrowDown': case 'ArrowLeft': level = clamp(level - step); break;
        case 'Home': level = 100; break;
        case 'End':  level = 0;   break;
        default: handled = false;
      }
      if (handled) { e.preventDefault(); render(true); }
    });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) scrim.style.transition = 'none';
    render(false);
  }

  /* ===== Local time (About tile) ===== */
  const clock = document.getElementById('localtime');
  if (clock) {
    const tick = () => {
      clock.textContent = new Date().toLocaleTimeString('en-CA', {
        timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit'
      }) + ' ET';
    };
    tick();
    setInterval(tick, 30000);
  }

  /* ===== Font-morphing typing ===== */
  const typed = document.getElementById('typed');
  if (typed) {
    // Each font is chosen to MEAN its word, so the morph reads as a deliberate
    // visual joke rather than a random font parade. Order avoids adjacent repeats.
    const roles = [
      { text: 'engineer', font: 'var(--font-display)', weight: 600 },  // precise, modern
      { text: 'designer', font: 'var(--font-serif)',   weight: 600 },  // editorial, refined
      { text: 'hacker',   font: 'var(--font-mono)',    weight: 700 },  // terminal
      { text: 'builder',  font: 'var(--font-body)',    weight: 700 },  // no-nonsense maker
      { text: 'creator',  font: 'var(--font-script)',  weight: 700 }   // handmade, expressive
    ];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce) {
      typed.style.fontFamily = roles[0].font;
      typed.style.fontWeight = roles[0].weight;
      typed.textContent = roles[0].text;
    } else {
      let i = 0;
      const type = (role, idx = 0) => {
        typed.style.fontFamily = role.font;
        typed.style.fontWeight = role.weight;
        if (idx <= role.text.length) {
          typed.textContent = role.text.slice(0, idx);
          setTimeout(() => type(role, idx + 1), 95);
        } else {
          setTimeout(erase, 1600);
        }
      };
      const erase = () => {
        const t = typed.textContent;
        if (t.length) {
          typed.textContent = t.slice(0, -1);
          setTimeout(erase, 45);
        } else {
          i = (i + 1) % roles.length;
          setTimeout(() => type(roles[i]), 180);
        }
      };
      setTimeout(() => type(roles[i]), 600);
    }
  }

  /* ===== Mouse-reactive glow (neutral sheen, no tilt) ===== */
  if (window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.tile, .pcard').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
      el.addEventListener('pointerleave', () => {
        el.style.removeProperty('--mx');
        el.style.removeProperty('--my');
      });
    });
  }

  /* ===== Scroll reveal ===== */
  const revealEls = document.querySelectorAll('.tile, .pcard');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealEls.forEach(el => el.classList.add('is-visible'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('is-visible');
        io.unobserve(el);
        // Drop the reveal transition afterwards so it doesn't slow hover effects
        setTimeout(() => { el.classList.remove('reveal'); el.style.transitionDelay = ''; }, 1200);
      });
    }, { threshold: 0.12 });
    revealEls.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${Math.min(i * 0.05, 0.4)}s`;
      io.observe(el);
    });
  }
});
