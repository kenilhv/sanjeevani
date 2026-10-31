// A compact stand-in hospital, used by the headless harness and whenever shell.placed is empty, so the twin never boots hollow.
// Shape matches shell.placed exactly. Real runs read the furnished building instead.
import { roomById } from '../world/plan.js';
import { CATALOG } from '../props/registry.js';

export function fixturePlaced() {
  const out = [];
  const put = (name, roomId, x, z, r = 0, id) => {
    const room = roomById(roomId);
    out.push({
      name, roomId, floor: room.floor, heading: (r * Math.PI) / 180, meta: CATALOG[name],
      world: { x, y: 0, z }, entry: { p: name, x: x - room.rect.x, z: z - room.rect.z, r, ...(id ? { id } : {}) },
    });
  };
  for (const [room, pre, count] of [['ward_a', 'A', 6], ['ward_b', 'B', 6], ['ward_c', 'C', 4]]) {
    const { x, w } = roomById(room).rect;
    for (let i = 0; i < count; i++) {
      const col = i % 3, row = i >= 3 ? 1 : 0;
      put('bed', room, x + 1.9 + col * ((w - 3.8) / 2), 1.4 + row * 4.8, 0, `${pre}${i + 1}`);
    }
    put('medCart', room, x + 2.9, 9.4);
    put('chair', room, x + w - 2, 9.2, 180);
  }
  for (let i = 0; i < 3; i++) put('icuBed', 'icu', 1.35, 15.8 + i * 3, 90, `ICU${i + 1}`);
  for (let i = 0; i < 3; i++) put('icuBed', 'icu', 5 + i * 3.1, 24.7, 180, `ICU${i + 4}`);
  for (let i = 0; i < 6; i++) put('ventilator', 'icu', i < 3 ? 0.6 : 5.95 + (i - 3) * 3.1, i < 3 ? 16.75 + i * 3 : 25.45, 0, `VENT${i + 1}`);
  put('workstation', 'icu', 8.9, 18.35);
  put('workstation', 'icu', 8.9, 19.12, 180);
  put('crashCart', 'icu', 10.6, 14.42, 0, 'CRASH2');
  put('nurseStation', 'nurses', 16.5, 19.8, 90);
  put('orTable', 'or1', 25.5, 20.6, 0, 'OR1');
  put('orTable', 'or2', 34.2, 20.6, 0, 'OR2');
  for (const [room, x] of [['or1', 25.5], ['or2', 34.2]]) {
    put('anesthesiaCart', room, x - 1.6, 18.8, 90);
    put('instrumentTable', room, x + 2.2, 19.8, 270);
    put('scrubSink', room, x - 2, 14.4);
  }
  for (let i = 0; i < 5; i++) put('bed', 'er', 17.1 + i * 3.1, 24.7, 180, `ER${i + 1}`);
  put('triageDesk', 'er', 17.9, 17.5);
  put('waitingRow', 'er', 21.8, 14.45);
  put('workstation', 'er', 30, 16.7, 180);
  put('workstation', 'er', 31.6, 16.7, 180);
  put('medCart', 'er', 33.1, 14.4);
  put('crashCart', 'er', 32.7, 24.1, 90, 'CRASH1');
  put('receptionDesk', 'lobby', 3.05, 16.55);
  put('sofa', 'lobby', 0.6, 22.6, 90);
  put('sofa', 'lobby', 3.3, 20.75);
  put('armchair', 'lobby', 5.2, 22.1, 270);
  put('armchair', 'lobby', 5.2, 23.3, 270);
  put('waitingRow', 'lobby', 11.7, 22.2);
  put('waitingRow', 'lobby', 11.7, 24.15);
  put('coffeeKiosk', 'lobby', 12.1, 15);
  put('vending', 'lobby', 9.75, 14.55);
  put('mriScanner', 'radiology', 2.7, 2.75, 0, 'MRI1');
  put('ctScanner', 'radiology', 7.2, 2.35, 0, 'CT1');
  put('xrayMachine', 'radiology', 11.65, 1.95, 0, 'XRAY1');
  put('controlDesk', 'radiology', 4.3, 7, 180);
  put('waitingRow', 'radiology', 0.45, 7.3, 90);
  for (const [x, z] of [[16.7, 3.6], [21.3, 3.6], [16.7, 6.4], [21.3, 6.4]]) put('labBench', 'lab', x, z);
  put('analyzer', 'lab', 17.55, 0.6, 0, 'AN1');
  put('labFridge', 'lab', 14.75, 0.55);
  put('pillRobot', 'pharmacy', 28, 0.72, 0, 'ROBOT1');
  put('pharmacyShelf', 'pharmacy', 25.55, 3);
  put('pharmacyShelf', 'pharmacy', 30.45, 3);
  put('workstation', 'pharmacy', 25.8, 8.1, 180);
  return out;
}
