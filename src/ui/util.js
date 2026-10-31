// Small helpers shared by every UI module.
import { C } from '../style/palette.js';
import { ROOMS, roomById } from '../world/plan.js';

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const damp = (k, dt) => 1 - Math.exp(-k * dt);
export const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const setText = (n, v) => { const s = String(v); if (n && n.textContent !== s) n.textContent = s; };

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
export const heat = (t) => (t < 0.5 ? mix(C.teal, C.watch, t * 2) : mix(C.watch, C.coral, (t - 0.5) * 2));

/** A number that eases toward its target and only reports when the displayed text would change. */
export class Eased {
  constructor(v = 0, k = 5) { this.v = v; this.to = v; this.k = k; this.primed = false; }
  set(to) { if (!this.primed || calm()) { this.v = to; this.primed = true; } this.to = to; }
  step(dt) { this.v += (this.to - this.v) * damp(this.k, dt); if (Math.abs(this.to - this.v) < 0.02) this.v = this.to; return this.v; }
}

/** Soft sparkline: midpoint-smoothed line plus the closed area under it. */
export function sparkPaths(values, w, h) {
  const v = (values ?? []).slice(-48).filter(Number.isFinite);
  if (v.length < 2) return null;
  let lo = Math.min(...v), hi = Math.max(...v);
  if (hi - lo < 1e-3) { lo -= 1; hi += 1; }
  const pts = v.map((y, i) => [(i / (v.length - 1)) * (w - 4) + 1, h - 3 - ((y - lo) / (hi - lo)) * (h - 7)]);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += `Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const end = pts[pts.length - 1];
  d += `L${end[0].toFixed(1)} ${end[1].toFixed(1)}`;
  return { line: d, area: `${d}L${end[0].toFixed(1)} ${h}L${pts[0][0].toFixed(1)} ${h}Z`, end };
}

export const roomName = (twin, id) => twin?.rooms?.get?.(id)?.name ?? roomById(id)?.name ?? 'Hospital';
export const floorName = (i) => (i === 1 ? 'Level 1' : 'Ground floor');
// Rooms closed off in live mode (not part of the story): no labels, no busy map, no bed markers.
export const hiddenRooms = new Set();
export const publicRooms = () => ROOMS.filter((r) => !r.circulation && !hiddenRooms.has(r.id));

export const ROLE = {
  nurse: 'Nurse', doctor: 'Doctor', surgeon: 'Surgeon', tech: 'Technician', paramedic: 'Paramedic', porter: 'Porter',
  cleaner: 'Cleaner', reception: 'Receptionist', pharmacist: 'Pharmacist', patient: 'Patient', visitor: 'Visitor',
};
export const ROLE_TINT = {
  nurse: C.scrubNurse, doctor: '#7f9fd6', surgeon: C.scrubSurgeon, tech: C.scrubTech, paramedic: C.paramedic, porter: C.scrubPorter,
  cleaner: '#9db8c7', reception: C.rose, pharmacist: C.leafLight, patient: '#9fbfdc', visitor: C.woodLight,
};
// The contract has no field for why someone is here, so read the sim's condition when it is present.
export const reasonOf = (a) => a?.reason ?? a?._cond?.reason ?? a?.task ?? '';
export const initials = (name) => String(name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
export const avatar = (a, size = '') => `<span class="hv-av ${size}" style="--t:${ROLE_TINT[a?.role] ?? C.steel}">${esc(initials(a?.name))}</span>`;
export const ago = (min) => (min < 1 ? 'just now' : min < 60 ? `${Math.round(min)} min ago` : `${Math.round(min / 60)} h ago`);
export const clockAt = (m) => {
  if (!Number.isFinite(m)) return '';
  const t = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
};
