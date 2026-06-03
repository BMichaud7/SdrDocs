'use strict';
const links = document.querySelectorAll('#nav a');

// Observe both sections AND named result divs
const targets = document.querySelectorAll('section[id], div[id]');
const obs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.id;
      links.forEach(l => l.classList.remove('active'));
      const match = document.querySelector(`#nav a[href="#${id}"]`);
      if (match) match.classList.add('active');
    }
  });
}, { rootMargin: '-15% 0px -65% 0px' });

targets.forEach(t => obs.observe(t));

links.forEach(l => l.addEventListener('click', e => {
  e.preventDefault();
  const target = document.querySelector(l.getAttribute('href'));
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
