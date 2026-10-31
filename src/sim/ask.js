// Plain questions, live answers. Intent is matched by keywords, numbers always come from the running twin,
// and each answer says where to point the camera.
import { lowerFirst, pronoun } from './data.js';

const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const words = (n) => NUM[n] ?? String(n);
const list = (items) => (items.length < 2 ? items[0] ?? '' : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const STOP = new Set(['where', 'find', 'locate', 'show', 'please', 'what', 'who', 'the', 'and', 'can', 'you', 'patient', 'nurse', 'doctor', 'room', 'bed', 'now', 'right', 'today', 'mrs', 'miss', 'tell', 'about', 'how', 'many', 'much', 'are', 'there', 'our', 'any', 'free', 'busy', 'staff', 'wait', 'long', 'sick']);
const NUDGE = 'I can tell you about free beds, the Emergency wait, where someone is, who is sickest, what is busiest, how many staff are on, what a surge would do, or any equipment problems. What would you like to know?';

const roomName = (sim, id) => sim.rooms.get(id)?.name ?? 'the grounds';

function freeBeds(sim) {
  const m = sim.metrics, byRoom = new Map();
  for (const b of sim.beds.values()) if (b.status === 'free' && b.kind !== 'or') byRoom.set(b.roomId, (byRoom.get(b.roomId) ?? 0) + 1);
  const rooms = [...byRoom.entries()].sort((a, b) => b[1] - a[1]);
  if (!m.bedsFree) {
    const cleaning = [...sim.beds.values()].filter((b) => b.status === 'cleaning').length;
    return { answer: `Every bed is taken right now.${cleaning ? ` ${count(cleaning, 'bed is', 'beds are')} being cleaned and will be ready shortly.` : ''}`, focus: { roomId: 'er' }, highlights: ['ward_a', 'ward_b', 'ward_c', 'icu', 'er'] };
  }
  const where = list(rooms.map(([id, n]) => `${words(n)} in ${roomName(sim, id)}`));
  return { answer: `${m.bedsFree} of ${m.bedsTotal} beds are free: ${where}.`, focus: { roomId: rooms[0][0] }, highlights: rooms.map(([id]) => id) };
}
function erWait(sim) {
  const m = sim.metrics, wait = sim.er.triageQ.length + sim.er.bayQ.length;
  const free = [...sim.beds.values()].filter((b) => b.kind === 'er' && b.status === 'free').length;
  return {
    answer: `The Emergency wait is about ${m.erWaitMin} minutes. ${wait ? `${count(wait, 'person is', 'people are')} waiting` : 'Nobody is waiting'} and ${free ? `${words(free)} of the bays ${free === 1 ? 'is' : 'are'} free` : 'every bay is in use'}.`,
    focus: { roomId: 'er' }, highlights: ['er', 'lobby'],
  };
}
function whereIs(sim, q) {
  const tokens = q.split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t));
  if (!tokens.length) return null;
  const score = (a) => {
    const first = (a.first ?? a.name.split(' ')[0]).toLowerCase(), last = (a.surname ?? '').toLowerCase(), name = a.name.toLowerCase();
    let s = 0;
    for (const t of tokens) if (t === first) s += 2; else if (t === last) s += 3; else if (name.startsWith(t)) s += 1;
    return s;
  };
  let best = null, top = 0;
  for (const a of sim.actors) { const s = score(a); if (s > top) { top = s; best = a; } }
  if (!best) return null;
  const a = best, room = roomName(sim, a.roomId), label = a.kind === 'staff' ? a.display : a.display ?? a.name;
  const bedPart = a.bedId ? ` in bed ${a.bedId}` : '';
  const doing = a.task ? ` ${a.kind === 'patient' && a.reason ? `${pronoun(a).He} is here for ${lowerFirst(a.reason)}.` : `Right now: ${lowerFirst(a.task)}.`}` : '';
  if (a.hidden) return { answer: `${label} is on the move between floors.${doing}`, focus: { actorId: a.id } };
  return { answer: `${label} is ${a.roomId ? `in ${room}` : 'outside the building'}${bedPart}.${doing}`, focus: { actorId: a.id, roomId: a.roomId ?? undefined, bedId: a.bedId ?? undefined }, highlights: a.roomId ? [a.roomId] : [] };
}
function sickest(sim) {
  let best = null, top = -1;
  for (const bed of sim.beds.values()) {
    const p = bed.patientId && sim.byId.get(bed.patientId);
    if (!p) continue;
    const v = bed.vitals;
    const s = (bed.alarm === 'critical' ? 200 : bed.alarm === 'watch' ? 100 : 0) + (6 - (p.acuity ?? 4)) * 12 + Math.max(0, 97 - v.spo2) * 3 + Math.abs(v.hr - 76) * 0.4 + Math.max(0, 105 - v.sys) * 0.5 + (bed.kind === 'icu' ? 20 : 0);
    if (s > top) { top = s; best = { p, bed }; }
  }
  if (!best) return { answer: 'Nobody is in a bed right now, so everyone is doing well.' };
  const { p, bed } = best, v = bed.vitals, pro = pronoun(p);
  return {
    answer: `${p.display} in ${bed.id} needs the closest watching: ${lowerFirst(p.reason)}. ${pro.His} oxygen is ${v.spo2}% and heart rate ${v.hr}.`,
    focus: { bedId: bed.id, roomId: bed.roomId, actorId: p.id }, highlights: [bed.roomId],
  };
}
function busiest(sim) {
  const rooms = [...sim.rooms.values()].filter((r) => !['Circulation'].includes(r.dept));
  const load = (r) => r.occupancy + r.waiting * 0.08 + (r.status === 'alert' ? 0.5 : 0);
  rooms.sort((a, b) => load(b) - load(a));
  const [a, b] = rooms;
  const beds = (r) => [...sim.beds.values()].filter((x) => x.roomId === r.id).length;
  const say = (r) => (beds(r) ? `${r.occupied} of ${beds(r)} beds in use${r.waiting ? ` and ${r.waiting} waiting` : ''}` : `${count(r.occupied, 'person', 'people')} there now`);
  return { answer: `${a.name} is the busiest, with ${say(a)}. ${b.name} is next, with ${say(b)}.`, focus: { roomId: a.id }, highlights: [a.id, b.id] };
}
const ROLES = { nurse: 'nurse', doctor: 'doctor', surgeon: 'surgeon', porter: 'porter', cleaner: 'cleaner', paramedic: 'paramedic', pharmacist: 'pharmacist', tech: 'technician', technician: 'technician', receptionist: 'receptionist' };
function staffCount(sim, q) {
  const m = sim.metrics, staff = sim.actors.filter((a) => a.kind === 'staff' && !a._crew);
  const by = {};
  for (const a of staff) by[a.role] = (by[a.role] ?? 0) + 1;
  for (const key of Object.keys(ROLES)) {
    if (!q.includes(key)) continue;
    const role = key === 'technician' ? 'tech' : key === 'receptionist' ? 'reception' : key;
    const n = by[role] ?? 0, here = staff.filter((a) => a.role === role);
    const rooms = [...new Set(here.map((a) => a.roomId).filter(Boolean))];
    return { answer: `${count(n, ROLES[key])} on duty right now${here.some((a) => a._busy) ? `, ${here.filter((a) => a._busy).length} of them busy with patients` : ''}.`, focus: rooms[0] ? { roomId: rooms[0] } : undefined, highlights: rooms };
  }
  return {
    answer: `${m.staffOnDuty} staff are on duty: ${by.nurse ?? 0} nurses, ${(by.doctor ?? 0) + (by.surgeon ?? 0)} doctors and surgeons, and ${m.staffOnDuty - (by.nurse ?? 0) - (by.doctor ?? 0) - (by.surgeon ?? 0)} others keeping things running. ${m.staffBusyPct}% are with patients right now.`,
    highlights: [],
  };
}
function whatIf(sim) {
  const m = sim.metrics, surge = [...sim.beds.values()].filter((b) => b._surge).length;
  const waitNow = m.erWaitMin, projected = Math.round(waitNow + 34 + sim.er.bayQ.length * 4);
  const perHour = 2.6, free = m.bedsFree + (sim.surge ? 0 : surge);
  const hours = Math.max(1, Math.round((free / perHour) * 10) / 10);
  return {
    answer: `If walk-ins tripled, the Emergency wait would climb from ${waitNow} to about ${projected} minutes in two hours. The ${free} beds we can open would last about ${hours} hours, and I would call in three extra staff straight away. Want to see it? Run the flu surge.`,
    focus: { roomId: 'er' }, highlights: ['er', 'lobby', 'ward_c'],
  };
}
function equipment(sim) {
  const eq = [...sim.equipment.values()];
  const down = eq.filter((e) => e.status === 'fault' || e.status === 'maintenance');
  const worn = eq.filter((e) => e.status !== 'fault' && e.status !== 'maintenance' && e.health < 0.68).sort((a, b) => a.health - b.health);
  if (down.length) {
    const e = down[0];
    return { answer: `${e.name} is ${e.status === 'fault' ? 'out of action' : 'being serviced'}. ${e.note}${worn[0] ? ` ${worn[0].name} also needs a look soon: ${lowerFirst(worn[0].note)}` : ''}`, focus: { roomId: e.roomId }, highlights: [...new Set(down.map((d) => d.roomId))] };
  }
  if (worn.length) {
    const e = worn[0];
    return { answer: `Nothing is broken. ${e.name} is the one to watch: ${lowerFirst(e.note)}`, focus: { roomId: e.roomId }, highlights: [e.roomId] };
  }
  return { answer: `All ${eq.length} tracked machines are running well.`, focus: { roomId: 'radiology' }, highlights: ['radiology'] };
}
function alertsNow(sim) {
  const open = sim.alerts.filter((a) => !a.resolved);
  if (!open.length) return { answer: 'Nothing needs attention right now. The whole hospital is running smoothly.', highlights: [] };
  open.sort((a, b) => (a.severity === 'critical' ? -1 : 0) - (b.severity === 'critical' ? -1 : 0));
  const a = open[0];
  return { answer: `${count(open.length, 'thing needs', 'things need')} attention. The most important: ${lowerFirst(a.title)}.`, focus: { roomId: a.roomId, bedId: a.bedId, actorId: a.actorId }, highlights: [...new Set(open.map((x) => x.roomId).filter(Boolean))] };
}
function summary(sim) {
  const m = sim.metrics;
  return { answer: `${m.patientsInHouse} patients are in the building and ${m.staffOnDuty} staff are on duty. ${m.occupancyPct}% of beds are in use, ${m.bedsFree} free, and the Emergency wait is ${m.erWaitMin} minutes.`, highlights: [] };
}

export function ask(sim, question) {
  const q = ` ${String(question ?? '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ')} `;
  const has = (re) => re.test(q);
  if (!q.trim()) return { answer: NUDGE };
  if (has(/ what if | surge| what would happen| what happens if| could we cope| flu /)) return whatIf(sim);
  if (has(/ where | find | locate | who is looking after /)) { const hit = whereIs(sim, q); if (hit) return hit; }
  if (has(/sickest| worst| most (ill|unwell|critical|urgent)| critical | who needs/)) return sickest(sim);
  if (has(/ wait| queue| emergency| er | a&e| a e /)) return erWait(sim);
  if (has(/ beds?\b.*(free|left|open|available|empty)|(free|open|available|empty|spare|how many).* beds?\b|capacity| occupan| how full/)) return freeBeds(sim);
  if (has(/busiest| busy| crowded| pressure/)) return busiest(sim);
  if (has(/equipment| machine| scanner| mri | ct | x ray| xray| ventilator| broken| fault| repair/)) return equipment(sim);
  if (has(/ staff| nurses?\b| doctors?\b| surgeons?\b| porters?\b| cleaners?\b| paramedics?\b| pharmacists?\b| technicians?\b| team| on duty| on shift/)) return staffCount(sim, q);
  if (has(/ alert| problem| issue| wrong| attention| worry/)) return alertsNow(sim);
  if (has(/ how are | how is | how's | going| status| summary| overview| today/)) return summary(sim);
  const named = whereIs(sim, q);
  if (named) return named;
  return { answer: NUDGE };
}
