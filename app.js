'use strict';

function allTargets() {
  return [...document.querySelectorAll('#nav a')].map(a => ({
    a,
    el: document.getElementById(a.getAttribute('href').replace('#',''))
  })).filter(t => t.el);
}

function setActive() {
  const threshold = window.scrollY + 140;
  let current = null;
  let maxTop = -Infinity;

  for (const t of allTargets()) {
    // absolute distance from top of document
    const top = t.el.getBoundingClientRect().top + window.scrollY;
    // pick whichever element's top is closest to (but still above) scroll pos
    if (top <= threshold && top > maxTop) {
      maxTop = top;
      current = t;
    }
  }

  document.querySelectorAll('#nav a').forEach(a => a.classList.remove('active'));
  if (current) current.a.classList.add('active');
}

window.addEventListener('scroll', setActive, { passive: true });
window.addEventListener('load', setActive);
setActive();
