document.addEventListener('DOMContentLoaded', () => {
  // Typing effect
  const words = [
    'engineer',
    'builder',
    'competitor',
    'maker'
  ];

  let currentWordIndex = 0;
  const typedEl = document.getElementById('typed');
  const typingSpeed = 100;
  const erasingSpeed = 50;
  const delayBetweenWords = 2000;

  function typeWord(word, idx = 0) {
    if (idx < word.length) {
      typedEl.textContent += word.charAt(idx);
      setTimeout(() => typeWord(word, idx + 1), typingSpeed);
    } else {
      setTimeout(eraseWord, delayBetweenWords);
    }
  }

  function eraseWord() {
    const text = typedEl.textContent;
    if (text.length > 0) {
      typedEl.textContent = text.substring(0, text.length - 1);
      setTimeout(eraseWord, erasingSpeed);
    } else {
      currentWordIndex = (currentWordIndex + 1) % words.length;
      setTimeout(() => typeWord(words[currentWordIndex]), typingSpeed);
    }
  }

  setTimeout(() => typeWord(words[currentWordIndex]), delayBetweenWords / 2);

  // Scroll reveal — staggered for project cards, fade for other elements
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  // Timeline events
  document.querySelectorAll('.timeline-event').forEach(el => {
    revealObserver.observe(el);
  });

  // Featured cards — staggered
  document.querySelectorAll('.featured-card').forEach((el, i) => {
    el.style.transitionDelay = `${i * 0.1}s`;
    el.classList.add('reveal');
    revealObserver.observe(el);
  });

  // Secondary project cards — staggered
  document.querySelectorAll('.project-card').forEach((el, i) => {
    el.style.transitionDelay = `${i * 0.08}s`;
    el.classList.add('reveal');
    revealObserver.observe(el);
  });

  // Image slideshow
  const slides = document.querySelectorAll('.profile-slide');
  let currentSlide = 0;

  function nextSlide() {
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('active');
  }

  setInterval(nextSlide, 3000);

  // Nav background on scroll
  const nav = document.querySelector('.site-nav');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });
});
