// Vitals, alarms, equipment, room status, metrics and history. All of it runs on the one-minute beat.
import { raise, resolveAlert, postJob, say, showBubble } from './core.js';
import { go, bedSpot, faceBed, inBed } from './life.js';
import { pronoun, EQUIP_NOTES } from './data.js';
import { engineerVisit } from './flows.js';

const KEYS = ['hr', 'spo2', 'rr', 'sys', 'dia', 'temp'];
const NOISE = { hr: 0.9, spo2: 0.14, rr: 0.3, sys: 0.95, dia: 0.6, temp: 0.012 };
const EPISODES = {
  breath: {
    off: { hr: 22, spo2: -13, rr: 14 },
    title: (p, b) => `${p.display} in ${b.id} is struggling to breathe`,
    detail: (p, b) => `${pronoun(p).His} oxygen level has dropped to ${b.vitals.spo2}%.`,
    fix: (a, p) => `${a.display} sat ${pronoun(p).him} up and turned up the oxygen. Numbers are recovering.`,
  },
  heart: {
    off: { hr: 62, sys: 10, rr: 6 },
    title: (p, b) => `${p.display}'s heart is racing in ${b.id}`,
    detail: (p, b) => `${pronoun(p).His} heart rate has reached ${b.vitals.hr} beats a minute.`,
    fix: (a, p) => `${a.display} gave ${pronoun(p).him} medicine to steady it. Heart rate is settling.`,
  },
  pressure: {
    off: { sys: -44, dia: -22, hr: 32 },
    title: (p, b) => `${p.display}'s blood pressure is dropping in ${b.id}`,
    detail: (p, b) => `${pronoun(p).His} blood pressure is ${b.vitals.sys} over ${b.vitals.dia}.`,
    fix: (a, p) => `${a.display} started fluids for ${pronoun(p).him}. Blood pressure is coming back up.`,
  },
  fever: {
    off: { temp: 2.4, hr: 28, rr: 7 },
    title: (p, b) => `${p.display} in ${b.id} is running a high fever`,
    detail: (p, b) => `${pronoun(p).His} temperature is ${b.vitals.temp} degrees.`,
    fix: (a, p) => `${a.display} gave ${pronoun(p).him} something for the fever. It is coming down.`,
  },
};
const assess = (v, m = 0) => {
  if (v.spo2 < 87.5 + m || v.hr > 136 - m * 3 || v.hr < 40 + m || v.sys < 82 + m * 2 || v.rr > 33 - m) return 'critical';
  if (v.spo2 < 91 + m || v.hr > 118 - m * 3 || v.hr < 48 + m || v.sys < 94 + m * 2 || v.rr > 26 - m || v.temp > 38.9 - m * 0.1) return 'watch';
  return null;
};
export function publishVitals(bed, v) {
  bed.vitals.hr = Math.round(v.hr); bed.vitals.spo2 = Math.round(Math.min(100, v.spo2)); bed.vitals.rr = Math.round(v.rr);
  bed.vitals.sys = Math.round(v.sys); bed.vitals.dia = Math.round(v.dia); bed.vitals.temp = Math.round(v.temp * 10) / 10;
}
export function clearVitals(bed) { for (const k of KEYS) bed.vitals[k] = 0; }

export function updateVitals(sim) {
  const { rng } = sim;
  for (const bed of sim.beds.values()) {
    const p = bed.patientId ? sim.byId.get(bed.patientId) : null;
    if (!p) continue;
    const v = p._v, b = p._base, tr = p._trend;
    let off = null, sev = 0;
    if (tr) {
      tr.sev += tr.dir > 0 ? 1 / tr.ramp : -1 / 7;
      if (tr.sev <= 0) p._trend = null;
      else { tr.sev = Math.min(tr.sev, 1.08); off = EPISODES[tr.kind].off; sev = tr.sev; }
    }
    for (const k of KEYS) {
      const target = b[k] + (off?.[k] ?? 0) * sev;
      v[k] += (target - v[k]) * 0.3 + NOISE[k] * rng.gauss();
    }
    if (p._crash) { v.hr += (p._crash.hr - v.hr) * 0.5; v.spo2 += (p._crash.spo2 - v.spo2) * 0.5; v.sys += (p._crash.sys - v.sys) * 0.5; }
    publishVitals(bed, v);
    if (p._crash) continue;
    const next = assess(v, bed.alarm ? 1.5 : 0);
    if (next === bed.alarm) continue;
    bed.alarm = next;
    p.status = next ?? (p.acuity <= 2 && bed.kind === 'er' ? 'watch' : 'ok');
    if (next && tr?.dir > 0) raiseAlarm(sim, p, bed, next);
  }
}
function raiseAlarm(sim, p, bed, level) {
  const e = EPISODES[p._trend.kind];
  if (!p._alert) {
    p._alert = raise(sim, { severity: level, title: e.title(p, bed), detail: `${e.detail(p, bed)} A nurse is on the way.`, roomId: bed.roomId, bedId: bed.id, actorId: p.id });
    showBubble(sim, p, 'alert', 12);
    postAlarmJob(sim, p, bed);
    sim.emit('moment', { text: p._alert.title, roomId: bed.roomId, bedId: bed.id });
  } else if (level === 'critical' && p._alert.severity !== 'critical') {
    p._alert.severity = 'critical';
    p._alert.detail = `${e.detail(p, bed)} This is getting urgent.`;
    sim.emit('alert', p._alert);
    sim.emit('moment', { text: p._alert.title, roomId: bed.roomId, bedId: bed.id });
    say(sim, 'Staffing', 'Bed', `${bed.id} is getting worse. Sending a doctor as well.`, 'alert', bed.roomId);
    // A nurse is already at the bedside, so a ward alarm waits for a ward doctor rather than emptying Emergency of both of its own.
    const stale = () => !p.alive || p.bedId !== bed.id || !p._trend;
    postJob(sim, {
      role: 'doctor', zone: bed.kind === 'er' ? 'er' : 'ward', pri: 5, exclusive: Infinity,
      run: function* (d) {
        if (stale()) return;
        const s = bedSpot(bed, d);
        d.task = `Rushing to ${p.display}`;
        yield* go(sim, d, s, { speed: 2.4 });
        if (stale()) return;
        faceBed(d, bed); d.anim = 'work'; d.task = `Treating ${p.display}`;
        yield sim.rng.range(4, 6);
      },
    });
  }
}
function postAlarmJob(sim, p, bed) {
  postJob(sim, {
    role: 'nurse', zone: bed.roomId, pri: 5, exclusive: 1.5,
    run: function* (a) {
      let done = false;
      try {
        if (!p.alive || p.bedId !== bed.id || !p._trend) { done = true; return; }
        const al = p._alert;
        if (al) al.detail = `${a.display} is on the way to ${bed.id}.`;
        say(sim, 'Staffing', 'Bed', `${a.display} is closest to ${bed.id}, sending ${pronoun(a).him} now.`, 'handoff', bed.roomId);
        const s = bedSpot(bed, a);
        a.task = `Hurrying to ${p.display}`;
        yield* go(sim, a, s, { speed: 2.2 });
        if (p.alive && p.bedId === bed.id) {
          faceBed(a, bed);
          a.anim = 'work'; a.task = `Helping ${p.display}`;
          if (al) al.detail = `${a.display} is with ${pronoun(p).him} now.`;
          showBubble(sim, a, 'pill', 4);
          yield sim.rng.range(3.5, 5.5);
          endEpisode(sim, p, a);
        }
        done = true;
      } finally {
        if (!done && p.alive && p._trend?.dir > 0) postAlarmJob(sim, p, bed);
      }
    },
  });
}
export function startEpisode(sim, p, bed, kind) {
  const low = p._base.spo2 < 96, hot = p._base.temp > 37.4;
  const k = kind ?? (low && sim.rng.chance(0.6) ? 'breath' : hot && sim.rng.chance(0.5) ? 'fever' : sim.rng.pick(['breath', 'heart', 'pressure', 'fever']));
  p._trend = { kind: k, sev: 0, dir: 1, ramp: sim.rng.range(10, 16) };
}
export function endEpisode(sim, p, a) {
  const tr = p._trend;
  if (tr) tr.dir = -1;
  for (const k of KEYS) p._base[k] += (({ hr: 76, spo2: 97, rr: 15, sys: 122, dia: 76, temp: 36.8 })[k] - p._base[k]) * 0.3;
  if (p._alert) { resolveAlert(sim, p._alert, tr ? EPISODES[tr.kind].fix(a, p) : `${a.display} has it under control.`); p._alert = null; }
  if (p.bubble === 'alert') p.bubble = null;
  showBubble(sim, p, 'heart', 3);
}
export function episodeRoll(sim) {
  // About one deterioration every half hour of sim time across the building, weighted to the patients most at risk.
  if (!sim.rng.chance(0.034)) return;
  const pool = [];
  for (const bed of sim.beds.values()) {
    const p = bed.patientId && sim.byId.get(bed.patientId);
    if (!p || bed.kind === 'or' || p._trend || p._crash || !inBed(p)) continue;
    for (let i = 0; i <= (p._cond.risk ?? 0); i++) pool.push([p, bed]);
  }
  if (!pool.length) return;
  const [p, bed] = sim.rng.pick(pool);
  startEpisode(sim, p, bed);
}

// ── Equipment ───────────────────────────────────────────────────────────────
const DECAY = { mri: 0.00028, ct: 0.0002, xray: 0.00016, ventilator: 0.00009, analyzer: 0.00012, pillRobot: 0.00012, crashCart: 0 };
export function noteFor(eq) {
  const list = EQUIP_NOTES[eq.type];
  if (eq.status === 'fault' || eq.status === 'maintenance') return eq.note;
  return list[eq.health >= 0.85 ? 0 : eq.health >= 0.68 ? 1 : eq.health >= 0.48 ? 2 : 3];
}
export function stepEquipment(sim) {
  for (const eq of sim.equipment.values()) {
    if (eq.status === 'fault' || eq.status === 'maintenance') continue;
    if (eq.type === 'ventilator') {
      const bed = eq._bed ?? (eq._bed = nearestBed(sim, eq));
      const p = bed?.patientId && sim.byId.get(bed.patientId);
      eq.status = p && (p._cond.vent || bed.kind === 'or') ? 'in-use' : 'idle';
    } else if (eq.type === 'analyzer' || eq.type === 'pillRobot') {
      eq.status = (sim.now + eq.id.charCodeAt(eq.id.length - 1) * 7) % 26 < 17 ? 'in-use' : 'idle';
    }
    eq.health = Math.max(0.3, eq.health - (DECAY[eq.type] ?? 0) * (eq.status === 'in-use' ? 1.7 : 1) * 5);
    eq.note = noteFor(eq);
    if (eq.health < 0.42 && eq.status === 'idle' && !eq._booked && (eq.type === 'mri' || eq.type === 'ct' || eq.type === 'xray')) {
      eq._booked = true;
      sim.startProc(engineerVisit(sim, eq, { reason: 'routine service' }));
    }
    if (eq.health < 0.42 && eq.type === 'ventilator' && eq.status === 'idle') {
      eq.health = 0.98;
      say(sim, 'Facilities', 'Bed', `Swapped the filters on ${eq.name} while it was free.`, 'ack', eq.roomId);
    }
    if (eq.health < 0.42 && (eq.type === 'analyzer' || eq.type === 'pillRobot')) {
      eq.health = 0.96;
      say(sim, 'Facilities', 'Pharmacy', `${eq.name} has had its overnight service and is back to full speed.`, 'ack', eq.roomId);
    }
  }
}
function nearestBed(sim, eq) {
  let best = null, bd = 9;
  for (const b of sim.beds.values()) {
    const d = Math.hypot(b.x - eq._item.x, b.z - eq._item.z);
    if (b.floor === eq._item.floor && d < bd) { bd = d; best = b; }
  }
  return best;
}

// ── Rooms + metrics ─────────────────────────────────────────────────────────
export function updateRooms(sim) {
  for (const r of sim.rooms.values()) { r.staffIds.length = 0; r.patientIds.length = 0; r.waiting = 0; r.occupied = 0; r._people = 0; r._beds = 0; r._crit = false; }
  for (const a of sim.actors) {
    const r = sim.rooms.get(a.roomId);
    if (!r || a.hidden) continue;
    r._people++;
    if (a.kind === 'staff') r.staffIds.push(a.id);
    else if (a.kind === 'patient') { r.patientIds.push(a.id); if (a._waiting) r.waiting++; }
  }
  for (const b of sim.beds.values()) {
    const r = sim.rooms.get(b.roomId);
    if (!r) continue;
    r._beds++;
    if (b.status === 'occupied' || (b.status === 'reserved' && b._for !== 'surge')) r.occupied++;
  }
  for (const al of sim.alerts) {
    if (al.resolved || al.severity !== 'critical') continue;
    const r = sim.rooms.get(al.roomId);
    if (r) r._crit = true;
  }
  for (const r of sim.rooms.values()) {
    if (!r._beds) r.occupied = r._people;
    r.occupancy = r.capacity ? Math.min(1, r.occupied / r.capacity) : 0;
    r.status = r._crit ? 'alert' : r.occupancy >= 0.95 ? 'full' : r.occupancy >= 0.68 || r.waiting >= 5 ? 'busy' : 'calm';
  }
}
export function updateMetrics(sim) {
  const m = sim.metrics, s = sim.stats;
  let total = 0, free = 0, used = 0;
  for (const b of sim.beds.values()) {
    if (b.kind === 'or' || b._for === 'surge') continue;
    total++;
    if (b.status === 'free') free++;
    if (b.status === 'occupied' || b.status === 'reserved') used++;
  }
  m.bedsTotal = total; m.bedsFree = free; m.occupancyPct = total ? Math.round((used / total) * 100) : 0;
  let patients = 0, staff = 0, busy = 0;
  for (const a of sim.actors) {
    if (a.kind === 'patient' && !a._enRoute) patients++;
    if (a.kind === 'staff' && !a._crew) { staff++; if (a._busy || a._puppet) busy++; }
  }
  m.patientsInHouse = patients; m.staffOnDuty = staff; m.staffBusyPct = staff ? Math.round((busy / staff) * 100) : 0;
  m.activeAlerts = sim.alerts.reduce((n, al) => n + (al.resolved ? 0 : 1), 0);
  m.admissionsToday = s.admissions; m.dischargesToday = s.discharges;
  const q = sim.er.triageQ.length + sim.er.bayQ.length;
  let waited = 0, n = 0;
  for (const list of [sim.er.triageQ, sim.er.bayQ]) for (const p of list) { waited += sim.now - p._arrivedAt; n++; }
  // Nine is the floor: even with nobody queueing, check-in, triage and the walk to a bay take a quarter of an hour with the rest.
  const estimate = 9 + q * 4.2 + (n ? (waited / n) * 0.4 : 0) + (s.recentWait ?? 0) * 0.25;
  s.erWait += (estimate - s.erWait) * 0.06;
  m.erWaitMin = Math.round(s.erWait);
  m.avgStayHours = Math.round((s.stays.reduce((x, y) => x + y, 0) / Math.max(1, s.stays.length)) * 10) / 10;
  let inUse = 0, rooms = 0;
  for (const b of sim.beds.values()) if (b.kind === 'or') { rooms++; if (b.status === 'occupied' || b._busy) inUse++; }
  s.orUtil += ((rooms ? inUse / rooms : 0) * 100 - s.orUtil) * 0.008;
  m.orUtilPct = Math.round(s.orUtil);
}
const throughput = (sim) => {
  const s = sim.stats, cutoff = sim.now - 60;
  while (s.moves.length && s.moves[0] < cutoff) s.moves.shift();
  return s.moves.length;
};
export function sampleHistory(sim) {
  const h = sim.history, m = sim.metrics;
  h.occupancy.push(m.occupancyPct); h.erWait.push(m.erWaitMin); h.staffBusy.push(m.staffBusyPct); h.throughput.push(throughput(sim));
  for (const k of Object.keys(h)) if (h[k].length > 90) h[k].shift();
}
export function prefillHistory(sim) {
  const m = sim.metrics, { rng } = sim;
  const series = (cur, swing, jitter, lo, hi) => {
    const a = rng.range(0, 6.28), f = rng.range(0.05, 0.09), out = [];
    let drift = 0;
    for (let i = 0; i < 89; i++) {
      drift = drift * 0.9 + rng.gauss() * jitter;
      const fade = (89 - i) / 89;
      out.push(Math.max(lo, Math.min(hi, cur + (Math.sin(a + i * f) - Math.sin(a + 89 * f)) * swing + drift * fade)));
    }
    return out.map((v) => Math.round(v * 10) / 10);
  };
  sim.history.occupancy.push(...series(m.occupancyPct, 4, 0.7, 40, 99));
  sim.history.erWait.push(...series(m.erWaitMin, 6, 1.2, 4, 90));
  sim.history.staffBusy.push(...series(m.staffBusyPct, 7, 1.4, 20, 98));
  sim.history.throughput.push(...series(Math.max(3, throughput(sim)), 2, 0.5, 0, 30));
  sampleHistory(sim);
}
