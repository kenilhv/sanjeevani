// A live heart trace on canvas. A real-looking beat is synthesised from the heart rate, so the
// line stays honest to the number next to it without needing any recorded signal.
const bump = (p, c, w, a) => a * Math.exp(-((p - c) ** 2) / (2 * w * w));
const beat = (p) => bump(p, 0.16, 0.024, 0.13) + bump(p, 0.335, 0.008, -0.13) + bump(p, 0.37, 0.009, 1) + bump(p, 0.405, 0.01, -0.24) + bump(p, 0.62, 0.042, 0.27);
const SPEED = 62; // pixels per second, close to a paper strip
const STOP = 0.6; // the trace ends here so the big number always sits on clean ground

export function createECG(canvas) {
  const x = canvas.getContext('2d');
  let w = 0, h = 0, N = 0, buf = null, head = 0, acc = 0, phase = 0, jitter = 1, color = '#2fbf8f', grad = null, gradFor = '';

  function fit() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return false;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    N = Math.ceil(w);
    buf = new Float32Array(N);
    grad = null;
    return true;
  }
  function advance(n, hr) {
    const rate = Math.max(hr, 0) / 60;
    for (let i = 0; i < n; i++) {
      const before = phase;
      phase = (phase + (rate * jitter) / SPEED) % 1;
      if (phase < before) jitter = 0.97 + Math.random() * 0.06; // beats are never perfectly even
      buf[head] = (rate > 0 ? beat(phase) : 0) + (Math.random() - 0.5) * 0.012;
      head = (head + 1) % N;
    }
  }
  return {
    setColor(c) { color = c; },
    tick(dt, hr) {
      if (!buf && !fit()) return;
      // Fill the strip on first show so it never starts blank.
      if (acc === 0 && head === 0) advance(N, hr);
      acc += dt * SPEED;
      const n = Math.min(acc | 0, N);
      acc -= n;
      if (n) advance(n, hr);
      x.clearRect(0, 0, w, h);
      if (gradFor !== color || !grad) {
        gradFor = color;
        grad = x.createLinearGradient(0, 0, w * STOP, 0);
        grad.addColorStop(0, `${color}00`); grad.addColorStop(0.4, `${color}99`); grad.addColorStop(1, color);
      }
      const mid = h * 0.68, amp = h * 0.58, stop = w * STOP;
      x.lineWidth = 1.9; x.lineJoin = 'round'; x.lineCap = 'round'; x.strokeStyle = grad;
      x.beginPath();
      let ex = 0, ey = mid;
      const count = Math.min(N, Math.ceil(stop));
      for (let i = 0; i < count; i++) {
        const v = buf[(head - count + i + N * 2) % N];
        ex = i; ey = mid - v * amp;
        i ? x.lineTo(ex, ey) : x.moveTo(ex, ey);
      }
      x.stroke();
      x.fillStyle = `${color}33`; x.beginPath(); x.arc(ex, ey, 6.5, 0, 6.3); x.fill();
      x.fillStyle = color; x.beginPath(); x.arc(ex, ey, 2.4, 0, 6.3); x.fill();
    },
  };
}
