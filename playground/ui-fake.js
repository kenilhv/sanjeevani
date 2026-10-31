// A pretend hospital for developing the interface before (or without) the real scene.
// Draws the floor plan as flat isometric plates and runs a small fake twin behind the contract.
import { mountUI } from '/src/ui/index.js';
import { ROOMS, roomCentre, FLOOR_HEIGHT } from '/src/world/plan.js';
import { C, THEMES } from '/src/style/palette.js';

const q = new URLSearchParams(location.search);
const stage = document.getElementById('stage');
// ?real=1 keeps this fake twin but runs it on the real engine, shell and props.
const real = q.has('real');
const cv = document.createElement('canvas');
if (!real) stage.append(cv);
const g = cv.getContext('2d');

const ls = {};
const emit = (e, a) => (ls[e] ?? []).forEach((f) => f(a));
const on = (e, f) => (ls[e] ??= []).push(f);

const fakeEngine = {
  ctx: { night: 0 }, zoom: 1, floorMode: 'ground', azimuthIndex: 0, stats: { fps: 60 }, on, emit,
  setFloorMode(m) { this.floorMode = m; emit('view', { azimuthIndex: 0, floorMode: m, zoom: this.zoom }); },
  floorVisible(i) { return this.floorMode === 'stack' || (this.floorMode === 'ground' ? i === 0 : i === 1); },
  rotate() {}, setHours() {}, pulse() {}, addPickable() {}, removePickable() {}, setQuality() {}, intro: async () => {},
  async flyTo(o) { if (o.zoom) this.zoom = o.zoom; emit('view', { azimuthIndex: 0, floorMode: this.floorMode, zoom: this.zoom }); },
  async focusRoom() { this.zoom = 1.8; emit('view', { azimuthIndex: 0, floorMode: this.floorMode, zoom: this.zoom }); },
  async resetView() { this.zoom = 1; emit('view', { azimuthIndex: 0, floorMode: this.floorMode, zoom: 1 }); },
  floorY: (i) => (fakeEngine.floorMode === 'stack' ? i * 11 : i * FLOOR_HEIGHT),
  project(x, y, z) {
    const s = 15.5 * this.zoom * Math.min(innerWidth / 1600, innerHeight / 1000) * 1.0;
    const cx = innerWidth / 2, cy = innerHeight * 0.53;
    const dx = x - 19, dz = z - 13;
    return { x: cx + (dx - dz) * s * 0.866, y: cy + (dx + dz) * s * 0.42 - y * s * 0.82, visible: true };
  },
};

let engine = fakeEngine, realShell = null;
if (real) {
  const [{ createEngine }, { buildShell }, cl, fu, ou] = await Promise.all(['/src/engine/index.js', '/src/world/shell.js', '/src/props/clinical.js', '/src/props/furniture.js', '/src/props/outdoor.js'].map((u) => import(u)));
  cl.registerClinicalProps(); fu.registerFurnitureProps(); ou.registerOutdoorProps();
  engine = createEngine(stage, { quality: 'low' });
  realShell = buildShell(engine);
}

const NAMES = 'Maya Chen,Tom Okafor,Priya Nair,Lena Fischer,Sam Ortiz,Grace Lee,Noah Patel,Ava Rossi,Ben Adeyemi,Iris Novak,Omar Haddad,Ruth Kim,Theo Silva,Nina Berg,Jon Reyes,Zoe Clark,Ali Rahman,Eve Murphy,Max Lund,Rosa Diaz'.split(',');
const REASONS = ['Recovering from hip surgery', 'Pneumonia, on antibiotics', 'Heart rhythm being monitored', 'Broken wrist, waiting for X-ray', 'Chest pain, being checked', 'Observation after a fall'];
const rooms = new Map(), beds = new Map(), equipment = new Map();
const actors = [];
let aid = 0;
const mkActor = (o) => { const a = { id: `p${aid++}`, name: NAMES[aid % NAMES.length], floor: 0, x: 0, z: 0, y: 0, heading: 0, anim: 'idle', speed: 1.3, status: 'ok', hidden: false, seed: aid, ...o }; actors.push(a); return a; };

for (const r of ROOMS) {
  const cap = r.circulation ? 0 : Math.round(r.rect.w * r.rect.d / 16);
  rooms.set(r.id, { id: r.id, name: r.name, dept: r.dept, floor: r.floor, capacity: cap, occupied: 0, occupancy: 0, status: 'calm', waiting: 0, staffIds: [], patientIds: [] });
}
['ward_a', 'ward_b', 'ward_c', 'icu', 'er'].forEach((rid, ri) => {
  const r = ROOMS.find((x) => x.id === rid), R = rooms.get(rid);
  const spots = realShell ? realShell.placed.filter((p) => p.meta?.bed && p.roomId === rid) : null;
  const n = spots ? spots.length : rid === 'er' ? 7 : 5;
  R.capacity = n;
  for (let i = 0; i < n; i++) {
    const id = spots ? spots[i].entry.id : `${rid === 'er' ? 'ER' : rid === 'icu' ? 'ICU' : rid.slice(-1).toUpperCase()}${i + 1}`;
    const occ = Math.random() < 0.72;
    const b = { id, roomId: rid, floor: r.floor, x: spots ? spots[i].world.x : r.rect.x + 1.6 + (i % 3) * (r.rect.w / 3.2), z: spots ? spots[i].world.z : r.rect.z + 2 + Math.floor(i / 3) * 4, heading: 0, kind: rid === 'er' ? 'er' : rid === 'icu' ? 'icu' : 'ward', status: occ ? 'occupied' : Math.random() < 0.3 ? 'cleaning' : 'free', patientId: null, vitals: { hr: 72, spo2: 98, rr: 16, sys: 122, dia: 78, temp: 36.8 }, alarm: null };
    beds.set(id, b);
    if (occ) {
      const a = mkActor({ kind: 'patient', role: 'patient', floor: r.floor, x: b.x, z: b.z, anim: 'lie', roomId: rid, bedId: id, task: 'Resting in bed', reason: REASONS[(ri + i) % REASONS.length] });
      b.patientId = a.id; R.patientIds.push(a.id);
    }
  }
});
const roles = ['nurse', 'nurse', 'nurse', 'doctor', 'nurse', 'tech', 'porter', 'cleaner', 'pharmacist', 'doctor', 'nurse', 'surgeon', 'reception', 'nurse'];
const TASKS = { nurse: 'Doing the medicine round', doctor: 'Seeing patients on the ward', tech: 'Running a scan', porter: 'Taking a patient to X-ray', cleaner: 'Cleaning a bed', pharmacist: 'Filling prescriptions', surgeon: 'Scrubbing in', reception: 'Welcoming visitors' };
const rids = ROOMS.filter((r) => !r.circulation);
for (let i = 0; i < 26; i++) {
  const role = roles[i % roles.length], r = rids[i % rids.length], c = roomCentre(r);
  const a = mkActor({ kind: 'staff', role, floor: r.floor, x: c.x, z: c.z, anim: i % 3 ? 'work' : 'walk', roomId: r.id, task: TASKS[role] });
  rooms.get(r.id).staffIds.push(a.id);
}
[['MRI1', 'radiology', 'mri', 'MRI scanner', 0.84, 'Running well. Next service in three weeks.'], ['CT1', 'radiology', 'ct', 'CT scanner', 0.92, ''], ['XRAY1', 'radiology', 'xray', 'X-ray machine', 0.71, ''], ['VENT1', 'icu', 'vent', 'Ventilator', 0.95, '']].forEach(([id, roomId, type, name, health, note], i) =>
  equipment.set(id, { id, roomId, type, name, status: i % 2 ? 'idle' : 'in-use', health, note }));

const ROUTE = [{ x: 7, z: 12 }, { x: 14, z: 12.5 }, { x: 22, z: 12.5 }, { x: 26, z: 13.5 }, { x: 26, z: 18 }];
const twin = {
  speed: 1, paused: false, clock: { minutes: 9 * 60 + 42, hours: 9.7, label: '09:42', dayPart: 'Morning' },
  actors, vehicles: [{ id: 'v1', type: 'ambulance', x: 45, y: 0, z: 26, heading: 0, lights: true, doors: false, rotor: 0, label: 'Ambulance 12', eta: 6 }],
  beds, rooms, equipment, alerts: [], feed: [], scenario: 'normal',
  metrics: { occupancyPct: 74, bedsFree: 7, bedsTotal: 27, erWaitMin: 18, patientsInHouse: 54, staffOnDuty: 42, staffBusyPct: 71, activeAlerts: 0, admissionsToday: 14, dischargesToday: 11, avgStayHours: 62, orUtilPct: 68 },
  history: { occupancy: [], erWait: [], staffBusy: [], throughput: [] },
  on, tick, setSpeed(n) { twin.speed = n; }, setPaused(b) { twin.paused = b; },
  setHours(h) { twin.clock.hours = h; twin.clock.minutes = h * 60; sync(); },
  ack(id) { const a = twin.alerts.find((x) => x.id === id); if (a) a.resolved = true; },
  routeOf: () => ROUTE,
  runScenario(s) {
    twin.scenario = s; emit('scenario', s);
    if (s === 'codeblue') raise({ severity: 'critical', title: 'Code blue in Ward B', detail: 'The resuscitation team is on the way. 40 seconds out.', bedId: 'B2', roomId: 'ward_b' });
    if (s === 'mrifault') { equipment.get('MRI1').status = 'fault'; equipment.get('MRI1').health = 0.22; raise({ severity: 'watch', title: 'MRI is showing early wear', detail: 'A coolant pump is slowing. Fixing it tonight avoids cancelled scans.', roomId: 'radiology' }); }
    if (s === 'flu') raise({ severity: 'info', title: 'Flu cases are rising', detail: 'Two extra nurses are moving to Emergency.', roomId: 'er' });
  },
  ask(qq) {
    if (/bed/i.test(qq)) return { answer: `There are ${twin.metrics.bedsFree} beds free. Ward A has the most room, with three ready now.`, focus: { roomId: 'ward_a' }, highlights: ['ward_a', 'ward_b'] };
    if (/mri/i.test(qq)) return { answer: 'The MRI is running well. Its next service is in three weeks.', focus: { roomId: 'radiology' }, highlights: ['radiology'] };
    return { answer: 'Everything looks calm. Emergency is seeing people in about 18 minutes.', focus: { roomId: 'er' }, highlights: ['er'] };
  },
};
function raise(o) {
  const a = { id: `a${Date.now()}`, at: twin.clock.minutes, resolved: false, ...o };
  twin.alerts.push(a);
  if (a.bedId && beds.get(a.bedId)) { beds.get(a.bedId).alarm = a.severity === 'critical' ? 'critical' : 'watch'; }
  emit('alert', a);
}
function sync() {
  const c = twin.clock;
  c.hours = (c.minutes / 60) % 24;
  const m = Math.floor(c.minutes) % 1440;
  c.label = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const h = c.hours;
  c.dayPart = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  const night = h > 21 || h < 5 ? 1 : h > 18 ? (h - 18) / 3 : h < 7 ? (7 - h) / 2 : 0;
  engine.ctx.night = Math.min(1, night);
}
const CHAT = [
  ['Triage', 'Beds', 'Ambulance 12 is six minutes out with a chest pain. Can you hold a bay?', 'request', 'er'],
  ['Beds', 'Triage', 'Bay ER3 is yours. Cleaning finished a minute ago.', 'ack', 'er'],
  ['Staffing', 'Triage', 'Nurse Okafor is closest. Sending her now.', 'handoff', 'er'],
  ['Imaging', 'Beds', 'CT has a gap at 10:15 if you need it for the new arrival.', 'request', 'radiology'],
  ['Pharmacy', 'Staffing', 'Ward B morning medicines are ready for pick-up.', 'handoff', 'ward_b'],
  ['Facilities', 'Imaging', 'I can look at the MRI pump tonight after the last scan.', 'ack', 'radiology'],
];
let chatI = 0, fid = 0, histAcc = 0, chatAcc = 5;
function pushChat() {
  const [from, to, text, kind, roomId] = CHAT[chatI++ % CHAT.length];
  const m = { id: `m${fid++}`, at: twin.clock.minutes, from, to, text, kind, roomId };
  twin.feed.push(m); emit('feed', m);
}
for (let i = 0; i < 90; i++) {
  twin.history.occupancy.push(74 + Math.sin(i / 9) * 6 + Math.sin(i / 3) * 1.5);
  twin.history.erWait.push(18 + Math.sin(i / 7) * 7 + Math.cos(i / 2.3) * 2);
  twin.history.staffBusy.push(70 + Math.sin(i / 11) * 9);
  twin.history.throughput.push(3 + Math.sin(i / 5));
}
for (let i = 0; i < 6; i++) pushChat();

function tick(dt) {
  if (twin.paused) return;
  twin.clock.minutes += dt * twin.speed;
  sync();
  for (const b of beds.values()) {
    if (!b.patientId) continue;
    const a = b.alarm === 'critical';
    const seed = b.id.charCodeAt(1);
    b.vitals.hr = (a ? 128 : 66 + seed % 22) + Math.sin(twin.clock.minutes * 0.5 + seed) * 3;
    b.vitals.spo2 = a ? 86 : 96 + (seed % 3);
    b.vitals.sys = 118 + (seed % 19); b.vitals.dia = 72 + (seed % 9); b.vitals.temp = 36.5 + (seed % 10) / 8; b.vitals.rr = 14 + (seed % 7);
  }
  for (const r of rooms.values()) {
    const seed = r.id.length * 7 + r.id.charCodeAt(0);
    r.occupied = r.patientIds.length || (r.capacity ? (seed % r.capacity) : 0);
    r.occupancy = r.capacity ? Math.min(1, r.occupied / r.capacity) : 0;
    r.status = r.occupancy > 0.9 ? 'full' : r.occupancy > 0.65 ? 'busy' : 'calm';
    if (r.id === 'er') r.waiting = 3;
  }
  const m = twin.metrics;
  m.bedsFree = [...beds.values()].filter((b) => b.status === 'free').length; m.bedsTotal = beds.size;
  m.erWaitMin = 18 + Math.sin(twin.clock.minutes / 20) * 6 + (twin.scenario === 'flu' ? 28 : 0);
  m.staffOnDuty = 42; m.staffBusyPct = 71 + Math.sin(twin.clock.minutes / 30) * 8;
  m.activeAlerts = twin.alerts.filter((a) => !a.resolved).length;
  histAcc += dt;
  if (histAcc > 2) { histAcc = 0; for (const [k, v] of [['occupancy', 74], ['erWait', m.erWaitMin], ['staffBusy', m.staffBusyPct]]) { twin.history[k].push(v); twin.history[k].shift(); } }
  chatAcc += dt;
  if (chatAcc > 7) { chatAcc = 0; pushChat(); }
}

const shell = realShell ?? {
  rooms: new Map(ROOMS.map((r) => [r.id, { room: r, centre: { ...roomCentre(r), y: 0 }, floor: r.floor }])),
  entities: new Map(), placed: [], tints: new Map(), update() {}, setWallMode() {},
  setRoomTint(id, c, a) { c ? shell.tints.set(id, [c, a]) : shell.tints.delete(id); },
  highlight: null, highlightRoom(id) { shell.highlight = id; },
};
const people = { update() {}, setLayer() {}, highlight() {} };

function draw() {
  const dpr = Math.min(devicePixelRatio, 2);
  if (cv.width !== innerWidth * dpr) { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = engine.ctx.night;
  const sky = g.createLinearGradient(0, 0, 0, innerHeight);
  sky.addColorStop(0, n > 0.5 ? '#2a3350' : C.backdropLight); sky.addColorStop(1, n > 0.5 ? '#1c2440' : C.backdrop);
  g.fillStyle = sky; g.fillRect(0, 0, innerWidth, innerHeight);
  const plate = (x, z, w, d, y, fill) => {
    const P = [[x, z], [x + w, z], [x + w, z + d], [x, z + d]].map(([a, b]) => engine.project(a, y, b));
    g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fillStyle = fill; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.stroke();
  };
  plate(-9, -9, 62, 48, -0.2, n > 0.5 ? '#3a5a5a' : C.grass);
  [0, 1].forEach((f) => {
    if (!engine.floorVisible(f)) return;
    for (const r of ROOMS.filter((x) => x.floor === f)) {
      const th = THEMES[r.theme];
      const t = shell.tints.get(r.id);
      plate(r.rect.x, r.rect.z, r.rect.w, r.rect.d, engine.floorY(f), t ? t[0] : th.tile[0]);
    }
  });
  g.fillStyle = 'rgba(44,47,56,.5)';
  for (const a of actors) {
    if (!engine.floorVisible(a.floor)) continue;
    const p = engine.project(a.x, engine.floorY(a.floor) + 0.5, a.z);
    g.beginPath(); g.arc(p.x, p.y, 3 * engine.zoom, 0, 7); g.fill();
  }
}

if (q.has('hours')) twin.setHours(Number(q.get('hours')));
tick(0.01);
const ui = mountUI({ engine, twin, shell, people, root: document.getElementById('ui'), params: q });
window.__twin = { engine, shell, twin, people, ui };
let last = performance.now(), frames = 0;
if (real) {
  engine.onFrame((dt, t) => { twin.tick(dt); engine.setHours(twin.clock.hours); shell.update(dt, t, twin); ui.update(dt, t); if (++frames === 3) window.__ready = true; });
  engine.start();
} else (function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  twin.tick(dt); draw(); ui.update(dt, now / 1000);
  if (++frames === 3) window.__ready = true;
  requestAnimationFrame(loop);
})(performance.now());
