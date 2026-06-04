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

// ── Frequency band chart ──────────────────────────────────────────────────────
function initFreqChart() {
  const canvas = document.getElementById('freqCanvas');
  if (!canvas) return;

  const BANDS = [
    // [label, lo_MHz, hi_MHz, color, category]
    ['NAVTEX',       0.49,  0.52,  '#39d5b3', 'Maritime'],
    ['AM Broadcast', 0.535, 1.7,   '#d29922', 'Broadcast'],
    ['HF SSB/RTTY',  3,    30,    '#bc8cff', 'HF Data'],
    ['HF CW',        3,    30,    '#8888ff', 'Amateur'],
    ['ACARS',       129,  136,    '#bc8cff', 'Aviation'],
    ['Avn Voice',   118,  136,    '#d29922', 'Aviation'],
    ['FM Broadcast', 87.5,108,    '#d29922', 'Broadcast'],
    ['APRS/D-STAR', 144,  146,    '#3fb950', 'Amateur'],
    ['AIS',         161.9,162.1,  '#39d5b3', 'Maritime'],
    ['EAS/SAME',    162,  162.1,  '#f85149', 'Emergency'],
    ['VHF LMR/P25', 136,  174,   '#4f9eff', 'Public Safety'],
    ['UHF LMR/P25', 406,  512,   '#4f9eff', 'Public Safety'],
    ['POCSAG/FLEX', 152,  162,   '#d29922', 'Paging'],
    ['TETRA (EU)',  380,  400,   '#4f9eff', 'Public Safety'],
    ['P25 700 MHz', 769,  806,   '#4f9eff', 'Public Safety'],
    ['P25 800 MHz', 851,  869,   '#4f9eff', 'Public Safety'],
    ['ADS-B',      1089.5,1090.5,'#bc8cff', 'Aviation'],
    ['GPS L5',     1176.3,1176.6,'#3fb950', 'Navigation'],
    ['GPS L2',     1227.5,1227.7,'#3fb950', 'Navigation'],
    ['GPS L1',     1575.3,1575.6,'#3fb950', 'Navigation'],
  ];

  const LO = Math.log10(0.1), HI = Math.log10(2000);
  function fx(mhz) { return (Math.log10(mhz) - LO) / (HI - LO); }

  function draw() {
    const W = canvas.offsetWidth || 860;
    const H = canvas.offsetHeight || 320;
    const DPR = Math.min(devicePixelRatio || 1, 2);
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    ctx.fillStyle = '#0e1117';
    ctx.fillRect(0, 0, W, H);

    // Grid lines at decade frequencies
    const ticks = [0.1,0.5,1,5,10,50,100,500,1000,2000];
    ticks.forEach(f => {
      const x = Math.round(fx(f) * W * 0.85 + W * 0.07);
      ctx.strokeStyle = '#1c2128';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, H-30); ctx.stroke();
      ctx.fillStyle = '#4b5563';
      ctx.font = '10px Inter,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f >= 1000 ? f/1000+'GHz' : f < 1 ? f*1000+'kHz' : f+'MHz', x, H-14);
    });

    // Axis label
    ctx.fillStyle = '#768390';
    ctx.font = '11px Inter,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Frequency (logarithmic scale)', W/2, H-2);

    // Protocol bands — pack into rows
    const ROW_H = 22, ROW_Y0 = 30, CHART_W = W * 0.85, CHART_X = W * 0.07;
    const rows = [[], [], [], [], [], []];

    BANDS.forEach(([label, lo, hi, color, cat]) => {
      const x1 = fx(lo) * CHART_W + CHART_X;
      const x2 = Math.max(x1 + 4, fx(hi) * CHART_W + CHART_X);
      // Find a row where this band fits
      let row = 0;
      while (row < rows.length && rows[row].some(b => !(x2 < b[0]-2 || x1 > b[1]+2))) row++;
      if (row >= rows.length) row = rows.length - 1;
      rows[row].push([x1, x2, label, color, cat, lo, hi]);
    });

    rows.forEach((row, ri) => {
      const y = ROW_Y0 + ri * (ROW_H + 3);
      row.forEach(([x1, x2, label, color, cat, lo, hi]) => {
        // Band rectangle
        ctx.fillStyle = color + '33';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        const rh = ROW_H - 4;
        ctx.beginPath();
        ctx.roundRect(x1, y, x2-x1, rh, 3);
        ctx.fill(); ctx.stroke();
        // Label (if wide enough)
        if (x2 - x1 > 30) {
          ctx.fillStyle = color;
          ctx.font = `bold 9px Inter,sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(label, (x1+x2)/2, y + rh*0.65);
        }
      });
    });
  }

  draw();
  window.addEventListener('resize', draw);

  // Tooltip
  const tip = document.getElementById('freqTip');
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const W = rect.width, CHART_W = W*0.85, CHART_X = W*0.07;
    const logF = ((mx - CHART_X) / CHART_W) * (Math.log10(2000) - Math.log10(0.1)) + Math.log10(0.1);
    const freq = Math.pow(10, logF);
    const freqStr = freq < 1 ? (freq*1000).toFixed(0)+' kHz' : freq < 1000 ? freq.toFixed(1)+' MHz' : (freq/1000).toFixed(2)+' GHz';
    const hit = BANDS.find(([, lo, hi]) => freq >= lo && freq <= hi);
    tip.textContent = hit ? `${freqStr} — ${hit[0]} (${hit[4]})  ${hit[1]} – ${hit[2]} MHz` : freqStr;
  });
  canvas.addEventListener('mouseleave', () => { tip.textContent = '' });
}

// ── Glossary ──────────────────────────────────────────────────────────────────
const GLOSSARY = [
  ['AMQP','Advanced Message Queuing Protocol 1.0 — the wire protocol used by Apache ActiveMQ Artemis. All inter-component communication in the stack uses AMQP topics and queues.'],
  ['ADS-B','Automatic Dependent Surveillance–Broadcast. Aircraft transponder protocol at 1090 MHz using pulse-position modulation. Carries ICAO address, position, altitude, and velocity.'],
  ['APCO-25 / P25','Association of Public-Safety Communications Officials Project 25 — North American digital radio standard for public safety (police, fire, EMS). Phases 1 and 2 are supported.'],
  ['C4FM','Compatible 4-level FM — the Phase 1 P25 modulation. A 4-level FSK signal with deviation ±600/±1800 Hz at 4800 symbols/s. Looks like 4-FSK in a spectrogram.'],
  ['CA-CFAR','Cell-Averaging Constant False Alarm Rate — adaptive detection threshold. The threshold is set at a fixed dB above the average power of reference cells surrounding the test bin, keeping false alarm rate constant across varying noise floors.'],
  ['CF32','Complex Float 32 — the raw IQ sample format used internally. Each sample is two 32-bit IEEE floats (I and Q), giving 8 bytes per complex sample.'],
  ['DAE','Denoising Autoencoder — a neural network trained to remove noise from IQ samples. Used as a preprocessing stage before the classifier for low-SNR signals.'],
  ['DDC','Digital Down Converter — shifts a wideband IQ stream to a narrower sub-band of interest, applying a digital mix, filter, and decimate chain. Used in the shared-LO fan-out path.'],
  ['DTMF','Dual-Tone Multi-Frequency — the signalling used by touch-tone phones. Each digit is encoded as two simultaneous sine tones. Detected via the Goertzel algorithm.'],
  ['GMSK','Gaussian Minimum Shift Keying — a continuous-phase FSK variant with a Gaussian pre-modulation filter. Used in GSM, AIS, and many VHF protocols. Compact spectrum with no side lobes.'],
  ['HDU','Header Data Unit — a P25 frame type sent at the start of every voice channel transmission. Contains the Algorithm ID (ALGID) and Key ID (KID) fields used for encryption detection.'],
  ['IQ / Baseband','In-phase and Quadrature — the two orthogonal components of a complex baseband signal. Together they represent the full amplitude and phase of an RF signal after downconversion.'],
  ['LO','Local Oscillator — the reference frequency used by the SDR mixer to downconvert RF to baseband. Two receivers sharing the same LO are phase-coherent and can be used for direction finding.'],
  ['MMSI','Maritime Mobile Service Identity — a 9-digit number uniquely identifying a vessel radio. The first 3 digits are the Maritime Identification Digit (MID) indicating country of registration.'],
  ['MUSIC','MUltiple SIgnal Classification — the direction-finding algorithm implemented in DfApp. Eigendecomposes the spatial covariance matrix to separate signal and noise subspaces, then sweeps azimuth to find where steering vectors are orthogonal to the noise subspace.'],
  ['NRZI','Non-Return-to-Zero Inverted — a line coding where a 1 is represented by a transition and a 0 by no transition. Used in AIS and HDLC framing.'],
  ['ONNX','Open Neural Network Exchange — an open format for ML models. The AMR classifier is exported as an ONNX file and loaded by ONNX Runtime in AnalysisApp for fast cross-platform inference.'],
  ['OFDM','Orthogonal Frequency-Division Multiplexing — a multicarrier modulation where data is split across many narrow parallel subcarriers. Each subcarrier is orthogonal to the others. Used in 4G/5G, Wi-Fi, DAB, and DVB.'],
  ['PAPR','Peak-to-Average Power Ratio — the ratio of instantaneous peak power to mean power. High PAPR signals (CW tones, chirps) have very distinctive spectral peaks. Used in the persistence filter to bypass the 2-sweep confirmation for strong signals.'],
  ['PPM','Pulse-Position Modulation — the modulation used by ADS-B Mode S. Each bit is represented by a pulse in the first or second half of a 2 μs slot. Results in the distinctive wideband burst pattern.'],
  ['PRN','Pseudo-Random Noise code — the spreading code used by GPS C/A signals. Each satellite transmits on the same frequency but with a unique 1023-chip PRN code. Correlation with the known PRN reveals the satellite.'],
  ['RRC','Root-Raised Cosine — a pulse shaping filter used in digital communications to minimise intersymbol interference while confining bandwidth. The matched filter at the receiver is also RRC.'],
  ['SoapySDR','Vendor-neutral SDR hardware abstraction library. Provides a unified API for RTL-SDR, HackRF, USRP, LimeSDR, PlutoSDR, SDRplay, and any device with a SoapySDR plugin.'],
  ['SNR','Signal-to-Noise Ratio — the ratio of signal power to noise power, usually in dB. The 47-class ML model reaches peak accuracy above ~15 dB SNR for most classes.'],
  ['TSBK','Trunking System Busy Key — the P25 control channel message unit. Each TSBK is 12 bytes and carries one opcode (channel grant, IDEN_UP, RFSS_STATUS, etc.) with Golay error correction.'],
  ['UCA','Uniform Circular Array — antenna element geometry where N elements are equally spaced around a circle. Used by DfApp for direction finding. Optimal element spacing is λ/2 at the target frequency.'],
  ['WACN','Wide Area Communications Network — a 20-bit identifier for a P25 network (e.g. 0xBEE00 for a regional public safety system). Used by DfApp\'s P25 rogue site detector to flag unexpected WACN changes.'],
];

window.openGlossary  = function() {
  document.getElementById('glossaryDrawer').style.right = '0';
  document.getElementById('glossaryBackdrop').style.display = 'block';
  buildGlossary('');
  document.getElementById('glossarySearch').focus();
};
window.closeGlossary = function() {
  document.getElementById('glossaryDrawer').style.right = '-400px';
  document.getElementById('glossaryBackdrop').style.display = 'none';
};

function buildGlossary(q) {
  const dl = document.getElementById('glossaryList');
  dl.innerHTML = '';
  GLOSSARY.filter(([t, d]) => !q || t.toLowerCase().includes(q) || d.toLowerCase().includes(q))
    .forEach(([term, def]) => {
      dl.innerHTML += `<dt>${term}</dt><dd>${def}</dd>`;
    });
}
document.addEventListener('DOMContentLoaded', () => {
  const gs = document.getElementById('glossarySearch');
  if (gs) gs.addEventListener('input', () => buildGlossary(gs.value.toLowerCase()));
});

// ── Full-text search ──────────────────────────────────────────────────────────
let searchIndex = [];
function buildSearchIndex() {
  searchIndex = [];
  document.querySelectorAll('section, h2, h3, h4, p, td, li').forEach(el => {
    const text = el.textContent.trim();
    if (!text || text.length < 10) return;
    const section = el.closest('section');
    const heading = section ? section.querySelector('h2')?.textContent : '';
    const id = section?.id || '';
    searchIndex.push({ text, heading, id, el });
  });
}

function runSearch(q) {
  const results = document.getElementById('searchResults');
  if (!q.trim()) { results.innerHTML = '<p style="padding:1rem;color:var(--muted);font-size:.84rem">Type to search…</p>'; return; }
  const ql = q.toLowerCase();
  const hits = [];
  const seen = new Set();
  searchIndex.forEach(({ text, heading, id }) => {
    if (!text.toLowerCase().includes(ql)) return;
    const key = id || heading;
    if (seen.has(key)) return;
    seen.add(key);
    const idx = text.toLowerCase().indexOf(ql);
    const ctx = text.slice(Math.max(0, idx-40), idx+80).replace(/\s+/g,' ');
    const hi = ctx.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi'), m => `<mark>${m}</mark>`);
    hits.push({ heading, id, ctx: hi });
  });
  if (!hits.length) { results.innerHTML = '<p style="padding:1rem;color:var(--muted);font-size:.84rem">No results found.</p>'; return; }
  results.innerHTML = hits.slice(0, 8).map(h =>
    `<div class="search-hit" onclick="document.getElementById('searchOverlay').classList.remove('open');document.getElementById('${h.id}')?.scrollIntoView({behavior:'smooth'})">
      <div class="search-hit-title">${h.heading || 'Documentation'}</div>
      <div class="search-hit-ctx">…${h.ctx}…</div>
    </div>`).join('');
}

function openSearch() {
  const ov = document.getElementById('searchOverlay');
  ov.classList.add('open');
  document.getElementById('searchInput').focus();
  if (!searchIndex.length) buildSearchIndex();
}

document.addEventListener('DOMContentLoaded', () => {
  const si = document.getElementById('searchInput');
  if (si) {
    si.addEventListener('input', e => runSearch(e.target.value));
    si.addEventListener('keydown', e => { if (e.key === 'Escape') document.getElementById('searchOverlay').classList.remove('open'); });
  }
  document.getElementById('searchOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('searchOverlay')) document.getElementById('searchOverlay').classList.remove('open');
  });
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if ((e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey)))) {
    e.preventDefault(); openSearch();
  }
  if (e.key === 'Escape') {
    document.getElementById('searchOverlay')?.classList.remove('open');
    closeGlossary();
  }
  if (e.key === 't' && !e.ctrlKey && !e.metaKey) {
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
  }
  if (e.key === 'g' && !e.ctrlKey && !e.metaKey) window.open('https://github.com/OpenRFStack','_blank');
});

window.addEventListener('scroll', setActive, { passive: true });
window.addEventListener('load', () => {
  setActive();
  animateBars();
  initIqCanvas();
  initSearch();
  initTheme();
  initCopyButtons();
  initFreqChart();
});
setActive();
