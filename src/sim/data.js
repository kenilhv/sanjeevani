// All people here are invented. First names and surnames are drawn without repeats, so "where is Elena?" has one answer.
const FEMALE = ['Amara', 'Priya', 'Elena', 'Mei', 'Fatima', 'Sofia', 'Aisha', 'Hana', 'Ingrid', 'Lucia', 'Noor', 'Thandi', 'Yuki', 'Zainab', 'Chloe', 'Maya', 'Rosa', 'Leila', 'Anika', 'Grace', 'Ngozi', 'Camila', 'Sana', 'Freya', 'Tala', 'Imani', 'Nadia', 'Olivia', 'Keiko', 'Marta', 'Esi', 'Renee', 'Salma', 'Bianca', 'Kavya', 'Adaeze', 'Dalia', 'Eun', 'Farah', 'Gabriela', 'Hyun', 'Isla', 'Jia', 'Kamala', 'Lena', 'Mina', 'Nia', 'Oksana', 'Paloma', 'Qing', 'Rania', 'Selma', 'Tessa', 'Ursula', 'Vera', 'Wanjiru', 'Ximena', 'Yara', 'Zofia'];
const MALE = ['Mateo', 'Kofi', 'Ravi', 'Liam', 'Omar', 'Hiro', 'Diego', 'Tariq', 'Sven', 'Chidi', 'Arjun', 'Luca', 'Jamal', 'Noah', 'Emeka', 'Kai', 'Rafael', 'Samir', 'Tomasz', 'Andre', 'Yusuf', 'Ben', 'Hassan', 'Felix', 'Ibrahim', 'Marcus', 'Nikhil', 'Paulo', 'Sanjay', 'Theo', 'Wei', 'Jin', 'Malik', 'Oscar', 'Aleksi', 'Bashir', 'Caleb', 'Dmitri', 'Elias', 'Farid', 'Gustavo', 'Henrik', 'Idris', 'Javier', 'Kenji', 'Lorenzo', 'Musa', 'Nasir', 'Olu', 'Pedro', 'Quang', 'Rohan', 'Stefan', 'Tevita', 'Umar', 'Viktor', 'Wale', 'Xavier', 'Yonas', 'Zane'];
const SURNAMES = ['Alvarez', 'Okafor', 'Chen', 'Patel', 'Nguyen', 'Kowalski', 'Haddad', 'Silva', 'Tanaka', 'Mensah', 'Novak', 'Rossi', 'Kim', 'Singh', 'Dubois', 'Larsen', 'Moreno', 'Adeyemi', 'Walsh', 'Cohen', 'Bianchi', 'Petrov', 'Rahman', 'Castillo', 'Yamamoto', 'Osei', 'Fischer', 'Khan', 'Reyes', 'Lindqvist', 'Mbeki', 'Sato', 'Ortiz', 'Murphy', 'Das', 'Vargas', 'Nowak', 'Eze', 'Abara', 'Bergstrom', 'Cruz', 'Delgado', 'Ekström', 'Farouk', 'Gomez', 'Hoang', 'Iyer', 'Jensen', 'Kaplan', 'Lam', 'Mirza', 'Nakamura', 'Oduya', 'Park', 'Quinn', 'Ramos', 'Sharma', 'Toure', 'Ueda', 'Vance', 'Wong', 'Xu', 'Yilmaz', 'Zhou', 'Aziz', 'Brennan', 'Costa', 'Diallo', 'Evans', 'Fofana', 'Gupta', 'Hughes', 'Ito', 'Jovanovic', 'Keita', 'Lopez', 'Mokoena', 'Naidoo', 'Ochoa', 'Popov', 'Rao', 'Suzuki', 'Tran', 'Uddin', 'Volkov', 'Weiss', 'Yeo', 'Zapata'];

export function makeNames(rng) {
  const pools = { f: rng.shuffle([...FEMALE]), m: rng.shuffle([...MALE]), s: rng.shuffle([...SURNAMES]) };
  const at = { f: 0, m: 0, s: 0 };
  const take = (k) => pools[k][at[k]++ % pools[k].length];
  return (gender) => {
    const g = gender ?? (rng.chance(0.54) ? 'f' : 'm');
    const first = take(g), last = take('s');
    return { g, first, last, name: `${first} ${last[0]}.` };
  };
}

const c = (reason, acuity, o = {}) => ({ reason, acuity, admit: 0, ...o });
const oxy = { spo2: 94.5, rr: 19 };
const fever = { temp: 37.9, hr: 92, rr: 18 };

export const WALK_INS = [
  c('Broken wrist', 4, { scan: 'XRAY', v: { hr: 86 } }),
  c('Sprained ankle', 5, { scan: 'XRAY' }),
  c('Stomach pains', 3, { scan: 'CT', admit: 0.25, ward: 'Stomach pains, under observation', v: { hr: 90 } }),
  c('High fever', 3, { admit: 0.2, ward: 'Fever, on a drip', v: fever }),
  c('Deep cut on the hand', 4, { v: { hr: 84 } }),
  c('Asthma flare-up', 3, { admit: 0.2, ward: 'Asthma, on a nebuliser', v: oxy }),
  c('Dizzy spells', 3, { scan: 'CT', admit: 0.15, ward: 'Dizziness, being monitored' }),
  c('Migraine that will not lift', 4, { scan: 'MRI', v: { hr: 82 } }),
  c('Allergic reaction', 2, { admit: 0.2, ward: 'Allergic reaction, being watched', v: { hr: 104, rr: 20 } }),
  c('Kidney stone', 3, { scan: 'CT', admit: 0.3, ward: 'Kidney stone, pain relief', v: { hr: 96, sys: 136 } }),
  c('Back pain after a fall', 4, { scan: 'XRAY' }),
  c('Tight chest', 2, { scan: 'XRAY', admit: 0.5, ward: 'Chest pain, heart being monitored', v: { hr: 98, sys: 142 } }),
  c('Nosebleed that will not stop', 4),
  c('Broken collarbone', 4, { scan: 'XRAY', v: { hr: 88 } }),
  c('Ear infection', 5, { v: { temp: 37.7 } }),
  c('Knee swollen after football', 5, { scan: 'MRI' }),
  c('Concussion after a fall', 3, { scan: 'CT', admit: 0.3, ward: 'Concussion, overnight watch' }),
];

export const AMBULANCE = [
  c('Chest pain', 2, { scan: 'XRAY', admit: 0.75, ward: 'Heart attack, recovering', icu: 0.25, v: { hr: 108, sys: 148, spo2: 95 } }),
  c('Fall at home, may have broken a hip', 3, { scan: 'XRAY', admit: 0.9, ward: 'Broken hip, awaiting surgery', v: { hr: 96 } }),
  c('Stroke symptoms', 1, { scan: 'CT', admit: 1, ward: 'Stroke, being monitored', icu: 0.4, v: { hr: 94, sys: 168, dia: 96 } }),
  c('Car accident, broken ribs', 2, { scan: 'CT', admit: 0.7, ward: 'Broken ribs, pain relief', v: { hr: 106, rr: 22, spo2: 95 } }),
  c('Struggling to breathe', 2, { scan: 'XRAY', admit: 0.8, ward: 'Pneumonia, on oxygen', v: { spo2: 93, rr: 24, hr: 104 } }),
  c('Collapsed at work', 2, { scan: 'CT', admit: 0.5, ward: 'Fainting, heart being monitored', v: { hr: 58, sys: 104 } }),
  c('Severe bleeding from a leg wound', 2, { admit: 0.6, ward: 'Leg wound, on antibiotics', v: { hr: 112, sys: 102 } }),
];

export const WARD = [
  c('Recovering from hip surgery', 4),
  c('Pneumonia, on oxygen', 3, { v: oxy, risk: 2 }),
  c('Heart failure, fluid on the lungs', 3, { v: { spo2: 95, hr: 88 }, risk: 2 }),
  c('New knee, learning to walk again', 4),
  c('Stroke recovery', 3, { v: { sys: 146 } }),
  c('Infected leg wound, on antibiotics', 4, { v: { temp: 37.5 } }),
  c('Recovering from appendix surgery', 4),
  c('Diabetes, sugar levels being steadied', 4),
  c('Broken hip, awaiting surgery', 3, { preop: 'hip repair' }),
  c('Gallstones, surgery booked', 4, { preop: 'gallbladder removal' }),
  c('Bowel surgery, day two', 3, { risk: 1 }),
  c('Chest infection, on a drip', 3, { v: { spo2: 95.5, temp: 37.6 }, risk: 1 }),
  c('Kidney infection', 4, { v: { temp: 37.6 } }),
  c('Blood clot in the leg', 4),
  c('Knee replacement booked', 4, { preop: 'knee replacement' }),
];

export const ICU = [
  c('Severe pneumonia, on a ventilator', 1, { vent: true, v: { spo2: 94, rr: 18, hr: 96 }, risk: 3 }),
  c('After a heart attack, watched closely', 2, { v: { hr: 88, sys: 112 }, risk: 2 }),
  c('Sepsis, on strong antibiotics', 1, { v: { hr: 104, temp: 38.1, sys: 106 }, risk: 3 }),
  c('Recovering from major bowel surgery', 2, { risk: 1 }),
  c('Head injury, being monitored', 2, { vent: true, v: { hr: 72, sys: 134 }, risk: 2 }),
  c('Heart surgery, first night', 2, { vent: true, v: { hr: 84 }, risk: 2 }),
];

export const FLU = [
  c('Flu, high fever', 3, { admit: 0.3, ward: 'Flu, on fluids', v: { temp: 38.3, hr: 102, rr: 20 } }),
  c('Flu, struggling to breathe', 2, { scan: 'XRAY', admit: 0.55, ward: 'Flu with pneumonia, on oxygen', v: { spo2: 93.5, rr: 23, hr: 106, temp: 38.2 } }),
  c('Flu, badly dehydrated', 3, { admit: 0.35, ward: 'Flu, on a drip', v: { hr: 100, sys: 104, temp: 38 } }),
  c('Flu, feeling faint', 4, { admit: 0.12, ward: 'Flu, being watched', v: { temp: 37.9, hr: 96 } }),
];

// Anyone who came in through the front doors and is not a priority 1 or 2 walks to imaging on their own feet.
for (const cond of [...WALK_INS, ...FLU]) cond.walks = cond.acuity >= 3;

export const CASUALTIES = [
  c('Coach crash, internal bleeding', 1, { triage: 'red', scan: 'CT', admit: 1, surgery: 'emergency abdominal surgery', icu: 1, ward: 'Coach crash, after surgery', v: { hr: 124, sys: 92, rr: 26, spo2: 93 } }),
  c('Coach crash, head injury', 1, { triage: 'red', scan: 'CT', admit: 1, icu: 1, ward: 'Coach crash, head injury', v: { hr: 62, sys: 158, rr: 12, spo2: 94 } }),
  c('Coach crash, broken leg', 2, { triage: 'yellow', scan: 'XRAY', admit: 0.8, ward: 'Coach crash, broken leg', v: { hr: 110, sys: 128 } }),
  c('Coach crash, broken ribs', 2, { triage: 'yellow', scan: 'XRAY', admit: 0.6, ward: 'Coach crash, broken ribs', v: { hr: 104, rr: 22, spo2: 95 } }),
  c('Coach crash, cuts and bruises', 4, { triage: 'green', v: { hr: 92 } }),
  c('Coach crash, shoulder injury', 3, { triage: 'green', scan: 'XRAY', v: { hr: 90 } }),
];

export const SURGERY = ['knee replacement', 'hip repair', 'gallbladder removal', 'appendix removal', 'hernia repair', 'shoulder repair'];
export const SCAN_NAME = { XRAY: 'an X-ray', CT: 'a CT scan', MRI: 'an MRI scan' };
export const BASE_VITALS = { hr: 76, spo2: 97.5, rr: 15, sys: 122, dia: 76, temp: 36.8 };

// Plain-English status line per machine, picked by health band.
export const EQUIP_NOTES = {
  mri: ['Running perfectly, serviced last month.', 'Running well, next service in three weeks.', 'Cooling running warm, service due Thursday.', 'Cooling needs attention soon, engineer pencilled in.'],
  ct: ['Running perfectly, tube checked last week.', 'Running well, calibration next Monday.', 'Tube getting tired, service due Friday.', 'Image quality slipping, engineer pencilled in.'],
  xray: ['Running perfectly.', 'Running well, safety check next month.', 'Table motor a little slow, service due next week.', 'Table motor sticking, engineer pencilled in.'],
  ventilator: ['Filters fresh, breathing circuits checked.', 'Running well, filters due next week.', 'Filters due a change this week.', 'Pressure sensor drifting, swap it out soon.'],
  analyzer: ['Calibrated this morning.', 'Running well, reagents topped up.', 'Reagents running low, refill booked.', 'Throughput slowing, service booked.'],
  pillRobot: ['Picking accurately, stock levels healthy.', 'Running well, restock tonight.', 'Arm needs a clean, booked for tonight.', 'Arm slowing down, engineer pencilled in.'],
  crashCart: ['Checked and sealed this morning.', 'Checked and sealed this morning.', 'Due its daily check.', 'Due its daily check.'],
};

export const pronoun = (a) => (a.gender === 'f' ? { he: 'she', his: 'her', him: 'her', He: 'She', His: 'Her' } : { he: 'he', his: 'his', him: 'him', He: 'He', His: 'His' });
export const lowerFirst = (s) => s[0].toLowerCase() + s.slice(1);
