// Live or demo. Live is the default: the hospital is driven by the Sanjeevani backend.
// ?demo=1 runs the original fully simulated hospital, with no backend.
// ?api=http://10.0.0.5:8787 points live mode at the voice service on another machine.
const q = new URLSearchParams(location.search);

export const DEMO = q.has('demo') && q.get('demo') !== '0';
export const API = (q.get('api') ?? `${location.protocol}//${location.hostname || 'localhost'}:8787`).replace(/\/$/, '');
export const EVENTS_URL = `${API.replace(/^http/, 'ws')}/events`;

// Pods map onto the wards of Level 1. Rooms are beds inside them, west to east.
export const PODS = {
  'pod-a': { ward: 'ward_a', name: 'Ward A', rooms: ['room-2', 'room-4', 'room-6', 'room-8'] },
  'pod-b': { ward: 'ward_b', name: 'Ward B', rooms: ['room-3'] },
};

// Level 1 rooms the Sanjeevani story doesn't use. Live mode closes them off (roofed, unlabeled).
export const CLOSED_ROOMS = ['icu', 'or1', 'or2', 'ward_c'];

export const NURSES = {
  maya: { name: 'Maya Reyes', short: 'Maya', shift: 'Night', pod: 'pod-a' },
  jordan: { name: 'Jordan Ellis', short: 'Jordan', shift: 'Day', pod: 'pod-a' },
  sam: { name: 'Sam Okoro', short: 'Sam', shift: 'Night', pod: 'pod-b' },
};

// Shown until the backend's /state answers, so the first frame already has the right people.
export const PATIENTS = {
  'room-2': { name: 'Daniel Okafor', age: 67, diagnosis: 'Community-acquired pneumonia, on 2 L oxygen', vitals: { hr: 96, spo2: 93, rr: 21, sys: 128, dia: 76, temp: 38.1 } },
  'room-4': { name: 'Linda Park', age: 58, diagnosis: 'Left total knee replacement, post-op day 1', vitals: { hr: 84, spo2: 97, rr: 16, sys: 134, dia: 80, temp: 37.2 } },
  'room-6': { name: 'Walter Hughes', age: 81, diagnosis: 'Right hip pain after a fall, high fall risk', vitals: { hr: 72, spo2: 95, rr: 16, sys: 142, dia: 84, temp: 36.7 } },
  'room-8': { name: 'Grace Lee', age: 45, diagnosis: 'Type 1 diabetes, glucose being stabilised', vitals: { hr: 78, spo2: 98, rr: 14, sys: 118, dia: 74, temp: 36.8 } },
  'room-3': { name: 'Grace Li', age: 52, diagnosis: 'Left leg cellulitis, IV antibiotics', vitals: { hr: 82, spo2: 97, rr: 16, sys: 126, dia: 78, temp: 37.6 } },
};

export const roomLabel = (room) => String(room ?? '').replace('room-', 'Room ');
export const podOfRoom = (room) => Object.keys(PODS).find((p) => PODS[p].rooms.includes(room));

// Relay names to people-friendly ones: twin-room-6 → "Room 6 Twin", nurse-pod-a → "Pod A Nurse Agent".
export function agentLabel(id) {
  const s = String(id ?? '');
  if (s.startsWith('twin-')) return `${roomLabel(s.slice(5))} Twin`;
  if (s.startsWith('nurse-')) return `${PODS[s.slice(6)]?.name ?? s.slice(6)} Nurse Agent`;
  if (s.startsWith('bedside-')) return `${roomLabel(s.slice(8))} patient`;
  if (NURSES[s]) return NURSES[s].short;
  if (s.startsWith('#')) return 'Floor';
  return s || 'System';
}
