'use strict';

/* ── Sidebar active tracking ── */
function allTargets() {
  return [...document.querySelectorAll('#nav a[href^="#"]')].map(a => {
    const id = a.getAttribute('href').slice(1);
    return { a, el: document.getElementById(id) };
  }).filter(t => t.el);
}

function setActive() {
  const threshold = window.scrollY + 160;
  let current = null, maxTop = -Infinity;
  for (const t of allTargets()) {
    const top = t.el.getBoundingClientRect().top + window.scrollY;
    if (top <= threshold && top > maxTop) { maxTop = top; current = t; }
  }
  document.querySelectorAll('#nav a').forEach(a => a.classList.remove('active'));
  if (current) current.a.classList.add('active');
}

/* ── Accuracy bar animation ── */
function animateBars() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.width = e.target.dataset.w;
        io.unobserve(e.target);
      }
    });
  }, { threshold: .3 });
  document.querySelectorAll('.ab-fill[data-w]').forEach(b => {
    b.style.width = '0';
    b.style.transition = 'width .6s ease';
    io.observe(b);
  });
}

/* ── IQ Processing Pipeline Canvas ── */
function initIqCanvas() {
  const canvas = document.getElementById('iq-canvas');
  if (!canvas) return;

  // Resize canvas to match CSS width
  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.round(rect.width  * devicePixelRatio);
    canvas.height = Math.round(rect.height * devicePixelRatio);
  }
  resize();
  window.addEventListener('resize', resize);

  const ctx = canvas.getContext('2d');
  const STAGES = 6;
  const LABELS = ['IQ Samples','FFT Spectrum','CA-CFAR','Classify','Demod','Output'];
  const MODS   = ['FM_NB','P25_C4FM','BPSK','AIS','POCSAG','ACARS','DMR','GMSK','OOK'];

  let t = 0;
  let modIdx = 0, modTimer = 0;
  let classLabel = MODS[0];
  let classFlash = 0;

  function bg()   { return '#0e1117' }
  function faint(){ return 'rgba(255,255,255,0.04)' }
  function blue() { return '#4f9eff' }
  function green(){ return '#3fb950' }
  function orange(){ return '#d29922' }
  function muted(){ return '#768390' }
  function dim()  { return '#30363d' }

  function drawStageBox(x, y, w, h, label, active) {
    ctx.fillStyle = active ? 'rgba(79,158,255,0.08)' : faint();
    ctx.strokeStyle = active ? blue() : dim();
    ctx.lineWidth = devicePixelRatio;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6 * devicePixelRatio);
    ctx.fill(); ctx.stroke();
  }

  function drawArrow(x1, y, x2) {
    ctx.strokeStyle = dim();
    ctx.lineWidth = devicePixelRatio;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2 - 6 * devicePixelRatio, y); ctx.stroke();
    ctx.fillStyle = dim();
    ctx.beginPath();
    ctx.moveTo(x2, y);
    ctx.lineTo(x2 - 8 * devicePixelRatio, y - 4 * devicePixelRatio);
    ctx.lineTo(x2 - 8 * devicePixelRatio, y + 4 * devicePixelRatio);
    ctx.fill();
  }

  function draw() {
    const W = canvas.width, H = canvas.height;
    const dpr = devicePixelRatio;
    const pad = 10 * dpr;
    const gap = 6 * dpr;
    const stageW = (W - pad * 2 - gap * (STAGES - 1)) / STAGES;
    const boxH = H - pad * 2;
    const fontSize = Math.max(9, Math.min(13, stageW / 12)) * dpr;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = bg();
    ctx.fillRect(0, 0, W, H);

    t += 0.04;
    modTimer++;
    if (modTimer > 90) {
      modTimer = 0;
      modIdx = (modIdx + 1) % MODS.length;
      classLabel = MODS[modIdx];
      classFlash = 20;
    }
    if (classFlash > 0) classFlash--;

    for (let s = 0; s < STAGES; s++) {
      const x = pad + s * (stageW + gap);
      const y = pad;
      const cx = x + stageW / 2;
      const cy = y + boxH / 2;

      drawStageBox(x, y, stageW, boxH, LABELS[s], false);

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + dpr, y + dpr, stageW - 2 * dpr, boxH - 2 * dpr, 5 * dpr);
      ctx.clip();

      if (s === 0) {
        // IQ waveform
        const npts = Math.floor(stageW / dpr);
        [blue(), orange()].forEach((col, qi) => {
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.5 * dpr;
          ctx.beginPath();
          for (let i = 0; i < npts; i++) {
            const xt = x + i * dpr;
            const phase = (i / npts) * Math.PI * 6 + t + qi * Math.PI / 2;
            const amp = (boxH * 0.32);
            const yt = cy + Math.sin(phase) * amp * 0.8;
            i === 0 ? ctx.moveTo(xt, yt) : ctx.lineTo(xt, yt);
          }
          ctx.stroke();
        });
        ctx.fillStyle = blue();
        ctx.font = `bold ${fontSize * 0.8}px Inter, sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText('I', x + stageW - 4 * dpr, y + boxH * 0.38);
        ctx.fillStyle = orange();
        ctx.fillText('Q', x + stageW - 4 * dpr, y + boxH * 0.68);

      } else if (s === 1) {
        // FFT spectrum
        const bins = 32;
        const bw = (stageW - 8 * dpr) / bins;
        const baseFreqs = [0.1,0.08,0.06,0.12,0.3,0.7,0.85,0.4,0.2,0.15,0.1,0.08,0.06,0.05,0.06,0.08,0.5,0.9,0.95,0.6,0.25,0.12,0.08,0.06,0.05,0.04,0.06,0.08,0.1,0.07,0.05,0.04];
        for (let b = 0; b < bins; b++) {
          const noise = Math.sin(b * 7.3 + t * 0.5) * 0.05;
          const h = (baseFreqs[b] + noise) * (boxH - 20 * dpr);
          const bx = x + 4 * dpr + b * bw;
          const by = y + boxH - 8 * dpr - h;
          const intensity = baseFreqs[b];
          ctx.fillStyle = `rgba(79,158,255,${0.3 + intensity * 0.7})`;
          ctx.fillRect(bx, by, bw - 1, h);
        }

      } else if (s === 2) {
        // CFAR - spectrum with threshold + detection marker
        const bins = 24;
        const bw = (stageW - 8 * dpr) / bins;
        const freqs2 = [0.1,0.08,0.07,0.09,0.28,0.65,0.82,0.38,0.18,0.12,0.09,0.07,0.05,0.07,0.09,0.48,0.88,0.92,0.58,0.22,0.11,0.08,0.06,0.05];
        const thresh = boxH * 0.45;
        for (let b = 0; b < bins; b++) {
          const h = freqs2[b] * (boxH - 20 * dpr);
          const bx = x + 4 * dpr + b * bw;
          const by = y + boxH - 8 * dpr - h;
          const over = (y + boxH - 8 * dpr - h) < (y + boxH - thresh);
          ctx.fillStyle = over ? `rgba(210,153,34,0.85)` : `rgba(79,158,255,0.35)`;
          ctx.fillRect(bx, by, bw - 1, h);
        }
        // Threshold line
        const ty = y + boxH - thresh;
        ctx.strokeStyle = 'rgba(248,81,73,0.6)';
        ctx.lineWidth = dpr;
        ctx.setLineDash([4 * dpr, 3 * dpr]);
        ctx.beginPath(); ctx.moveTo(x + 2 * dpr, ty); ctx.lineTo(x + stageW - 2 * dpr, ty); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(248,81,73,0.7)';
        ctx.font = `${fontSize * 0.75}px Inter,sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText('thresh', x + stageW - 3 * dpr, ty - 2 * dpr);

      } else if (s === 3) {
        // Classification - neural net layers
        const layers = [3, 5, 5, 3];
        const layerSpacing = stageW / (layers.length + 1);
        layers.forEach((nodes, li) => {
          const lx = x + layerSpacing * (li + 1);
          const nodeSpacing = boxH / (nodes + 1);
          layers[li === 0 ? 0 : li - 1] && layers[li - 1] > 0 && li > 0 && layers[li - 1] > 0 && (() => {
            const prevNodes = layers[li - 1];
            const prevLx = x + layerSpacing * li;
            for (let pn = 0; pn < prevNodes; pn++) {
              const py = y + boxH / (prevNodes + 1) * (pn + 1);
              for (let cn = 0; cn < nodes; cn++) {
                const ny = y + nodeSpacing * (cn + 1);
                ctx.strokeStyle = `rgba(79,158,255,0.15)`;
                ctx.lineWidth = 0.5 * dpr;
                ctx.beginPath(); ctx.moveTo(prevLx, py); ctx.lineTo(lx, ny); ctx.stroke();
              }
            }
          })();
          for (let n = 0; n < nodes; n++) {
            const ny = y + nodeSpacing * (n + 1);
            const pulse = Math.sin(t * 2 + li * 1.3 + n * 0.8) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(79,158,255,${0.3 + pulse * 0.5})`;
            ctx.strokeStyle = blue();
            ctx.lineWidth = dpr;
            ctx.beginPath(); ctx.arc(lx, ny, 4 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          }
        });
        // Label
        ctx.fillStyle = classFlash > 0 ? green() : muted();
        ctx.font = `bold ${fontSize * 0.85}px Inter,sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(classLabel, cx, y + boxH - 8 * dpr);

      } else if (s === 4) {
        // Demodulation - signal → audio wave
        const npts = Math.floor(stageW / dpr);
        ctx.strokeStyle = green();
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        for (let i = 0; i < npts; i++) {
          const xt = x + i * dpr;
          const p = i / npts;
          // Square-wave-ish (demodulated FM narrowband envelope)
          const sq = Math.sign(Math.sin(p * Math.PI * 8 + t));
          const env = Math.sin(p * Math.PI);
          const yt = cy + sq * env * boxH * 0.28;
          i === 0 ? ctx.moveTo(xt, yt) : ctx.lineTo(xt, yt);
        }
        ctx.stroke();

      } else if (s === 5) {
        // Output
        const outputs = [
          { label: 'PCM audio', col: green() },
          { label: 'Bits/bytes', col: blue() },
          { label: 'Text', col: orange() },
        ];
        outputs.forEach((o, i) => {
          const oy = y + boxH * (0.28 + i * 0.24);
          ctx.fillStyle = `${o.col}22`;
          ctx.strokeStyle = o.col;
          ctx.lineWidth = dpr;
          ctx.beginPath();
          ctx.roundRect(x + 6 * dpr, oy - 9 * dpr, stageW - 12 * dpr, 18 * dpr, 4 * dpr);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = o.col;
          ctx.font = `${fontSize * 0.85}px Inter,sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(o.label, cx, oy + 5 * dpr);
        });
      }

      ctx.restore();

      // Stage label at top
      ctx.fillStyle = muted();
      ctx.font = `${fontSize * 0.78}px Inter,sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(LABELS[s], cx, y + fontSize * 0.9);

      // Arrow to next stage
      if (s < STAGES - 1) {
        const ax = x + stageW + gap / 2;
        drawArrow(x + stageW, cy, x + stageW + gap);
      }
    }

    requestAnimationFrame(draw);
  }

  draw();
}

// ── Search ───────────────────────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('navSearch');
  if (!input) return;
  const links = [...document.querySelectorAll('#nav a[href]')];
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    links.forEach(a => {
      const match = !q || a.textContent.toLowerCase().includes(q);
      a.style.display = match ? '' : 'none';
    });
    // Also hide separators that have no visible links after them
    document.querySelectorAll('#nav .nav-sep').forEach(sep => {
      let next = sep.nextElementSibling;
      let hasVisible = false;
      while (next && !next.classList.contains('nav-sep')) {
        if (next.tagName === 'A' && next.style.display !== 'none') hasVisible = true;
        next = next.nextElementSibling;
      }
      sep.style.display = hasVisible || !q ? '' : 'none';
    });
  });
}

// ── Theme toggle ─────────────────────────────────────────────────────────────
function initTheme() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const saved = localStorage.getItem('theme');
  if (saved === 'light') document.body.classList.add('light');
  btn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
  });
}

// ── Copy buttons on code blocks ───────────────────────────────────────────────
function initCopyButtons() {
  document.querySelectorAll('pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code');
      navigator.clipboard.writeText(code ? code.innerText : pre.innerText).then(() => {
        btn.textContent = '✓ Copied';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
      });
    });
    pre.appendChild(btn);
  });
}

// ── Live feed ─────────────────────────────────────────────────────────────────
let liveInterval = null;
window.toggleLive = function() {
  const btn = document.getElementById('liveToggle');
  const status = document.getElementById('liveStatus');
  if (liveInterval) {
    clearInterval(liveInterval);
    liveInterval = null;
    btn.textContent = 'Connect';
    btn.style.background = 'var(--blue)';
    status.textContent = '● Offline';
    status.style.color = 'var(--muted)';
    document.getElementById('liveTable').textContent = 'Disconnected.';
    return;
  }
  btn.textContent = 'Disconnect';
  btn.style.background = 'var(--red)';
  fetchLive();
  liveInterval = setInterval(fetchLive, 3000);
};

async function fetchLive() {
  const url = document.getElementById('liveUrl').value.trim();
  const status = document.getElementById('liveStatus');
  const table = document.getElementById('liveTable');
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    const signals = Array.isArray(data) ? data : (data.signals || []);
    status.textContent = '● Live';
    status.style.color = 'var(--green)';
    if (!signals.length) { table.textContent = 'No recent signals.'; return; }
    const rows = signals.slice(0, 15).map(s => {
      const f = s.center_freq_hz ? (s.center_freq_hz/1e6).toFixed(4) : '—';
      const m = s.modulation || s.hypothesis || '—';
      const p = s.power_db ? s.power_db.toFixed(1) : '—';
      const snr = s.snr_db ? s.snr_db.toFixed(1) : '—';
      return `${f.padEnd(12)} ${m.padEnd(14)} ${p.padStart(7)} dB  SNR ${snr} dB`;
    });
    table.innerHTML = '<span style="color:var(--dim)">Freq (MHz)    Modulation     Power       SNR</span>\n' +
      rows.map(r => `<span style="color:var(--tx)">${r}</span>`).join('\n');
  } catch {
    status.textContent = '● Offline';
    status.style.color = 'var(--red)';
    table.textContent = 'Cannot reach ' + document.getElementById('liveUrl').value;
  }
}

window.addEventListener('scroll', setActive, { passive: true });
window.addEventListener('load', () => {
  setActive();
  animateBars();
  initIqCanvas();
  initSearch();
  initTheme();
  initCopyButtons();
});
setActive();
