'use strict';

// Collect all nav link targets in document order
function allTargets() {
  return [...document.querySelectorAll('#nav a')].map(a => ({
    a,
    el: document.getElementById(a.getAttribute('href').replace('#', ''))
  })).filter(t => t.el);
}

function setActive() {
  const scrollY = window.scrollY;
  const threshold = 120; // px from top to consider "active"
  const targets = allTargets();

  let current = targets[0];
  for (const t of targets) {
    if (t.el.getBoundingClientRect().top + scrollY <= scrollY + threshold) {
      current = t;
    }
  }

  document.querySelectorAll('#nav a').forEach(a => a.classList.remove('active'));
  if (current) current.a.classList.add('active');
}

// Native browser anchors handle the scrolling — JS only manages active class
window.addEventListener('scroll', setActive, { passive: true });
window.addEventListener('load', setActive);
setActive();
