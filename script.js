document.addEventListener('DOMContentLoaded', () => {
  // Typing effect
  const words = [
    'programmer',
    'teacher',
    'data scientist',
    'youtuber',
    'content creator',
    'soccer player',
    'runner',
    'basketball player'
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

  // Timeline animation
  const timelineEvents = document.querySelectorAll('.timeline-event');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, {
    threshold: 0.5
  });

  timelineEvents.forEach(event => {
    observer.observe(event);
  });

  // Image slideshow
  const slides = document.querySelectorAll('.profile-slide');
  let currentSlide = 0;
  const slideInterval = 3000; // 3 seconds

  function nextSlide() {
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('active');
  }

  setInterval(nextSlide, slideInterval);
});