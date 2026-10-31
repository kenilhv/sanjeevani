// Prop catalog + factory registry. This file is the shared vocabulary between
// props/* (who build them), world/furnishing.js (who places them) and sim/* (who uses them).
// Conventions: 1 unit = 1 metre. Origin = centre of footprint at floor level. y up.
// FRONT faces +Z: the side a person uses. Bed: head at -Z, feet at +Z. Sofa: seated person faces +Z.
//
// fp   [w (x), d (z)] footprint, used for nav blocking and overlap checks
// use  [x, z] local spot where a person stands to operate it (facing the prop, i.e. looking toward -Z from +Z)
// seats [[x, z], ...] local seat points; a seated person faces +Z
// bed  true: becomes a Bed entity in the sim (the placement needs an id)
// nav  false: does not block walking (rugs, ceiling booms, wall-mounted things)
// wall true: hangs on a wall; y comes from the placement, not 0
// owner: clinical | furniture | outdoor
export const CATALOG = {
  // ── clinical ─────────────────────────────────────────────
  bed:          { fp: [1.05, 2.2], h: 0.95, owner: 'clinical', bed: true, use: [0.95, 0.2] },
  icuBed:       { fp: [1.15, 2.3], h: 1.0, owner: 'clinical', bed: true, use: [1.0, 0.2] },
  gurney:       { fp: [0.8, 2.05], h: 0.95, owner: 'clinical' },
  bedsideTable: { fp: [0.5, 0.5], h: 0.75, owner: 'clinical' },
  ivStand:      { fp: [0.45, 0.45], h: 1.95, owner: 'clinical' },
  vitalsMonitor:{ fp: [0.5, 0.45], h: 1.55, owner: 'clinical' },
  crashCart:    { fp: [0.75, 0.55], h: 1.15, owner: 'clinical', use: [0, 0.65] },
  medCart:      { fp: [0.8, 0.55], h: 1.1, owner: 'clinical', use: [0, 0.65] },
  supplyCart:   { fp: [0.95, 0.55], h: 1.25, owner: 'clinical', use: [0, 0.65] },
  wheelchair:   { fp: [0.7, 0.95], h: 0.95, owner: 'clinical' },
  ventilator:   { fp: [0.6, 0.6], h: 1.35, owner: 'clinical' },
  ultrasound:   { fp: [0.6, 0.7], h: 1.4, owner: 'clinical', use: [0, 0.75] },
  curtainBay:   { fp: [3.0, 3.2], h: 2.3, owner: 'clinical', nav: false }, // U-shaped ceiling rail + curtains; open side faces +Z; opts {open:0..1, color}
  privacyCurtain:{ fp: [2.4, 0.2], h: 2.2, owner: 'clinical', nav: false },
  mriScanner:   { fp: [2.6, 4.6], h: 2.2, owner: 'clinical', use: [1.6, 1.2] }, // bore axis along Z, patient table slides out to +Z
  ctScanner:    { fp: [2.3, 3.8], h: 1.95, owner: 'clinical', use: [1.5, 1.0] },
  xrayMachine:  { fp: [2.2, 2.8], h: 2.2, owner: 'clinical', use: [1.4, 0.4] },
  orTable:      { fp: [0.85, 2.2], h: 1.0, owner: 'clinical', bed: true, use: [0.95, 0] },
  orLight:      { fp: [1.6, 1.6], h: 2.6, owner: 'clinical', nav: false }, // ceiling boom with two lamps
  anesthesiaCart:{ fp: [0.9, 0.75], h: 1.5, owner: 'clinical', use: [0, 0.8] },
  scrubSink:    { fp: [1.8, 0.6], h: 1.15, owner: 'clinical', use: [0, 0.7] },
  instrumentTable:{ fp: [1.1, 0.6], h: 0.95, owner: 'clinical', use: [0, 0.7] },
  labBench:     { fp: [3.2, 0.85], h: 1.1, owner: 'clinical', use: [0, 0.95] }, // with microscopes, racks, tubes
  analyzer:     { fp: [1.3, 0.85], h: 1.45, owner: 'clinical', use: [0, 0.95] },
  centrifuge:   { fp: [0.65, 0.65], h: 0.95, owner: 'clinical' },
  labFridge:    { fp: [0.95, 0.75], h: 1.95, owner: 'clinical', use: [0, 0.85] },
  pharmacyShelf:{ fp: [2.6, 0.55], h: 2.05, owner: 'clinical', use: [0, 0.7] }, // full of colourful boxes
  pillRobot:    { fp: [2.0, 1.1], h: 1.85, owner: 'clinical', use: [0, 1.2] },  // glass cabinet with a moving arm
  oxygenTank:   { fp: [0.32, 0.32], h: 1.35, owner: 'clinical' },

  // ── furniture ────────────────────────────────────────────
  sofa:         { fp: [2.1, 0.9], h: 0.85, owner: 'furniture', seats: [[-0.55, 0.15], [0.55, 0.15]] }, // teal
  armchair:     { fp: [0.95, 0.9], h: 0.85, owner: 'furniture', seats: [[0, 0.1]] },
  chair:        { fp: [0.5, 0.5], h: 0.85, owner: 'furniture', seats: [[0, 0.05]] },
  waitingRow:   { fp: [2.5, 0.65], h: 0.85, owner: 'furniture', seats: [[-0.8, 0.05], [0, 0.05], [0.8, 0.05]] },
  coffeeTable:  { fp: [1.2, 0.65], h: 0.42, owner: 'furniture' },
  tableRound:   { fp: [1.1, 1.1], h: 0.75, owner: 'furniture' },
  receptionDesk:{ fp: [5.2, 1.5], h: 1.1, owner: 'furniture', use: [0, -1.05], seats: [[-1.3, -0.95], [1.3, -0.95]] }, // staff sit behind (-Z) and face +Z; sign "Reception"
  nurseStation: { fp: [5.2, 2.6], h: 1.1, owner: 'furniture', use: [0, -0.2], seats: [[-1.2, -0.3], [1.2, -0.3]] },    // curved teal counter; sign "Nurse on duty"
  triageDesk:   { fp: [2.4, 0.9], h: 1.05, owner: 'furniture', use: [0, -0.75], seats: [[0, -0.75]] },
  workstation:  { fp: [1.5, 0.75], h: 1.25, owner: 'furniture', use: [0, -0.7], seats: [[0, -0.7]] }, // desk with a monitor, person sits behind
  controlDesk:  { fp: [2.8, 0.85], h: 1.25, owner: 'furniture', use: [0, -0.8], seats: [[-0.7, -0.8], [0.7, -0.8]] }, // several monitors
  plantBig:     { fp: [0.8, 0.8], h: 1.9, owner: 'furniture' },
  plantSmall:   { fp: [0.42, 0.42], h: 0.75, owner: 'furniture' },
  linenShelf:   { fp: [2.4, 0.6], h: 1.95, owner: 'furniture', use: [0, 0.7] }, // metal rack piled with folded white towels
  locker:       { fp: [1.9, 0.55], h: 1.95, owner: 'furniture', use: [0, 0.65] },
  vending:      { fp: [1.05, 0.85], h: 1.95, owner: 'furniture', use: [0, 0.95] },
  coffeeKiosk:  { fp: [3.2, 1.6], h: 2.4, owner: 'furniture', use: [0, 1.0] },
  waterCooler:  { fp: [0.42, 0.42], h: 1.25, owner: 'furniture' },
  rug:          { fp: [3.2, 2.2], h: 0.03, owner: 'furniture', nav: false },
  trashBin:     { fp: [0.38, 0.38], h: 0.6, owner: 'furniture' },
  wallArt:      { fp: [0.9, 0.05], h: 0.9, owner: 'furniture', wall: true, nav: false }, // framed art, opts {style:'butterfly'|'heart'|'leaf'|'sun'}
  wallTv:       { fp: [1.3, 0.08], h: 0.8, owner: 'furniture', wall: true, nav: false },
  wallClock:    { fp: [0.5, 0.05], h: 0.5, owner: 'furniture', wall: true, nav: false }, // live clock, reads userData.setState({minutes})
  wallSign:     { fp: [1.4, 0.05], h: 0.4, owner: 'furniture', wall: true, nav: false }, // opts {text}
  heartSign:    { fp: [0.6, 0.05], h: 0.6, owner: 'furniture', wall: true, nav: false }, // white plate with a red heart, as in the reference

  // ── outdoor ──────────────────────────────────────────────
  ambulance:    { fp: [2.2, 5.6], h: 2.6, owner: 'outdoor' }, // nose at +Z; setState({lights, doors})
  car:          { fp: [1.9, 4.3], h: 1.5, owner: 'outdoor' }, // opts {color}
  helicopter:   { fp: [2.8, 11], h: 3.2, owner: 'outdoor' },  // nose at +Z; setState({rotor:0..1})
  treeRound:    { fp: [2.2, 2.2], h: 4.2, owner: 'outdoor' },
  treePine:     { fp: [2.0, 2.0], h: 5.0, owner: 'outdoor' },
  bush:         { fp: [1.1, 1.1], h: 0.8, owner: 'outdoor' },
  flowerBed:    { fp: [3.2, 1.1], h: 0.45, owner: 'outdoor' },
  bench:        { fp: [1.9, 0.6], h: 0.85, owner: 'outdoor', seats: [[-0.5, 0.05], [0.5, 0.05]] },
  lampPost:     { fp: [0.4, 0.4], h: 4.0, owner: 'outdoor' }, // glows when ctx.night > 0.3
  bollard:      { fp: [0.25, 0.25], h: 0.9, owner: 'outdoor' },
  monumentSign: { fp: [4.2, 0.8], h: 2.2, owner: 'outdoor' }, // big "H" + hospital name, takes opts {name}
  helipad:      { fp: [11, 11], h: 0.1, owner: 'outdoor', nav: false },
  parkingBay:   { fp: [2.6, 5.2], h: 0.02, owner: 'outdoor', nav: false },
};

const factories = new Map();
/** build(opts) returns a THREE.Group. See docs/CONTRACT.md §4 for userData hooks. */
export function registerProp(name, build) {
  if (!CATALOG[name]) console.warn('registerProp: not in CATALOG:', name);
  factories.set(name, build);
}
export const hasProp = (name) => factories.has(name);
export const missingProps = () => Object.keys(CATALOG).filter((n) => !factories.has(n));

/** Always returns a Group. Unknown or not-yet-built props become a tinted placeholder box. */
export function makeProp(name, opts = {}) {
  const meta = CATALOG[name];
  const build = factories.get(name);
  const g = build ? build(opts) : placeholder(name, meta);
  g.userData.prop = name;
  g.userData.meta = meta;
  return g;
}

import * as THREE from 'three';
function placeholder(name, meta) {
  const [w, d] = meta?.fp ?? [0.6, 0.6];
  const h = Math.min(meta?.h ?? 0.8, 2.6);
  const hue = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, Math.max(h, 0.05), d), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue / 360, 0.5, 0.7) }));
  m.position.y = Math.max(h, 0.05) / 2; m.castShadow = m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m);
  return g;
}
