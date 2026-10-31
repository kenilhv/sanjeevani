// The hospital floor plan. Two stacked plates over one footprint (38 × 26 m).
// World axes: +X east, +Z south, +Y up. Origin = NW corner of the building, floor 0.
// Default camera sits to the SE and looks NW, so the N and W perimeter walls are the tall "backdrop".
export const HOSPITAL_NAME = 'Haven General';
export const FLOOR_HEIGHT = 3.6;
export const BUILDING = { w: 38, d: 26 };
export const WALL = { full: 3.05, cut: 0.5, partition: 1.3, glassTop: 2.55, door: 2.25, thick: 0.2 };
// The ground island the building sits on (floor 0 only).
export const SITE = { x0: -9, z0: -9, x1: 53, z1: 39 };

export const FLOORS = [
  { index: 0, name: 'Ground', short: 'G' },
  { index: 1, name: 'Level 1', short: '1' },
];

const R = (id, name, floor, theme, x, z, w, d, extra = {}) => ({ id, name, floor, theme, rect: { x, z, w, d }, ...extra });

export const ROOMS = [
  // ── Ground: diagnostics along the north, public + emergency along the south ─
  R('radiology', 'Radiology', 0, 'imaging', 0, 0, 14, 11, { dept: 'Imaging' }),
  R('lab', 'Laboratory', 0, 'lab', 14, 0, 10, 11, { dept: 'Laboratory' }),
  R('pharmacy', 'Pharmacy', 0, 'pharmacy', 24, 0, 8, 11, { dept: 'Pharmacy' }),
  R('core0', 'Lifts & Stairs', 0, 'core', 32, 0, 6, 14, { dept: 'Circulation', circulation: true }),
  R('corridor0', 'Main Corridor', 0, 'corridor', 0, 11, 32, 3, { dept: 'Circulation', circulation: true }),
  R('lobby', 'Main Lobby', 0, 'lobby', 0, 14, 15, 12, { dept: 'Reception' }),
  R('er', 'Emergency', 0, 'er', 15, 14, 23, 12, { dept: 'Emergency' }),
  // ── Level 1: inpatient wards along the north, critical care + theatres along the south ─
  R('ward_a', 'Ward A', 1, 'ward', 0, 0, 11, 11, { dept: 'Inpatient' }),
  R('ward_b', 'Ward B', 1, 'ward', 11, 0, 11, 11, { dept: 'Inpatient' }),
  R('ward_c', 'Ward C', 1, 'ward', 22, 0, 10, 11, { dept: 'Inpatient' }),
  R('core1', 'Lifts & Stairs', 1, 'core', 32, 0, 6, 14, { dept: 'Circulation', circulation: true }),
  R('corridor1', 'Ward Corridor', 1, 'corridor', 0, 11, 32, 3, { dept: 'Circulation', circulation: true }),
  R('icu', 'Intensive Care', 1, 'icu', 0, 14, 14, 12, { dept: 'Critical Care' }),
  R('nurses', 'Nurse Station', 1, 'nurses', 14, 14, 7, 12, { dept: 'Inpatient' }),
  R('or1', 'Theatre 1', 1, 'or', 21, 14, 9, 12, { dept: 'Surgery' }),
  R('or2', 'Theatre 2', 1, 'or', 30, 14, 8, 12, { dept: 'Surgery' }),
];

// Door centre lies on a wall line. axis 'x': the wall runs along X, so people pass along Z.
// kind: 'swing' single yellow door · 'double' pair of yellow doors · 'slide' automatic glass · 'open' a gap, no leaf
export const DOORS = [
  { id: 'd_main', floor: 0, x: 7.5, z: 26, axis: 'x', w: 3.2, kind: 'slide', rooms: ['lobby', null] },
  { id: 'd_ambu', floor: 0, x: 38, z: 20, axis: 'z', w: 3.2, kind: 'slide', rooms: ['er', null] },
  { id: 'd_lobby_corr', floor: 0, x: 7.5, z: 14, axis: 'x', w: 3.0, kind: 'open', rooms: ['lobby', 'corridor0'] },
  { id: 'd_er_corr', floor: 0, x: 26, z: 14, axis: 'x', w: 2.4, kind: 'double', rooms: ['er', 'corridor0'] },
  { id: 'd_lobby_er', floor: 0, x: 15, z: 20, axis: 'z', w: 2.0, kind: 'double', rooms: ['lobby', 'er'] },
  { id: 'd_rad', floor: 0, x: 7, z: 11, axis: 'x', w: 2.0, kind: 'double', rooms: ['radiology', 'corridor0'] },
  { id: 'd_lab', floor: 0, x: 19, z: 11, axis: 'x', w: 1.4, kind: 'swing', rooms: ['lab', 'corridor0'] },
  { id: 'd_pharm', floor: 0, x: 28, z: 11, axis: 'x', w: 1.4, kind: 'swing', rooms: ['pharmacy', 'corridor0'] },
  { id: 'd_core0', floor: 0, x: 32, z: 12.5, axis: 'z', w: 2.6, kind: 'open', rooms: ['core0', 'corridor0'] },

  { id: 'd_wa', floor: 1, x: 5.5, z: 11, axis: 'x', w: 1.6, kind: 'swing', rooms: ['ward_a', 'corridor1'] },
  { id: 'd_wb', floor: 1, x: 16.5, z: 11, axis: 'x', w: 1.6, kind: 'swing', rooms: ['ward_b', 'corridor1'] },
  { id: 'd_wc', floor: 1, x: 27, z: 11, axis: 'x', w: 1.6, kind: 'swing', rooms: ['ward_c', 'corridor1'] },
  { id: 'd_icu', floor: 1, x: 7, z: 14, axis: 'x', w: 2.4, kind: 'double', rooms: ['icu', 'corridor1'] },
  { id: 'd_nurses', floor: 1, x: 17.5, z: 14, axis: 'x', w: 5.0, kind: 'open', rooms: ['nurses', 'corridor1'] },
  { id: 'd_or1', floor: 1, x: 25.5, z: 14, axis: 'x', w: 2.2, kind: 'double', rooms: ['or1', 'corridor1'] },
  { id: 'd_or2', floor: 1, x: 31, z: 14, axis: 'x', w: 1.8, kind: 'double', rooms: ['or2', 'corridor1'] },
  { id: 'd_core1', floor: 1, x: 32, z: 12.5, axis: 'z', w: 2.6, kind: 'open', rooms: ['core1', 'corridor1'] },
];

// Vertical links. Plates are separate objects, so a portal is just "walk to A on one floor, reappear at B on the other".
// Lift cabins and the stair flight are built by world/shell.js at these positions.
export const PORTALS = [
  { id: 'lift_a', kind: 'lift', x: 33.6, z: 1.6, stand: { x: 33.6, z: 3.4 }, ride: 4.0 },
  { id: 'lift_b', kind: 'lift', x: 36.4, z: 1.6, stand: { x: 36.4, z: 3.4 }, ride: 4.0 },
  // Stair flight centred at (x, z), footprint 2 × 7.4, rising toward the north. People stand at `stand` on floor 0 and `standTop` on floor 1.
  { id: 'stairs', kind: 'stairs', x: 35.9, z: 8.9, w: 2.0, d: 7.4, stand: { x: 34.2, z: 12.4 }, standTop: { x: 34.2, z: 5.6 }, ride: 6.0 },
];

// Site zones in world metres. The shell paints these; furnishing keeps trees and benches out of the hard surfaces.
export const ZONES = {
  street: { x: -9, z: 33.6, w: 62, d: 5.0 },   // two-lane road along the south edge of the island
  spur: { x: 43.4, z: 14, w: 7.2, d: 19.6 },   // access lane from the street up to the ambulance bay
  apron: { x: 38, z: 14, w: 12.6, d: 12 },     // ambulance bay in front of the east ER doors
  dropoff: { x: 1, z: 29, w: 15, d: 3.2 },     // patient drop-off lay-by in front of the main doors, joined to the street at both ends
  plaza: { x: 0, z: 26, w: 38, d: 3 },         // pale paving along the south facade
  parking: { x: 39.5, z: 5.5, w: 13, d: 7.4 }, // staff car park, five bays
  helipad: { x: 40.5, z: -7, w: 11, d: 11 },   // H pad, centre (46, -1.5)
  garden: { x: -9, z: -9, w: 9, d: 42.6 },     // healing garden along the west side
};

// Vehicle paths as polylines in world metres. The sim moves vehicles along them; `reverse: true` means this leg is driven backwards.
// Vehicles scale in and out at the island edge, because the road ends where the diorama is cut.
export const ROUTES = {
  ambulanceIn: [{ x: -9, z: 37.1 }, { x: 40, z: 37.1 }, { x: 45, z: 33 }, { x: 45, z: 24 }, { x: 48.5, z: 20 }, { x: 42, z: 20, reverse: true }],
  ambulanceOut: [{ x: 42, z: 20 }, { x: 47.5, z: 20 }, { x: 48.5, z: 24 }, { x: 48.5, z: 33 }, { x: 53, z: 37.1 }],
  carDropoff: [{ x: -9, z: 37.1 }, { x: 0, z: 37.1 }, { x: 3, z: 31 }, { x: 8, z: 30.6 }, { x: 13, z: 31 }, { x: 16, z: 37.1 }, { x: 53, z: 37.1 }],
  trafficEast: [{ x: -9, z: 37.1 }, { x: 53, z: 37.1 }],
  trafficWest: [{ x: 53, z: 35.0 }, { x: -9, z: 35.0 }],
  heli: { from: { x: 90, y: 42, z: -40 }, pad: { x: 46, y: 0.1, z: -1.5 } },
};

export const roomById = (id) => ROOMS.find((r) => r.id === id);
export const roomsOnFloor = (f) => ROOMS.filter((r) => r.floor === f);
export const roomAt = (floor, x, z) => ROOMS.find((r) => r.floor === floor && x >= r.rect.x && x < r.rect.x + r.rect.w && z >= r.rect.z && z < r.rect.z + r.rect.d);
export const roomCentre = (r, y = 0) => ({ x: r.rect.x + r.rect.w / 2, y: r.floor * FLOOR_HEIGHT + y, z: r.rect.z + r.rect.d / 2 });
