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

  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  syncIcon();
  setMetaThemeColor();

  toggle.addEventListener('click', () => {
    const next = effective() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    syncIcon();
    setMetaThemeColor();
  });

  // Reflect OS theme changes when the user hasn't picked a manual theme.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncIcon);

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
