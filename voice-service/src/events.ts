import { randomUUID } from "node:crypto"
import type { FrontendEvent } from "./contracts.ts"

// Local event hub. Everything that passes through this service lands here:
// events we emit (transcript, speech, system), events the mock backend emits, and events
// Aditya's side forwards to POST /events/ingest. Subscribers: the /events WebSocket and the audit log.

type Listener = (event: FrontendEvent) => void

const listeners = new Set<Listener>()
const recentIds: string[] = []
const seen = new Set<string>()
let lastClock: FrontendEvent = { kind: "clock", simTime: "19:00", speed: 1 }

// The story so far, for screens that load or reconnect mid-night. Supabase audit_log is the durable copy.
const HISTORY_KINDS = new Set(["agent.message", "transcript", "speech", "nurse.change", "handoff.progress", "system"])
const history: FrontendEvent[] = []

export function recentHistory(limit = 80): FrontendEvent[] {
  return history.slice(-limit)
}

export function clearHistory() {
  history.length = 0
}

function remember(id: string) {
  seen.add(id)
  recentIds.push(id)
  if (recentIds.length > 500) seen.delete(recentIds.shift()!)
}

/** Publish to local subscribers. Returns false if this event id was already published (echo from ingest). */
export function publish(event: FrontendEvent): boolean {
  if (event.id) {
    if (seen.has(event.id)) return false
    remember(event.id)
  }
  if (event.kind === "clock") lastClock = event
  if (HISTORY_KINDS.has(event.kind)) {
    history.push(event)
    if (history.length > 300) history.shift()
  }
  for (const listener of listeners) {
    try {
      listener(event)
    } catch (err) {
      console.error("[events] listener failed", err)
    }
  }
  return true
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function withId(event: FrontendEvent): FrontendEvent {
  return event.id ? event : { ...event, id: randomUUID() }
}

export function currentSimTime(): string {
  return String(lastClock.simTime ?? "19:00")
}

export function lastClockEvent(): FrontendEvent {
  return lastClock
}
