// Fake demo patients (master.md section 11). No real patient data.

export type RiskLevel = "low" | "medium" | "high"

export interface Profile {
    name: string
    age: number
    reason: string
    notes: string[]
}

export interface MedScheduleItem {
    med: string
    dose: string
    times: string[] // story time, "HH:MM"
}

export interface Vital {
    type: string // "bp_systolic", "glucose", "pain", ...
    value: number
    simTime: string
}

export interface PatientSeed {
    room: string
    podId: string
    profile: Profile
    allergies: string[]
    riskScores: Record<string, RiskLevel>
    medSchedule: MedScheduleItem[]
    vitals: Vital[]
}

export const PATIENT_SEEDS: Record<string, PatientSeed> = {
    "room-2": {
        room: "room-2",
        podId: "pod-a",
        profile: { name: "Daniel Okafor", age: 67, reason: "Pneumonia", notes: ["On IV antibiotics", "O2 2L nasal cannula"] },
        allergies: ["penicillin"],
        riskScores: { fallRisk: "medium", sepsisRisk: "medium" },
        medSchedule: [{ med: "ceftriaxone", dose: "1 g IV", times: ["20:00", "08:00"] }],
        vitals: [{ type: "bp_systolic", value: 128, simTime: "19:30" }]
    },
    "room-4": {
        room: "room-4",
        podId: "pod-a",
        profile: { name: "Linda Park", age: 58, reason: "Knee replacement, post-op day 1", notes: ["Low potassium on evening labs"] },
        allergies: [],
        riskScores: { fallRisk: "medium" },
        medSchedule: [
            { med: "potassium chloride", dose: "20 mEq PO", times: ["03:00"] },
            { med: "oxycodone", dose: "5 mg PO PRN pain", times: [] }
        ],
        vitals: [{ type: "pain", value: 5, simTime: "19:30" }]
    },
    "room-6": {
        room: "room-6",
        podId: "pod-a",
        profile: { name: "Walter Hughes", age: 81, reason: "Hip pain", notes: ["Unsteady gait", "Uses walker"] },
        allergies: ["sulfa"],
        riskScores: { fallRisk: "high" },
        medSchedule: [{ med: "acetaminophen", dose: "650 mg PO", times: ["22:00", "04:00"] }],
        vitals: [{ type: "bp_systolic", value: 136, simTime: "19:30" }]
    },
    "room-8": {
        room: "room-8",
        podId: "pod-a",
        profile: { name: "Grace Lee", age: 45, reason: "Type 1 diabetes, stable", notes: ["Insulin pump"] },
        allergies: [],
        riskScores: { fallRisk: "low", hypoglycemiaRisk: "high" },
        medSchedule: [{ med: "insulin glargine", dose: "18 units SC", times: ["21:00"] }],
        vitals: [{ type: "glucose", value: 142, simTime: "19:30" }]
    },
    "room-3": {
        room: "room-3",
        podId: "pod-b",
        profile: { name: "Grace Li", age: 52, reason: "Cellulitis, left leg", notes: [] },
        allergies: [],
        riskScores: { fallRisk: "low" },
        medSchedule: [{ med: "cefazolin", dose: "1 g IV", times: ["22:00", "06:00"] }],
        vitals: []
    }
}
