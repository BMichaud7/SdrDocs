'use strict';
const links = document.querySelectorAll('#nav a');
const obs = new IntersectionObserver(e => {
  e.forEach(entry => {
    if (entry.isIntersecting) {
      links.forEach(l => l.classList.remove('active'));
      const a = document.querySelector(`#nav a[href="#${entry.target.id}"]`);
      if (a) a.classList.add('active');
    }
  });
}, { rootMargin: '-20% 0px -70% 0px' });
document.querySelectorAll('section[id]').forEach(s => obs.observe(s));
links.forEach(l => l.addEventListener('click', e => {
  e.preventDefault();
  document.querySelector(l.getAttribute('href'))
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
