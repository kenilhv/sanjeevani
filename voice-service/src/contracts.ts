// Shared IDs from contracts.md section 1. Use these exact strings everywhere.

export const FLOOR = "floor-4west"
export const UNIT = `unit:${FLOOR}`

export const POD_ROOMS: Record<string, string[]> = {
  "pod-a": ["room-2", "room-4", "room-6", "room-8"],
  "pod-b": ["room-3"],
}

export const PATIENTS: Record<string, { name: string; age: number; why: string; pod: string }> = {
  "room-2": { name: "Daniel Okafor", age: 67, why: "Pneumonia", pod: "pod-a" },
  "room-4": { name: "Linda Park", age: 58, why: "Knee replacement, day 1", pod: "pod-a" },
  "room-6": { name: "Walter Hughes", age: 81, why: "Hip pain, high fall risk", pod: "pod-a" },
  "room-8": { name: "Grace Lee", age: 45, why: "Diabetic, stable", pod: "pod-a" },
  "room-3": { name: "Grace Li", age: 52, why: "Floor example", pod: "pod-b" },
}

export type Profile = {
  id: string
  name: string
  role: "nurse" | "patient_device"
  pod_id: string | null
  room: string | null
}

// Fallback when Supabase isn't configured. Mirrors the seed rows in supabase/schema.sql.
export const LOCAL_PROFILES: Profile[] = [
  { id: "maya", name: "Maya", role: "nurse", pod_id: "pod-a", room: null },
  { id: "jordan", name: "Jordan", role: "nurse", pod_id: "pod-a", room: null },
  { id: "sam", name: "Sam", role: "nurse", pod_id: "pod-b", room: null },
  ...Object.entries(PATIENTS).map(([room, p]): Profile => ({
    id: `bedside-${room}`,
    name: `Bedside ${room.replace("room-", "Room ")}`,
    role: "patient_device",
    pod_id: p.pod,
    room,
  })),
]

export const patientActor = (room: string) => `patient:${room}`
export const podActor = (pod: string) => `pod:${pod}`
export const nurseAgent = (pod: string) => `nurse-${pod}`
export const twinAgent = (room: string) => `twin-${room}`

export type FrontendEvent = { kind: string; id?: string; [key: string]: unknown }

export function isRoom(room: unknown): room is string {
  return typeof room === "string" && room in PATIENTS
}

export function isPod(pod: unknown): pod is string {
  return typeof pod === "string" && pod in POD_ROOMS
}
