'use strict';

const links = document.querySelectorAll('#nav a');

// Collect all nav targets — sections AND named divs/anchors
function getTargets() {
  return [...links].map(l => {
    const id = l.getAttribute('href').slice(1);
    return { link: l, el: document.getElementById(id) };
  }).filter(t => t.el);
}

// Highlight whichever target's top is closest to (but above) 30% down the viewport
function updateActive() {
  const cutoff = window.scrollY + window.innerHeight * 0.30;
  const targets = getTargets();

  let active = null;
  for (const t of targets) {
    if (t.el.getBoundingClientRect().top + window.scrollY <= cutoff) {
      active = t;
    }
  }

  links.forEach(l => l.classList.remove('active'));
  if (active) active.link.classList.add('active');
}

window.addEventListener('scroll', updateActive, { passive: true });
updateActive(); // run on load

// Smooth scroll on nav click
links.forEach(l => l.addEventListener('click', e => {
  e.preventDefault();
  const el = document.getElementById(l.getAttribute('href').slice(1));
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
