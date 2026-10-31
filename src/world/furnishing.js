// Set dressing for the whole diorama. Format: docs/CONTRACT.md §5. Rooms use metres from their NW corner, exterior uses world metres.
// The default camera sits SE and looks NW, so screens, sofas and art face south or east wherever the room allows it.
// South and east partitions hide about 1.5 m of floor behind them, so nothing worth seeing lives in those strips.
import { C } from '../style/palette.js';
import { HOSPITAL_NAME } from './plan.js';

const at = (p, x, z, r = 0, extra) => ({ p, x, z, r, ...extra });
const many = (p, pts, extra) => pts.map(([x, z, r = 0]) => at(p, x, z, r, extra));
const onN = (p, x, y, o) => ({ p, x, z: 0.13, y, r: 0, o });
const onW = (p, z, y, o) => ({ p, x: 0.13, z, y, r: 90, o });

// One patient's corner. Monitors sit west of the bed facing east, so the screen reads from the default camera.
// The east flank stays open because that is where bed.use puts the nurse.
const wardBed = (id, x, z, kit = 'imc') => [
  at('bed', x, z, 0, { id }),
  at('bedsideTable', x + 0.85, z - 0.85),
  kit.includes('m') && at('vitalsMonitor', x - 0.85, z - 0.85, 90),
  kit.includes('i') && at('ivStand', x - 0.85, z - 0.22),
  kit.includes('c') && at('chair', x + 1.42, z - 0.6, 270),
].filter(Boolean);

// A curtainBay's back panel never retracts, so it goes on the west side: along the south wall it would stand between
// the camera and the bed, here it hangs behind the bed like a backdrop and the bay stays open to the aisle.
// The next bay's panel is 2.2 m tall and the camera looks down at 32°, so it clears a mattress only from 1.7 m away: hence the 3.6 m pitch.
const bayCurtain = (x, z, color) => at('curtainBay', x, z, 90, { o: { open: 0.9, color } });
const erBay = (id, x) => [
  bayCurtain(x, 10.4, C.curtainBlue),
  at('bed', x - 0.13, 10.7, 180, { id }),
  at('vitalsMonitor', x - 0.95, 11.5, 90),
  at('ivStand', x + 0.72, 11.4),
];

// West column: heads on the tall wall, feet to the room.
const icuWest = (n, z) => [
  bayCurtain(1.7, z, C.curtainMint),
  at('icuBed', 1.35, z, 90, { id: `ICU${n}` }),
  at('vitalsMonitor', 0.55, z - 0.87),
  at('ivStand', 1.08, z - 0.87),
  at('ventilator', 0.6, z + 0.95, 0, { id: `VENT${n}` }),
];
// South row: same kit, turned to the south wall.
const icuSouth = (n, x) => [
  bayCurtain(x, 10.4, C.curtainMint),
  at('icuBed', x - 0.13, 10.67, 180, { id: `ICU${n}` }),
  at('vitalsMonitor', x - 1.0, 11.5, 90),
  at('ventilator', x + 0.85, 11.45, 270, { id: `VENT${n}` }),
  at('ivStand', x + 0.8, 10.8),
];

const theatre = (id, vent, x, z) => [
  at('orTable', x, z, 0, { id }),
  at('orLight', x, z),
  at('anesthesiaCart', x - 1.6, z - 1.8, 90),
  at('ventilator', x - 1.6, z - 2.7, 90, { id: vent }),
  at('instrumentTable', x + 2.2, z - 0.8, 270),
  at('instrumentTable', x, z + 2.6, 180),
];

export const FURNISHING = {
  // ── Ground floor ────────────────────────────────────────────────────────
  radiology: [
    at('mriScanner', 2.7, 2.75, 0, { id: 'MRI1' }),
    at('ctScanner', 7.2, 2.35, 0, { id: 'CT1' }),
    at('xrayMachine', 11.65, 1.95, 0, { id: 'XRAY1' }),
    at('locker', 9.4, 0.4),
    at('controlDesk', 4.3, 7.0, 180),
    at('waitingRow', 0.45, 7.3, 90),
    onW('wallTv', 7.3, 1.75),
    onW('wallArt', 9.9, 1.6, { style: 'leaf' }),
    at('plantBig', 0.6, 10.4),
    at('plantSmall', 2.6, 10.6),
    at('ultrasound', 12.2, 5.1, 270),
    at('gurney', 13.3, 7.7),
    at('wheelchair', 9.9, 9.9, 90),
    at('trashBin', 5.5, 10.6),
    onN('wallClock', 5.05, 2.1),
  ],
  lab: [
    ...many('labFridge', [[0.75, 0.55], [1.85, 0.55]]),
    at('analyzer', 3.55, 0.6, 0, { id: 'AN1' }),
    at('analyzer', 5.15, 0.6, 0, { id: 'AN2' }),
    at('analyzer', 6.75, 0.6, 0, { id: 'AN3' }),
    at('centrifuge', 8.1, 0.5),
    at('plantSmall', 9.35, 0.45),
    ...many('labBench', [[2.55, 3.6], [7.45, 3.6], [2.55, 6.4], [7.45, 6.4]]),
    at('workstation', 0.5, 9.1, 270),
    at('workstation', 7.6, 9.0, 180),
    at('trashBin', 9.5, 9.9),
    onN('wallClock', 8.9, 2.05),
    onW('wallArt', 5.0, 1.6, { style: 'sun' }),
  ],
  pharmacy: [
    at('pillRobot', 4, 0.72, 0, { id: 'ROBOT1' }),
    ...many('pharmacyShelf', [[1.55, 0.42], [6.45, 0.42], [1.55, 3.0], [6.45, 3.0], [1.55, 5.2], [6.45, 5.2]]),
    at('workstation', 1.8, 8.1, 180),
    ...many('medCart', [[7.5, 7.7, 270], [7.5, 8.7, 270]]),
    at('plantBig', 0.6, 10.4),
    at('trashBin', 3.0, 8.1),
    onN('wallSign', 4, 2.25, { text: 'Pharmacy' }),
  ],
  core0: [at('plantBig', 0.6, 8.2)],
  corridor0: [
    at('plantBig', 0.6, 0.55),
    onW('wallArt', 1.9, 1.6, { style: 'sun' }),
    at('wheelchair', 3.3, 0.5, 90),
    at('trashBin', 11.4, 0.3),
    at('plantSmall', 22.4, 0.32),
    at('wheelchair', 30.2, 0.5, 90),
    onN('wallSign', 9.3, 1.45, { text: 'Radiology' }),
    onN('wallArt', 13.2, 1.45, { style: 'leaf' }),
    onN('wallSign', 21, 1.45, { text: 'Laboratory' }),
    onN('wallSign', 30.1, 1.45, { text: 'Pharmacy' }),
  ],
  lobby: [
    // Reception anchors the deep corner against the tall wall and leaves the door-to-door spine open.
    at('receptionDesk', 3.05, 2.45),
    at('plantBig', 0.6, 4.1),
    onW('wallSign', 5.6, 1.9, { text: 'Welcome' }),
    onN('wallArt', 3.05, 1.45, { style: 'sun' }),
    at('rug', 7.5, 9.6),
    ...many('plantBig', [[5.2, 11.45], [9.8, 11.45], [0.6, 11.35]]),
    // West lounge, everyone turned to the room.
    at('rug', 3.3, 9.25),
    at('sofa', 0.6, 9.25, 90),
    at('sofa', 3.3, 7.6),
    at('coffeeTable', 3.3, 9.25),
    at('armchair', 5.2, 8.7, 270),
    at('armchair', 5.2, 9.9, 270),
    onW('wallTv', 9.25, 1.7),
    at('wheelchair', 3.9, 11.4),
    // Refreshment wall and cafe tables between the spine and the ER doors.
    at('vending', 9.75, 0.55),
    at('coffeeKiosk', 12.1, 1.0),
    at('waterCooler', 14.3, 0.45),
    at('tableRound', 11.0, 3.85),
    at('tableRound', 13.4, 3.85),
    ...many('chair', [[10.05, 3.85, 90], [11.95, 3.85, 270], [12.45, 3.85, 90], [14.35, 3.85, 270]]),
    ...many('waitingRow', [[11.7, 8.2], [11.7, 10.15]]),
    at('plantBig', 14.0, 9.2),
  ],
  er: [
    at('triageDesk', 2.9, 3.5),
    ...many('waitingRow', [[6.9, 0.45], [6.9, 2.45]]),
    at('plantBig', 4.9, 0.55),
    at('waterCooler', 8.55, 0.35),
    onN('wallTv', 6.9, 1.6),
    onN('wallSign', 2.9, 1.5, { text: 'Triage' }),
    onW('heartSign', 2.4, 1.6),
    ...erBay('ER1', 1.9), ...erBay('ER2', 5.5), ...erBay('ER3', 9.1), ...erBay('ER4', 12.7), ...erBay('ER5', 16.3),
    // Nurses and supplies hold the north wall so the lobby-to-ambulance aisle stays wide open for gurneys.
    at('linenShelf', 14.0, 0.42),
    ...many('workstation', [[15.0, 2.7, 180], [16.6, 2.7, 180]]),
    ...many('supplyCart', [[15.9, 0.4], [17.0, 0.4]]),
    at('medCart', 18.1, 0.4),
    ...many('gurney', [[20.9, 0.6, 90], [20.9, 1.6, 90]]),
    onN('wallSign', 13.2, 1.5, { text: 'Emergency' }),
    onN('wallClock', 18.9, 1.7),
    // Resus, first thing inside the ambulance doors.
    at('gurney', 20.3, 10.4, 180),
    at('crashCart', 18.6, 10.2, 90, { id: 'CRASH1' }),
    at('vitalsMonitor', 19.3, 11.45, 90),
    at('ventilator', 21.4, 11.2),
    at('ivStand', 21.3, 10.4),
    ...many('oxygenTank', [[22.3, 11.5], [22.65, 11.5]]),
    at('supplyCart', 22.5, 9.3, 270),
    ...many('wheelchair', [[18.7, 3.0, 90], [20.0, 3.0, 90]]),
  ],

  // ── Level 1 ─────────────────────────────────────────────────────────────
  ward_a: [
    ...wardBed('A1', 1.9, 1.35, 'imc'), ...wardBed('A2', 5.5, 1.35, 'mc'), ...wardBed('A3', 9.1, 1.35, 'ic'),
    ...wardBed('A4', 1.9, 6.1, 'im'), ...wardBed('A5', 5.5, 6.1, 'imc'), ...wardBed('A6', 9.1, 6.1, 'mc'),
    at('linenShelf', 0.42, 4.2, 90),
    at('plantBig', 7.0, 10.35),
    at('medCart', 2.9, 9.4),
    onW('wallArt', 7.0, 1.6, { style: 'butterfly' }),
    onW('wallClock', 9.0, 1.8),
    onN('heartSign', 3.75, 1.65),
    onN('wallArt', 7.3, 1.6, { style: 'butterfly' }),
  ],
  ward_b: [
    ...wardBed('B1', 1.9, 1.35, 'mc'), ...wardBed('B2', 5.5, 1.35, 'ic'), ...wardBed('B3', 9.1, 1.35, 'imc'),
    ...wardBed('B4', 1.9, 6.1, 'mc'), ...wardBed('B5', 5.5, 6.1, 'im'), ...wardBed('B6', 9.1, 6.1, 'imc'),
    at('linenShelf', 0.42, 9.2, 90),
    at('plantBig', 0.6, 3.72),
    at('wheelchair', 7.2, 9.6, 90),
    at('plantSmall', 3.9, 10.6),
    onN('wallArt', 3.75, 1.6, { style: 'butterfly' }),
    onN('heartSign', 7.3, 1.65),
    onW('wallArt', 6.2, 1.5, { style: 'leaf' }),
  ],
  ward_c: [
    ...wardBed('C1', 1.45, 1.35, 'im'), ...wardBed('C2', 3.8, 1.35, 'i'), ...wardBed('C3', 6.15, 1.35, 'im'), ...wardBed('C4', 8.5, 1.35, 'i'),
    // Fewer beds, so the south half becomes a day room: the one soft moment on this floor.
    at('linenShelf', 0.42, 4.2, 90),
    at('rug', 2.7, 7.7),
    at('sofa', 2.7, 6.05),
    at('coffeeTable', 2.7, 7.6),
    at('armchair', 0.75, 7.7, 90),
    onW('wallTv', 7.7, 1.6),
    at('plantBig', 0.6, 10.3),
    at('tableRound', 7.8, 7.3),
    ...many('chair', [[6.85, 7.3, 90], [8.75, 7.3, 270], [7.8, 6.35]]),
    at('plantBig', 9.4, 10.4),
    onN('wallArt', 2.65, 1.75, { style: 'butterfly' }),
    onN('heartSign', 7.45, 1.75),
  ],
  core1: [at('plantBig', 0.6, 8.2)],
  corridor1: [
    at('plantBig', 0.6, 0.55),
    onW('wallArt', 1.9, 1.6, { style: 'heart' }),
    onN('heartSign', 7.6, 1.5),
    at('plantBig', 3.7, 0.55),
    at('sofa', 11, 0.55),
    onN('wallSign', 18.8, 1.5, { text: 'Ward B' }),
    at('wheelchair', 21.9, 0.5, 90),
    onN('heartSign', 25.1, 1.5),
    at('trashBin', 13.2, 0.3),
    at('plantSmall', 29.4, 0.32),
  ],
  icu: [
    ...icuWest(1, 1.8), ...icuWest(2, 4.8), ...icuWest(3, 7.8),
    ...icuSouth(4, 5.0), ...icuSouth(5, 8.6), ...icuSouth(6, 12.2),
    // Back-to-back desks: one pair of eyes on each wing.
    at('workstation', 8.9, 4.35),
    at('workstation', 8.9, 5.12, 180),
    at('plantSmall', 10.0, 4.75),
    at('medCart', 9.5, 0.4),
    at('crashCart', 10.6, 0.42, 0, { id: 'CRASH2' }),
    at('linenShelf', 12.5, 0.42),
    ...many('oxygenTank', [[0.5, 10.0], [0.95, 10.0]]),
    at('supplyCart', 1.9, 10.9, 90),
    at('plantBig', 13.4, 7.7),
    onN('wallSign', 3.9, 1.5, { text: 'Intensive Care' }),
    onN('wallClock', 9.6, 1.75),
  ],
  nurses: [
    at('nurseStation', 2.5, 5.8, 90),
    ...many('medCart', [[6.4, 4.1, 270], [6.4, 5.1, 270]]),
    at('linenShelf', 0.42, 10.2, 90),
    ...many('plantBig', [[6.45, 0.6], [6.4, 11.4]]),
    at('plantSmall', 0.42, 2.2),
    at('tableRound', 5.3, 10.4),
    ...many('chair', [[4.35, 10.4, 90], [6.25, 10.4, 270]]),
    onW('wallArt', 1.1, 1.65, { style: 'heart' }),
    onN('wallClock', 6.5, 1.75),
  ],
  or1: [
    ...theatre('OR1', 'VENT7', 4.5, 6.6),
    at('scrubSink', 1.7, 0.4),
    at('supplyCart', 6.7, 0.4),
    at('medCart', 7.9, 0.4),
    onN('wallTv', 7.3, 1.65),
    onW('wallTv', 6.6, 1.65),
    onW('wallClock', 3.9, 1.8),
    at('trashBin', 0.45, 11.5),
  ],
  or2: [
    ...theatre('OR2', 'VENT8', 4.2, 6.6),
    at('scrubSink', 3.9, 0.4),
    at('supplyCart', 6.5, 0.4),
    onN('wallTv', 6.5, 1.65),
    onW('wallTv', 6.6, 1.65),
    at('oxygenTank', 0.45, 3.4),
    at('trashBin', 0.45, 11.5),
  ],

  // ── Grounds ─────────────────────────────────────────────────────────────
  // Tall trees hold the far edges of the island. South and east of the building they would paint over the interior from the
  // default camera, and close to the north and west walls they would on rotation, so the near side stays low and open.
  // Everything else follows the paths and the pond painted by shell-site.js, and the eye runs from the street crossing to the doors.
  exterior: [
    // North-west corner: the heaviest cluster, the top of the diamond.
    ...many('treeRound', [[-7.0, -6.8], [-1.4, -6.6], [-6.6, -1.2]]),
    ...many('treePine', [[-4.2, -7.6], [-7.7, -3.8]]),
    // Along the north edge in three loose groups, with lawn between them.
    ...many('treeRound', [[3.4, -6.7], [8.4, -6.3], [17.8, -6.6], [20.4, -7.7], [27.2, -6.4], [32.4, -6.8]]),
    ...many('treePine', [[6.0, -7.7], [15.2, -7.6], [29.8, -7.6], [36.6, -7.6]]),
    ...many('bush', [[7.0, -1.0], [8.1, -0.95], [19.2, -1.0], [30.8, -1.0], [31.9, -0.95]]),
    ...many('bench', [[12.2, -3.6], [24.8, -3.6]]),
    ...many('lampPost', [[9.0, -3.5], [21.0, -3.5], [33.0, -3.5]]),
    // Healing garden: trees on the outer edge, low colour on the building side, benches that look at something.
    ...many('treePine', [[-7.4, 2.9], [-7.7, 18.6], [-8.0, 29.4]]),
    ...many('treeRound', [[-6.0, 9.2], [-7.8, 15.2], [-7.2, 21.6], [-4.6, 29.2], [-7.4, 32.4]]),
    ...many('bush', [[-8.3, 7.3], [-8.3, 11.2], [-2.2, 1.0], [-1.1, 1.3], [-2.6, 19.8], [-1.5, 20.2], [-2.9, 28.9]]),
    ...many('flowerBed', [[-1.6, 4.6, 90], [-1.6, 9.0, 90], [-1.4, 23.0, 90]]),
    at('bench', -6.2, 16.4, 90),
    at('bench', -2.6, 12.9),
    at('bench', -5.9, 2.4, 90),
    at('bench', -5.75, 21.6, 90),
    ...many('lampPost', [[-3.3, 6.9], [-3.1, 21.2], [-1.2, 25.7]]),
    // Arrival: planters flank the doors, bollards line the kerb and open at the crossing.
    ...many('flowerBed', [[2.6, 26.65], [12.4, 26.65], [18, 26.65], [26, 26.65], [34, 26.65]]),
    ...many('bollard', [1.5, 3, 4.5, 10.5, 12, 13.5, 15, 18, 21, 27, 30, 33, 36].map((x) => [x, 28.8])),
    at('lampPost', 5.4, 33.2),
    at('lampPost', 11.4, 33.0),
    at('bush', 10.2, 32.95),
    // South lawn: the sign greets the street, then the lawn stays calm so nothing blocks the view into Emergency.
    at('monumentSign', 21.4, 31.2, 0, { o: { name: HOSPITAL_NAME } }),
    at('flowerBed', 21.9, 32.6),
    at('bush', 18.7, 29.9),
    ...many('treeRound', [[27.4, 32.2], [38.4, 32.2]]),
    at('treePine', 33.2, 32.6),
    ...many('bench', [[27.2, 29.55], [35.4, 29.55]]),
    at('flowerBed', 31.2, 29.85),
    ...many('bush', [[39.9, 30.0], [41.1, 29.5], [41.0, 30.7]]),
    ...many('lampPost', [[-3.0, 32.7], [30.4, 33.1], [36.0, 33.1], [40.4, 32.3], [52.4, 33.2]]),
    // Ambulance bay and staff parking. Bay three stays empty: it is the walking route from the helipad.
    ...many('lampPost', [[40.6, 26.5], [41.0, 13.5], [51.2, 13.5], [51.1, 20.0]]),
    ...many('treeRound', [[51.9, 16.2], [51.9, 28.8]]),
    at('treePine', 51.9, 22.6),
    at('helipad', 46, -1.5),
    ...many('parkingBay', [40.8, 43.4, 46.0, 48.6, 51.2].map((x) => [x, 8.1])),
    at('car', 40.8, 7.9, 180, { o: { color: C.curtainBlue } }),
    at('car', 43.4, 7.9, 180, { o: { color: C.rose } }),
    at('car', 48.6, 8.3, 0, { o: { color: C.curtainMint } }),
    at('car', 51.2, 7.9, 180, { o: { color: C.purpleLight } }),
    ...many('bush', [[41.0, 4.75], [43.0, 4.75], [49.0, 4.75], [51.0, 4.75]]),
  ],
};
