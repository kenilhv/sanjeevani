import { PATIENTS, POD_ROOMS, nurseAgent, twinAgent, type FrontendEvent } from "../contracts.ts"
import { publish, withId } from "../events.ts"
import type { Backend } from "./index.ts"
import { answerNurseQuestion, reviewNurseNote, reviewPatientWords, writeBriefing } from "../brain.ts"

// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER for Nagpal's work: the Terse Durable Actors (Patient, Pod, Unit) and the two agent
// brains (Patient Twin, Nurse Agent). Every method, return value and event follows contracts.md
// §2–4, so the screens and voice run end to end today. The agent replies are scripted samples of what the
// real agents should say, written to read like a real night on a med-surg floor. Swap it out with
// BACKEND=terse. Not durable: state lives in memory. All patients are fictional.
// ─────────────────────────────────────────────────────────────────────────────

type Vitals = { hr: number; spo2: number; rr: number; sys: number; dia: number; temp: number }
type Med = { name: string; dose: string; route: string; freq: string; next?: string; lastGiven?: string; note?: string }
type Note = { id: string; text: string; status: "draft" | "confirmed"; simTime: string; by: string }
type Chart = {
  room: string
  name: string
  age: number
  sex: "F" | "M"
  mrn: string
  diagnosis: string
  admitted: string
  attending: string
  codeStatus: string
  allergies: string[]
  isolation: string | null
  diet: string
  mobility: string
  oxygen: string
  fallRisk: { tool: "Morse"; score: number; level: "low" | "moderate" | "high" }
  meds: Med[]
  labs: { name: string; value: string; at: string; flag?: "L" | "H" }[]
  baseline: Vitals
}

const CHARTS: Record<string, Chart> = {
  "room-2": {
    room: "room-2", name: "Daniel Okafor", age: 67, sex: "M", mrn: "HG-4417203", diagnosis: "Community-acquired pneumonia, right lower lobe",
    admitted: "Oct 29, 14:20", attending: "Dr. Priya Raman (Hospitalist)", codeStatus: "Full code", allergies: ["Penicillin (hives)"],
    isolation: "Droplet", diet: "Regular", mobility: "Up with assist", oxygen: "2 L nasal cannula",
    fallRisk: { tool: "Morse", score: 35, level: "moderate" },
    meds: [
      { name: "Ceftriaxone", dose: "1 g", route: "IV", freq: "q24h", next: "14:00", lastGiven: "14:00" },
      { name: "Azithromycin", dose: "500 mg", route: "IV", freq: "q24h", next: "15:00", lastGiven: "15:00" },
      { name: "Acetaminophen", dose: "650 mg", route: "PO", freq: "q6h PRN temp > 38.0", lastGiven: "22:10" },
      { name: "Enoxaparin", dose: "40 mg", route: "SC", freq: "daily", next: "09:00" },
    ],
    labs: [
      { name: "WBC", value: "14.8 K/µL", at: "Oct 30 05:40", flag: "H" },
      { name: "Lactate", value: "1.6 mmol/L", at: "Oct 30 05:40" },
      { name: "Creatinine", value: "1.1 mg/dL", at: "Oct 30 05:40" },
    ],
    baseline: { hr: 96, spo2: 93, rr: 21, sys: 128, dia: 76, temp: 38.1 },
  },
  "room-4": {
    room: "room-4", name: "Linda Park", age: 58, sex: "F", mrn: "HG-4417588", diagnosis: "Left total knee arthroplasty, post-op day 1",
    admitted: "Oct 30, 07:05", attending: "Dr. Marcus Feld (Orthopedics)", codeStatus: "Full code", allergies: ["Sulfa (rash)"],
    isolation: null, diet: "Regular", mobility: "Walker, PT twice daily", oxygen: "Room air",
    fallRisk: { tool: "Morse", score: 45, level: "moderate" },
    meds: [
      { name: "Potassium chloride", dose: "20 mEq", route: "PO", freq: "once", next: "03:00", note: "K⁺ 3.2 at 18:00" },
      { name: "Oxycodone", dose: "5 mg", route: "PO", freq: "q4h PRN pain 4–7" },
      { name: "Acetaminophen", dose: "1 g", route: "PO", freq: "q8h", next: "06:00", lastGiven: "22:00" },
      { name: "Apixaban", dose: "2.5 mg", route: "PO", freq: "BID", next: "09:00", lastGiven: "21:00" },
      { name: "Cefazolin", dose: "2 g", route: "IV", freq: "q8h × 24 h", next: "23:00", lastGiven: "15:00" },
    ],
    labs: [
      { name: "Potassium", value: "3.2 mmol/L", at: "Oct 30 18:00", flag: "L" },
      { name: "Hemoglobin", value: "10.9 g/dL", at: "Oct 30 18:00", flag: "L" },
    ],
    baseline: { hr: 84, spo2: 97, rr: 16, sys: 134, dia: 80, temp: 37.2 },
  },
  "room-6": {
    room: "room-6", name: "Walter Hughes", age: 81, sex: "M", mrn: "HG-4416950", diagnosis: "Right hip pain after a fall at home, no fracture on CT",
    admitted: "Oct 29, 19:45", attending: "Dr. Priya Raman (Hospitalist)", codeStatus: "DNR, okay to intubate", allergies: ["No known drug allergies"],
    isolation: null, diet: "Cardiac", mobility: "Walker, one assist", oxygen: "Room air",
    fallRisk: { tool: "Morse", score: 65, level: "high" },
    meds: [
      { name: "Oxycodone", dose: "2.5 mg", route: "PO", freq: "q6h PRN pain", lastGiven: "20:15" },
      { name: "Metoprolol tartrate", dose: "25 mg", route: "PO", freq: "BID", next: "09:00", lastGiven: "21:00" },
      { name: "Tamsulosin", dose: "0.4 mg", route: "PO", freq: "nightly", lastGiven: "21:00" },
      { name: "Zolpidem", dose: "5 mg", route: "PO", freq: "nightly PRN sleep", note: "New tonight. Beers Criteria: avoid in older adults." },
    ],
    labs: [{ name: "Sodium", value: "134 mmol/L", at: "Oct 30 05:30", flag: "L" }],
    baseline: { hr: 72, spo2: 95, rr: 16, sys: 142, dia: 84, temp: 36.7 },
  },
  "room-8": {
    room: "room-8", name: "Grace Lee", age: 45, sex: "F", mrn: "HG-4417612", diagnosis: "Type 1 diabetes, admitted for DKA (resolved), insulin being adjusted",
    admitted: "Oct 30, 02:10", attending: "Dr. Samuel Ade (Endocrinology)", codeStatus: "Full code", allergies: ["Latex"],
    isolation: null, diet: "Consistent carbohydrate", mobility: "Independent", oxygen: "Room air",
    fallRisk: { tool: "Morse", score: 15, level: "low" },
    meds: [
      { name: "Insulin glargine", dose: "22 units", route: "SC", freq: "nightly", lastGiven: "21:00" },
      { name: "Insulin lispro", dose: "per sliding scale", route: "SC", freq: "AC + HS", lastGiven: "21:00", note: "4 units at HS for BG 212" },
      { name: "Dextrose 50%", dose: "25 mL", route: "IV", freq: "PRN BG < 70, unable to take PO" },
    ],
    labs: [
      { name: "Glucose (POC)", value: "212 mg/dL", at: "Oct 30 21:00", flag: "H" },
      { name: "Anion gap", value: "11", at: "Oct 30 18:00" },
    ],
    baseline: { hr: 78, spo2: 98, rr: 14, sys: 118, dia: 74, temp: 36.8 },
  },
  "room-3": {
    room: "room-3", name: "Grace Li", age: 52, sex: "F", mrn: "HG-4417455", diagnosis: "Left lower leg cellulitis, IV antibiotics",
    admitted: "Oct 30, 11:30", attending: "Dr. Elena Voss (Hospitalist)", codeStatus: "Full code", allergies: ["Vancomycin (red man syndrome, slow infusion)"],
    isolation: "Contact (MRSA history)", diet: "Regular", mobility: "Independent", oxygen: "Room air",
    fallRisk: { tool: "Morse", score: 25, level: "low" },
    meds: [{ name: "Linezolid", dose: "600 mg", route: "IV", freq: "q12h", next: "23:00", lastGiven: "11:00" }],
    labs: [{ name: "WBC", value: "12.1 K/µL", at: "Oct 30 06:00", flag: "H" }],
    baseline: { hr: 82, spo2: 97, rr: 16, sys: 126, dia: 78, temp: 37.6 },
  },
}

const ANSWERS: Record<string, string> = {
  "room-2": "His systolic went 128, 112, 98 between 03:00 and 04:00, heart rate up to 108. Sam assessed him at 04:05; a 500 mL bolus went in and the last BP was 106 over 64. Lactate is pending.",
  "room-4": "Pain was 7 out of 10 at 22:00, so Maya gave oxycodone 5 mg. At the 23:00 recheck it was 3, and she slept after that.",
  "room-6": "Zolpidem 5 mg was given at 23:30 because he couldn't sleep. I flagged it as high-risk at 81 with a Morse score of 65. Bed alarm has been on since 23:34, and there were no falls.",
  "room-8": "At 02:00 she said she felt shaky. Glucose was 62. She had 4 ounces of juice, and the 02:15 recheck was 108.",
}

const BRIEFING =
  "Good morning Jordan. Room 2, Daniel Okafor, is your sickest: his blood pressure fell to 98 overnight. Sam saw him at four and fluids are running. " +
  "Room 4: the 3 a.m. potassium was given late but is charted, and her pain is down to 3. " +
  "Room 6: new sleeping pill at 81, bed alarm on, no falls. Room 8: low sugar at 2, treated, now 108."

const HANDOFF: Record<string, string> = {
  "room-2": "Watcher. Pneumonia; SBP fell to 98, 500 mL bolus at 04:10, now 106/64. Lactate pending. Recheck BP at 08:00.",
  "room-4": "Stable. POD 1 knee. 03:00 KCl given late, charted. Pain 7 to 3. Repeat K⁺ with 06:00 labs, PT at 10:00.",
  "room-6": "Stable, high fall risk. Zolpidem 5 mg at 23:30. Bed alarm on, hourly rounds, no falls.",
  "room-8": "Stable. Hypoglycemia 62 at 02:00, juice, 108 at 02:15. Endocrine to review the glargine dose.",
}

// Read-back must mention the key point for that room before the Twin confirms it.
const READBACK_KEYS: Record<string, [RegExp, string]> = {
  "room-2": [/pressure|\bbp\b|fluid|bolus|lactate/i, "his blood pressure drop and the fluid bolus"],
  "room-4": [/potassium|\bk\b|kcl|pain/i, "the 3 a.m. potassium given late"],
  "room-6": [/zolpidem|sleep|bed alarm|fall/i, "the new zolpidem and the bed alarm"],
  "room-8": [/sugar|glucose|shaky|hypo|juice/i, "the 2 a.m. low glucose"],
}

// How a Twin triages what its patient says at the bedside.
const URGENT_WORDS = /shaky|chest|can'?t breathe|short of breath|breathing|dizzy|faint|fell|fall|bleed|confus|numb|sweaty|heart|worst|10 out of 10|help/i
const SOON_WORDS = /pain|hurt|ache|sore|nause|sick|vomit|itch|cold|hot|can'?t sleep|bathroom|toilet|anxious|scared/i
// What only this patient's Twin knows, added when it escalates.
const TWIN_CONTEXT: Record<string, string> = {
  "room-2": "Pneumonia on 2 L oxygen, SpO2 93% last check. Look at breathing first.",
  "room-4": "Day-1 knee. Last oxycodone 5 mg at 22:00; next PRN dose allowed now.",
  "room-6": "81, Morse fall score 65, zolpidem tonight. Don't let him get up alone.",
  "room-8": "She's diabetic: glargine 22 units at 21:00 and she ate little at dinner. Check glucose?",
  "room-3": "Cellulitis on linezolid. Check the leg for spreading redness.",
}

const NUMBER_WORDS: Record<string, string> = { two: "2", three: "3", four: "4", six: "6", eight: "8" }
const NOISE: Vitals = { hr: 1.6, spo2: 0.5, rr: 0.7, sys: 2.2, dia: 1.4, temp: 0.04 }

type MockState = {
  storySec: number
  speed: number
  nurse: Record<string, string | null>
  lastNurse: Record<string, string | null>
  status: Record<string, string>
  owner: Record<string, string | null>
  base: Record<string, Vitals>
  vitalsLog: Record<string, ({ simTime: string } & Partial<Vitals> & { type?: string; value?: number })[]>
  notes: Record<string, Note[]>
  flags: Record<string, string[]>
  fired: Set<string>
  noteSeq: number
  version: number
}

let state = freshState()

function freshState(): MockState {
  return {
    storySec: 0,
    speed: 1,
    nurse: { "pod-a": null, "pod-b": null },
    lastNurse: { "pod-a": null, "pod-b": null },
    status: Object.fromEntries(Object.keys(PATIENTS).map((r) => [r, "stable"])),
    owner: Object.fromEntries(Object.keys(PATIENTS).map((r) => [r, null])),
    base: Object.fromEntries(Object.entries(CHARTS).map(([r, c]) => [r, { ...c.baseline }])),
    vitalsLog: {},
    notes: {},
    flags: {},
    fired: new Set(),
    noteSeq: 0,
    version: 0,
  }
}

// ── Story clock: seconds since 19:00, so 23:30 < 03:30 < 07:00 across midnight ──
const simTime = () => fromNightMinutes(Math.floor(state.storySec / 60))
function nightMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return (h! * 60 + m! - 19 * 60 + 1440) % 1440
}
function fromNightMinutes(mins: number) {
  const total = (mins + 19 * 60) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

function send(event: FrontendEvent) {
  publish(withId(event))
}
function relay(from: string, to: string, type: string, text: string, level?: string) {
  send({ kind: "agent.message", from, to, type, ...(level ? { level } : {}), text, simTime: simTime() })
}
function roomStatus(room: string, status: string, label?: string) {
  state.version++
  state.status[room] = status
  send({ kind: "room.status", room, status, owner: state.owner[room], ...(label ? { label } : {}) })
}
const podOf = (room: string) => PATIENTS[room]!.pod
const flag = (room: string, text: string) => { state.version++; (state.flags[room] ??= []).push(text) }

function draft(room: string, text: string, by: string) {
  state.version++
  const note: Note = { id: `note-${++state.noteSeq}`, text, status: "draft", simTime: simTime(), by }
  ;(state.notes[room] ??= []).push(note)
  return note
}

// Real-time physiology: baseline plus a little noise, every 5 real seconds.
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5
function sampleVitals(room: string): Vitals {
  const b = state.base[room]!
  const r = (k: keyof Vitals, d = 0) => Number((b[k] + NOISE[k] * gauss()).toFixed(d))
  return { hr: r("hr"), spo2: Math.min(100, r("spo2")), rr: r("rr"), sys: r("sys"), dia: r("dia"), temp: r("temp", 1) }
}
function nudge(room: string, to: Partial<Vitals>) {
  Object.assign(state.base[room]!, to)
  send({ kind: "vitals", room, vitals: sampleVitals(room), simTime: simTime() })
}

/** Splits "Room 4, pain 7. Room 6 gave zolpidem" into per-room notes. */
function splitByRoom(transcript: string, pod: string) {
  const normalized = transcript.replace(/\broom\s+(two|three|four|six|eight)\b/gi, (_, w) => `room ${NUMBER_WORDS[w.toLowerCase()]}`)
  const notes: { room: string; text: string }[] = []
  for (const match of normalized.matchAll(/room\s*(\d+)[\s,:.-]*(.*?)(?=\broom\s*\d+|$)/gis)) {
    const room = `room-${match[1]}`
    if (POD_ROOMS[pod]?.includes(room)) notes.push({ room, text: match[2]!.trim().replace(/[.,]$/, "") || normalized })
  }
  return notes
}

// ── Actor alarms on the story clock ───────────────────────────────────────
function runAlarms(previous: number, next: number) {
  const crossed = (at: string) => previous < nightMinutes(at) && next >= nightMinutes(at)
  // Room 4's med_due alarm: 30 minutes after the 03:00 potassium, the Twin checks the chart.
  // It only raises an alert if nobody charted the dose; a charted dose gets a quiet confirmation.
  if (crossed("03:30") && !state.fired.has("room-4.med_due")) {
    state.fired.add("room-4.med_due")
    const charted = (state.notes["room-4"] ?? []).some((n) => /potassium|\bkcl\b|\bk\b/i.test(n.text))
    if (charted) {
      relay(twinAgent("room-4"), nurseAgent("pod-a"), "note.ack", "03:00 potassium chloride is charted as given. Repeat K⁺ with the 06:00 labs.")
    } else {
      flag("room-4", "03:00 KCl not charted")
      relay(twinAgent("room-4"), nurseAgent("pod-a"), "alert", "03:00 potassium chloride 20 mEq PO not charted. K⁺ was 3.2 at 18:00. Given?", "urgent")
      roomStatus("room-4", "urgent", "3am potassium not charted")
      setSpeed(1) // the demo stops fast-forward once the alarm lands
    }
  }
  if (crossed("06:45") && !state.fired.has("handoff_prep")) {
    state.fired.add("handoff_prep")
    for (const room of POD_ROOMS["pod-a"]!) relay(twinAgent(room), nurseAgent("pod-a"), "handoff.section", HANDOFF[room]!)
    void prepareBrief("pod-a", "jordan")
  }
}
function setStory(sec: number) {
  const previous = Math.floor(state.storySec / 60)
  state.storySec = ((sec % 86400) + 86400) % 86400
  const next = Math.floor(state.storySec / 60)
  if (next !== previous) send({ kind: "clock", simTime: simTime(), speed: state.speed })
  runAlarms(previous, next)
}
function setSpeed(speed: number) {
  state.speed = speed
  send({ kind: "clock", simTime: simTime(), speed })
}

// One real second moves the story by `speed` seconds (contracts.md §6).
setInterval(() => setStory(state.storySec + state.speed), 1000).unref()
setInterval(() => {
  for (const room of Object.keys(CHARTS)) send({ kind: "vitals", room, vitals: sampleVitals(room), simTime: simTime() })
}, 5000).unref()

// ── The agents' judgment: Claude when configured (src/brain.ts), these rules otherwise ─────────────
const NURSE_NAME: Record<string, string> = { maya: "Maya", jordan: "Jordan", sam: "Sam" }
const nurseName = (id: string | null | undefined) => NURSE_NAME[id ?? ""] ?? "the nurse"
const label = (room: string) => room.replace("room-", "Room ")
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))
const openFlags = (room: string) => (["warning", "urgent"].includes(state.status[room]!) ? (state.flags[room] ?? []).slice(-3) : [])
function chartFor(room: string) {
  const { baseline, ...chart } = CHARTS[room]!
  return { ...chart, currentVitals: sampleVitals(room), roomStatus: state.status[room] }
}
const tonightFor = (room: string) => [
  ...(state.notes[room] ?? []).map((n) => ({ time: n.simTime, by: n.by, text: n.text })),
  ...(state.vitalsLog[room] ?? []).map((v) => ({ time: v.simTime, vital: v.type, value: v.value })),
]
const podView = (pod: string) => Object.fromEntries(POD_ROOMS[pod]!.map((r) => [r, { chart: chartFor(r), tonight: tonightFor(r), openFlags: openFlags(r) }]))

/** What the screens show while and after an agent works on something someone said. */
function insight(e: { who: string; role: "nurse" | "patient"; room: string | null; agent: string; transcript: string; picked: { label: string; value: string }[]; actions: string[]; decision: string; level: string; chat: { question: string; answer: string }[]; brain: string }) {
  send({ kind: "insight", ...e, simTime: simTime() })
}
/** The Nurse Agent and a Twin talking: genuine questions and grounded answers, paced so people can follow. */
async function converse(nurse: string, twin: string, chat: { question: string; answer: string }[]) {
  for (const x of chat) {
    relay(nurse, twin, "question", x.question)
    await pause(900)
    relay(twin, nurse, "answer", x.answer)
    await pause(700)
  }
}

// Rule-based reading of a nurse's words: used on its own without Claude, and as a guardrail for the moments
// that must never be missed (a sedative in a high fall-risk patient, a dose that was never charted).
const MED_RE = /\b(zolpidem|ambien|oxycodone|morphine|hydromorphone|potassium(?: chloride)?|kcl|insulin|glargine|lispro|acetaminophen|tylenol|heparin|enoxaparin|apixaban|ceftriaxone|cefazolin|linezolid|metoprolol|furosemide|ondansetron|juice|dextrose)\b/i
const DOSE_RE = /\b(\d+(?:\.\d+)?)\s*(mg|milligrams?|mcg|units?|meq|ml|l|liters?)\b/i
const SYMPTOM_RE = /\b(short(?:ness)? of breath|breathless|can'?t breathe|chest pain|shaky|sweaty|dizzy|confus\w*|pain|nause\w*|vomit\w*|fever|bleeding|fell|fall)\b/i
function readNote(text: string) {
  const picked: { label: string; value: string }[] = []
  const med = text.match(MED_RE)?.[0], dose = text.match(DOSE_RE)?.[0], sym = text.match(SYMPTOM_RE)?.[0]
  const pain = text.match(/\bpain\s*(?:is|of)?\s*(\d{1,2})\b/i)?.[1], at = text.match(/\b(?:at|given at)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i)?.[1]
  if (med) picked.push({ label: "Medication", value: med })
  if (dose) picked.push({ label: "Dose", value: dose })
  if (pain) picked.push({ label: "Pain score", value: `${pain}/10` })
  if (sym) picked.push({ label: "Symptom", value: sym })
  if (at) picked.push({ label: "Time", value: at })
  if (/bed alarm/i.test(text)) picked.push({ label: "Safety", value: "Bed alarm on" })
  return picked
}
function guardrails(room: string, text: string) {
  if (room === "room-6" && /zolpidem|ambien|sleeping pill|sleep/i.test(text))
    return { level: "urgent", text: "Zolpidem at 81 with Morse fall score 65 is Beers high-risk. Bed alarm on, call light in reach?", label: "Fall risk + sleeping pill" }
  if (/short(?:ness)? of breath|breathless|can'?t breathe|chest pain/i.test(text))
    return { level: "urgent", text: `${text.match(SYMPTOM_RE)?.[0] ?? "New symptom"} reported. Check SpO2, respiratory rate and lung sounds now.`, label: "New breathing symptom" }
  return null
}
const resolvesByRule = (room: string, text: string) =>
  (room === "room-6" && /bed alarm/i.test(text)) || (room === "room-4" && /given|chart/i.test(text)) || (room === "room-8" && /juice|glucose|sugar|dextrose/i.test(text))

async function handleNurseNote(pod: string, room: string, text: string, who: string, transcript: string) {
  const nurse = nurseAgent(pod), twin = twinAgent(room)
  relay(nurse, twin, "note.new", text)
  const review = await reviewNurseNote({ chart: chartFor(room), tonight: tonightFor(room), openFlags: openFlags(room), nurse: nurseName(who), note: text, simTime: simTime() })
  const guard = guardrails(room, text)
  let level = review?.alertLevel ?? "none", alertText = review?.alertText ?? ""
  if (guard && (level === "none" || level === "fyi")) { level = guard.level; alertText = guard.text }
  const resolves = (review?.resolvesOpenFlag || resolvesByRule(room, text)) && ["warning", "urgent"].includes(state.status[room]!)
  draft(room, review?.logAs || text, who)
  const picked = review?.picked?.length ? review.picked : readNote(text)
  const actions = review?.actions?.length ? review.actions : [
    `Logging "${text}" as an AI draft for ${nurseName(who)} to confirm`,
    `Checking it against ${CHARTS[room]!.name}'s chart, allergies and tonight's notes`,
    level === "urgent" || level === "soon" ? "Warning the Nurse Agent with the reason" : resolves ? "Closing the open flag" : "No new risk found",
  ]
  const decision = level === "urgent" ? "Urgent: warning the Nurse Agent now" : level === "soon" ? "Needs attention this hour" : resolves ? "Flag closed" : "Logged, no new risk"
  insight({ who, role: "nurse", room, agent: twin, transcript, picked, actions, decision, level: resolves ? "resolved" : level, chat: review?.nurseAgentChat ?? [], brain: review ? "claude" : "rules" })
  if (level === "urgent" || level === "soon") {
    flag(room, alertText)
    relay(twin, nurse, "alert", alertText, level)
    roomStatus(room, level === "urgent" ? "urgent" : "warning", guard?.label ?? alertText.slice(0, 48))
  } else if (resolves) {
    if (room === "room-8") nudge(room, { hr: 80 })
    roomStatus(room, "resolved")
  }
  relay(twin, nurse, "note.ack", review?.ack ?? `Logged as AI draft. ${resolves ? "Flag closed." : "Waiting for your confirmation."}`)
  void converse(nurse, twin, review?.nurseAgentChat ?? [])
}

let briefCache: { version: number; result: Promise<{ text: string; sections: unknown[] }> } | null = null
function fallbackBriefing(pod: string, to: string) {
  const order = { urgent: 0, warning: 1, resolved: 2, stable: 3 } as Record<string, number>
  const rooms = [...POD_ROOMS[pod]!].sort((a, b) => (order[state.status[a]!] ?? 3) - (order[state.status[b]!] ?? 3))
  const sections = rooms.map((r) => {
    const notes = (state.notes[r] ?? []).map((n) => `${n.simTime} ${n.text}`)
    const st = state.status[r] === "urgent" ? "unstable" : state.status[r] === "warning" ? "watcher" : "stable"
    const patientSaid = (state.notes[r] ?? []).filter((n) => n.by.startsWith("bedside-")).map((n) => `${n.simTime} ${n.text.replace(/^Patient said: /, "")}`)
    return { room: r, patient: CHARTS[r]!.name, status: st, summary: `${CHARTS[r]!.age}, ${CHARTS[r]!.diagnosis}`, overnight: notes.length ? notes : ["Quiet night"], patientSaid, todo: [], watchFor: openFlags(r)[0] ?? "Routine" }
  })
  const lines = sections.map((s) => `${label(s.room)}, ${s.patient}: ${s.overnight.at(-1)}.`)
  return { text: `Good morning ${nurseName(to)}. ${lines.join(" ")}`, sections }
}
function prepareBrief(pod: string, to = "jordan") {
  if (briefCache?.version === state.version) return briefCache.result
  const version = state.version
  const result = writeBriefing({ from: nurseName(state.lastNurse[pod] ?? state.nurse[pod] ?? "maya"), to: nurseName(to), pod: podView(pod), simTime: simTime() })
    .then((b) => {
      if (!b) return fallbackBriefing(pod, to)
      // "Patient said" is only for rooms where the patient really spoke at the bedside; never a nurse's note.
      const spoke = (room: string) => (state.notes[room] ?? []).some((n) => n.by.startsWith("bedside-"))
      return { text: b.spoken, sections: b.sections.map((s) => ({ ...s, patientSaid: spoke(s.room) ? s.patientSaid : [] })) }
    })
  briefCache = { version, result }
  return result
}

// ── Methods (contracts.md §2) ─────────────────────────────────────────────
type Handler = (key: string, input: Record<string, any>) => unknown

const handlers: Record<string, Handler> = {
  async "pod.voiceNote"(pod, { transcript, nurseId }) {
    const notes = splitByRoom(String(transcript ?? ""), pod)
    const who = nurseId ?? state.nurse[pod] ?? "nurse"
    if (!notes.length) {
      insight({ who, role: "nurse", room: null, agent: nurseAgent(pod), transcript: String(transcript ?? ""), picked: readNote(String(transcript ?? "")), actions: ["Listening for a room number", "Holding the note until it knows which patient it is about"], decision: "Which room? Say the room number.", level: "fyi", chat: [], brain: "rules" })
      return { routed: [] }
    }
    await Promise.all(notes.map(({ room, text }) => handleNurseNote(pod, room, text, who, String(transcript ?? ""))))
    return { routed: notes }
  },
  async "pod.ask"(pod, { question, nurseId }) {
    const q = String(question ?? "")
    const nurse = nurseAgent(pod), who = nurseId ?? state.nurse[pod] ?? "nurse"
    const review = await answerNurseQuestion({ question: q, nurse: nurseName(who), pod: podView(pod), simTime: simTime() })
    let room = review && POD_ROOMS[pod]!.includes(review.room) ? review.room : splitByRoom(q, pod)[0]?.room ?? null
    let answer = review?.answer
    let chat = review?.nurseAgentChat ?? []
    if (!answer) {
      if (!room) {
        const open = POD_ROOMS[pod]!.filter((r) => ["urgent", "warning"].includes(state.status[r]!))
        answer = open.length ? `${open.map((r, i) => `${i === 0 ? "First" : "Then"} ${label(r)}: ${state.flags[r]?.at(-1) ?? "needs a check"}`).join(". ")}.` : "Everyone on the ward is settled right now. Next due: 06:00 vitals and morning labs."
      } else {
        answer = ANSWERS[room] ?? "I don't have that in the record yet."
        chat = [{ question: `${nurseName(who)} asks: ${q}`, answer }]
      }
    }
    insight({ who, role: "nurse", room, agent: nurse, transcript: q, picked: review?.picked ?? (room ? [{ label: "Room", value: label(room) }] : []), actions: review?.actions ?? [room ? `Asking ${label(room)}'s Twin` : "Ranking the open flags across the ward", "Answering from the night's record"], decision: "Answered", level: "fyi", chat, brain: review ? "claude" : "rules" })
    if (room) void converse(nurse, twinAgent(room), chat)
    return { answer, room }
  },
  "pod.signIn"(pod, { nurseId }) {
    const from = state.nurse[pod] ?? state.lastNurse[pod] ?? null
    state.nurse[pod] = nurseId
    for (const room of POD_ROOMS[pod]!) state.owner[room] ??= nurseId
    send({ kind: "nurse.change", pod, from, to: nurseId })
    return { ok: true, currentNurse: nurseId }
  },
  "pod.signOut"(pod) {
    state.lastNurse[pod] = state.nurse[pod] ?? null
    state.nurse[pod] = null
    return { ok: true, keptContext: true }
  },
  // The handover, written from everything that happened tonight. Same text on every call until something changes.
  async "pod.brief"(pod, { nurseId }) {
    return prepareBrief(pod, nurseId ?? "jordan")
  },
  "pod.getState"(pod) {
    const rooms = POD_ROOMS[pod]!
    return {
      pod,
      rooms,
      currentNurse: state.nurse[pod],
      alertQueue: rooms.filter((r) => state.flags[r]?.length && state.status[r] !== "stable").map((r) => ({ room: r, level: state.status[r], text: state.flags[r]!.at(-1) })),
      todo: ["06:00 vitals + morning labs (BMP, CBC)", "Room 4: repeat K⁺", "Room 2: recheck BP 08:00", "Room 6: hourly fall rounds"],
    }
  },
  // The Twin listens to everything the patient says and decides, itself, whether the nurse needs to come now.
  async "patient.patientRequest"(room, { text }) {
    const said = String(text ?? "")
    const pod = podOf(room), twin = twinAgent(room), nurse = nurseAgent(pod), onShift = state.nurse[pod]
    const review = await reviewPatientWords({ chart: chartFor(room), tonight: tonightFor(room), openFlags: openFlags(room), said, simTime: simTime(), nurseOnShift: nurseName(onShift) })
    draft(room, `Patient said: "${said}"`, `bedside-${room}`)
    // Without Claude, a word list decides: possible harm now, discomfort this hour, comfort requests next round.
    const ruleLevel = URGENT_WORDS.test(said) ? "urgent" : SOON_WORDS.test(said) ? "soon" : "fyi"
    const level = review ? (review.callNurse ? (review.urgency === "none" || review.urgency === "fyi" ? "soon" : review.urgency) : "fyi") : ruleLevel
    const callNurse = level === "urgent" || level === "soon"
    const toNurseAgent = review?.toNurseAgent || (callNurse ? `Patient says '${said}'. ${TWIN_CONTEXT[room] ?? ""}`.trim() : `Patient asks: '${said}'. Not urgent; bundled into the next round.`)
    const reply = review?.replyToPatient || (callNurse ? `${nurseName(onShift)} is on the way. Stay where you are.` : "I've passed that on. Your nurse will bring it on the next round.")
    insight({
      who: `bedside-${room}`, role: "patient", room, agent: twin, transcript: said,
      picked: review?.picked?.length ? review.picked : readNote(said),
      actions: review?.actions?.length ? review.actions : [`Listening to ${CHARTS[room]!.name}`, `Checking it against her chart and tonight's notes`, callNurse ? `Calling ${nurseName(onShift)} with the context` : "Bundling it for the next round"],
      decision: callNurse ? `${level === "urgent" ? "Urgent: calling" : "Calling"} ${nurseName(onShift)} now` : "Not urgent: noted for the next round",
      level, chat: callNurse ? review?.nurseAgentChat ?? [] : [], brain: review ? "claude" : "rules",
    })
    relay(twin, nurse, "patient.request", toNurseAgent, level)
    if (callNurse) {
      flag(room, `Patient: "${said}"`)
      roomStatus(room, level === "urgent" ? "urgent" : "warning", `Patient: "${said}"`)
      if (room === "room-8" && level === "urgent") nudge(room, { hr: 96, sys: 124 })
      // The Nurse Agent questions the Twin, then ranks the room against the ward and tells the nurse on shift.
      void converse(nurse, twin, review?.nurseAgentChat ?? []).then(() =>
        relay(nurse, onShift ?? "nurse", "rank", level === "urgent" ? `${label(room)} goes to the top of your list.` : `${label(room)} added to this hour's list.`))
    }
    return { ok: true, level, callNurse, reply, forwardedTo: nurse }
  },
  "patient.addVital"(room, { type, value, simTime: at }) {
    const log = (state.vitalsLog[room] ??= [])
    log.push({ type, value: Number(value), simTime: at ?? simTime() })
    const last3 = log.filter((v) => v.type === type).slice(-3).map((v) => v.value!)
    if (type === "bp_systolic") nudge(room, { sys: Number(value), dia: Math.round(Number(value) * 0.6), ...(Number(value) < 105 ? { hr: 108, rr: 22, temp: 38.4 } : {}) })
    const dropping = last3.length === 3 && last3[0]! > last3[1]! && last3[1]! > last3[2]!
    if (room === "room-2" && dropping && !state.fired.has("room-2.bp")) {
      state.fired.add("room-2.bp")
      flag(room, "SBP falling, meets sepsis screen")
      relay(twinAgent(room), nurseAgent("pod-a"), "alert", `SBP ${last3.join(" → ")} over 3 checks, HR 108, T 38.4. Meets sepsis screen. Escalate?`, "soon")
      roomStatus(room, "warning", "BP falling: 128 → 98")
      relay(nurseAgent("pod-a"), nurseAgent("pod-b"), "help.request", "Maya is with Room 8 (glucose 62). Can Sam check Room 2's blood pressure now?")
      relay(nurseAgent("pod-b"), nurseAgent("pod-a"), "help.response", "Yes. Sam is heading to Room 2 with the vitals cart, about 2 minutes.")
      // Sam's bolus works: pressure recovers over the next minutes of the demo.
      setTimeout(() => nudge(room, { sys: 106, dia: 64, hr: 98 }), 8000).unref()
    }
    return { ok: true, trend: last3 }
  },
  "patient.readback"(room, { text, nurseId }) {
    const pod = podOf(room)
    relay(nurseAgent(pod), twinAgent(room), "readback", `${nurseId}'s read-back: ${text}`)
    const [key, missing] = READBACK_KEYS[room] ?? [/./, ""]
    if (!key.test(String(text))) {
      relay(twinAgent(room), nurseAgent(pod), "readback.missing", `Almost. Please include ${missing}.`)
      return { ok: false, missing }
    }
    relay(twinAgent(room), nurseAgent(pod), "readback.ok", "Read-back correct. Ownership can move.")
    send({ kind: "handoff.progress", room, state: "accepted" })
    state.owner[room] = nurseId
    roomStatus(room, "stable")
    return { ok: true }
  },
  "patient.ask"(room) {
    return { answer: ANSWERS[room] ?? "I don't have that in the record yet.", room }
  },
  "patient.getState"(room) {
    const c = CHARTS[room]!
    return {
      ...c,
      why: c.diagnosis,
      podId: podOf(room),
      status: state.status[room],
      owner: state.owner[room],
      vitals: sampleVitals(room),
      vitalsHistory: state.vitalsLog[room] ?? [],
      timeline: state.notes[room] ?? [],
      flags: state.flags[room] ?? [],
      handoffSection: state.fired.has("handoff_prep") ? HANDOFF[room] ?? null : null,
    }
  },
  "unit.setClock"(_, { simTime: at, speed }) {
    if (typeof speed === "number") state.speed = speed
    if (typeof at === "string") setStory(nightMinutes(at) * 60)
    send({ kind: "clock", simTime: simTime(), speed: state.speed })
    return { simTime: simTime(), speed: state.speed }
  },
  "unit.assign"(_, { podId, nurseId }) {
    return { ok: true, podId, nurseId }
  },
  "unit.markReadback"(_, { room, ok }) {
    return { ok: true, room, accepted: Boolean(ok) }
  },
  "unit.emit"(_, { event }) {
    send(event)
    return { ok: true }
  },
  "unit.getState"() {
    return {
      floor: "floor-4west",
      simTime: simTime(),
      speed: state.speed,
      assignments: state.nurse,
      roomStatus: Object.fromEntries(Object.keys(PATIENTS).map((r) => [r, { status: state.status[r], owner: state.owner[r] }])),
      checklist: Object.fromEntries(POD_ROOMS["pod-a"]!.map((r) => [r, { sectionReady: state.fired.has("handoff_prep"), flagsAcked: state.status[r] !== "urgent", readbackOk: state.owner[r] === "jordan", accepted: state.owner[r] === "jordan" }])),
    }
  },
  // Not in contracts.md yet: the Unit Actor needs an equivalent "clear and reseed" for the Reset button.
  "unit.reset"() {
    state = freshState()
    send({ kind: "clock", simTime: simTime(), speed: 1 })
    for (const room of Object.keys(PATIENTS)) roomStatus(room, "stable")
    return { ok: true }
  },
}

export const mockBackend: Backend = {
  name: "built-in",
  async call(actorId, method, input = {}) {
    const sep = actorId.indexOf(":")
    const handler = handlers[`${actorId.slice(0, sep)}.${method}`]
    if (!handler) throw new Error(`no actor method ${actorId}.${method}`)
    return handler(actorId.slice(sep + 1), input)
  },
}
