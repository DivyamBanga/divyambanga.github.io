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

let current = 0;
const typedEl = document.getElementById('typed');
const typingSpeed = 100;
const erasingSpeed = 50;
const delayBetween = 2000;

function typeWord(word, idx = 0) {
  if (idx < word.length) {
    typedEl.textContent += word.charAt(idx);
    setTimeout(() => typeWord(word, idx + 1), typingSpeed);
  } else {
    setTimeout(() => eraseWord(), delayBetween);
  }
}

function eraseWord() {
  const text = typedEl.textContent;
  if (text.length > 0) {
    typedEl.textContent = text.substring(0, text.length - 1);
    setTimeout(eraseWord, erasingSpeed);
  } else {
    current = (current + 1) % words.length;
    setTimeout(() => typeWord(words[current]), typingSpeed);
  }
}

// start the loop
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => typeWord(words[current]), delayBetween / 2);
});
