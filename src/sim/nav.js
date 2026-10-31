// Walkable grid for one floor plate: 0.5 m cells, A* over them, then string pulling so paths read as confident straight
// walks instead of staircases. Results are cached by start and goal cell, so the common routes cost nothing after the first walk.
export const CELL = 0.5;
const D = Math.SQRT2;
const CACHE_MAX = 6000;

export class NavGrid {
  constructor(floor, x0, z0, x1, z1) {
    this.floor = floor; this.x0 = x0; this.z0 = z0;
    this.w = Math.ceil((x1 - x0) / CELL);
    this.d = Math.ceil((z1 - z0) / CELL);
    const n = this.n = this.w * this.d;
    this.solid = new Uint8Array(n).fill(1);
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.seen = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.epoch = 0;
    this.heapC = new Int32Array(8192);
    this.heapF = new Float32Array(8192);
    this.cache = new Map();
    this.searches = 0;
  }
  cell(x, z) {
    const i = Math.floor((x - this.x0) / CELL), j = Math.floor((z - this.z0) / CELL);
    return i < 0 || j < 0 || i >= this.w || j >= this.d ? -1 : i + j * this.w;
  }
  cx(c) { return this.x0 + ((c % this.w) + 0.5) * CELL; }
  cz(c) { return this.z0 + (Math.floor(c / this.w) + 0.5) * CELL; }
  free(x, z) { const c = this.cell(x, z); return c >= 0 && this.solid[c] === 0; }

  /** Sets every cell whose centre passes `test`. */
  paint(value, test, bx0 = this.x0, bz0 = this.z0, bx1 = Infinity, bz1 = Infinity) {
    const i0 = Math.max(0, Math.floor((bx0 - this.x0) / CELL)), j0 = Math.max(0, Math.floor((bz0 - this.z0) / CELL));
    const i1 = Math.min(this.w - 1, Math.floor((bx1 - this.x0) / CELL)), j1 = Math.min(this.d - 1, Math.floor((bz1 - this.z0) / CELL));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (test(this.x0 + (i + 0.5) * CELL, this.z0 + (j + 0.5) * CELL)) this.solid[i + j * this.w] = value;
      }
    }
  }
  /** Rotated rectangle. `sin`/`cos` follow three.js rotation about Y. */
  rect(value, cx, cz, w, d, sin, cos, grow = 0, x0 = -w / 2 - grow, x1 = w / 2 + grow, z0 = -d / 2 - grow, z1 = d / 2 + grow) {
    const r = Math.hypot(Math.max(-x0, x1), Math.max(-z0, z1)) + CELL;
    this.paint(value, (x, z) => {
      const dx = x - cx, dz = z - cz;
      const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
      return lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1;
    }, cx - r, cz - r, cx + r, cz + r);
  }
  /** Marks everything unreachable from the seed as solid, so `nearest` can only ever hand back a cell people can get to. */
  flood(x, z) {
    const start = this.nearest(x, z);
    const seen = new Uint8Array(this.n), stack = [start];
    seen[start] = 1;
    let reached = 0;
    while (stack.length) {
      const c = stack.pop(), i = c % this.w, j = (c / this.w) | 0;
      reached++;
      if (i > 0 && !seen[c - 1] && !this.solid[c - 1]) { seen[c - 1] = 1; stack.push(c - 1); }
      if (i < this.w - 1 && !seen[c + 1] && !this.solid[c + 1]) { seen[c + 1] = 1; stack.push(c + 1); }
      if (j > 0 && !seen[c - this.w] && !this.solid[c - this.w]) { seen[c - this.w] = 1; stack.push(c - this.w); }
      if (j < this.d - 1 && !seen[c + this.w] && !this.solid[c + this.w]) { seen[c + this.w] = 1; stack.push(c + this.w); }
    }
    for (let c = 0; c < this.n; c++) if (!seen[c] && !this.solid[c]) this.solid[c] = 2;
    return reached;
  }
  /** Closest free cell to a point, searched in growing square rings. */
  nearest(x, z, maxRing = 40) {
    const cx = Math.floor((x - this.x0) / CELL), cz = Math.floor((z - this.z0) / CELL);
    let best = -1, bestD = Infinity;
    for (let r = 0; r <= maxRing; r++) {
      for (let j = cz - r; j <= cz + r; j++) {
        if (j < 0 || j >= this.d) continue;
        const step = j === cz - r || j === cz + r ? 1 : 2 * r || 1;
        for (let i = cx - r; i <= cx + r; i += step) {
          if (i < 0 || i >= this.w) continue;
          const c = i + j * this.w;
          if (this.solid[c]) continue;
          const dd = (this.cx(c) - x) ** 2 + (this.cz(c) - z) ** 2;
          if (dd < bestD) { bestD = dd; best = c; }
        }
      }
      if (best >= 0 && r * CELL > Math.sqrt(bestD)) break;
    }
    return best;
  }
  point(x, z) {
    const c = this.nearest(x, z);
    return c < 0 ? null : { x: this.cx(c), z: this.cz(c) };
  }
  /** Sight line with a little body width, so smoothed paths stay off corners. */
  los(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    if (len < 1e-4) return true;
    const n = Math.ceil(len / 0.16), ux = (dz / len) * 0.17, uz = (-dx / len) * 0.17;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + dx * t, z = z0 + dz * t;
      if (!this.free(x, z) || !this.free(x + ux, z + uz) || !this.free(x - ux, z - uz)) return false;
    }
    return true;
  }
  /** Shared, immutable result. Callers copy before changing it. */
  find(ax, az, bx, bz) {
    const s = this.nearest(ax, az), t = this.nearest(bx, bz);
    if (s < 0 || t < 0) return null;
    const key = s * this.n + t;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    const raw = this.search(s, t);
    const path = raw && this.pull(raw);
    if (this.cache.size >= CACHE_MAX) {
      let drop = CACHE_MAX >> 3;
      for (const k of this.cache.keys()) { this.cache.delete(k); if (--drop <= 0) break; }
    }
    this.cache.set(key, path);
    return path;
  }
  search(s, t) {
    this.searches++;
    const { w, d, solid, g, came, seen, closed, heapC, heapF } = this;
    const ep = ++this.epoch, tx = t % w, tz = (t / w) | 0;
    const h = (c) => {
      const dx = Math.abs((c % w) - tx), dz = Math.abs(((c / w) | 0) - tz);
      return (dx + dz + (D - 2) * Math.min(dx, dz)) * 1.002;
    };
    let size = 0;
    const push = (c, f) => {
      if (size >= heapC.length) return;
      let i = size++;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heapF[p] <= f) break;
        heapC[i] = heapC[p]; heapF[i] = heapF[p]; i = p;
      }
      heapC[i] = c; heapF[i] = f;
    };
    const pop = () => {
      const top = heapC[0], c = heapC[--size], f = heapF[size];
      let i = 0;
      for (;;) {
        let k = 2 * i + 1;
        if (k >= size) break;
        if (k + 1 < size && heapF[k + 1] < heapF[k]) k++;
        if (heapF[k] >= f) break;
        heapC[i] = heapC[k]; heapF[i] = heapF[k]; i = k;
      }
      heapC[i] = c; heapF[i] = f;
      return top;
    };
    const relax = (n, c, cost) => {
      const ng = g[c] + cost;
      if (seen[n] === ep && g[n] <= ng) return;
      seen[n] = ep; g[n] = ng; came[n] = c;
      push(n, ng + h(n));
    };
    g[s] = 0; seen[s] = ep; came[s] = -1;
    push(s, h(s));
    while (size) {
      const c = pop();
      if (closed[c] === ep) continue;
      closed[c] = ep;
      if (c === t) break;
      const i = c % w, j = (c / w) | 0;
      const W = i > 0 && !solid[c - 1], E = i < w - 1 && !solid[c + 1], N = j > 0 && !solid[c - w], S = j < d - 1 && !solid[c + w];
      if (W) relax(c - 1, c, 1);
      if (E) relax(c + 1, c, 1);
      if (N) relax(c - w, c, 1);
      if (S) relax(c + w, c, 1);
      if (W && N && !solid[c - w - 1]) relax(c - w - 1, c, D);
      if (E && N && !solid[c - w + 1]) relax(c - w + 1, c, D);
      if (W && S && !solid[c + w - 1]) relax(c + w - 1, c, D);
      if (E && S && !solid[c + w + 1]) relax(c + w + 1, c, D);
    }
    if (closed[t] !== ep) return null;
    const out = [];
    for (let c = t; c !== -1; c = came[c]) out.push({ x: this.cx(c), z: this.cz(c) });
    return out.reverse();
  }
  pull(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    let a = 0;
    while (a < pts.length - 1) {
      let b = Math.min(a + 1, pts.length - 1);
      for (let k = pts.length - 1; k > b; k--) {
        if (this.los(pts[a].x, pts[a].z, pts[k].x, pts[k].z)) { b = k; break; }
      }
      out.push(pts[b]);
      a = b;
    }
    return out;
  }
}
