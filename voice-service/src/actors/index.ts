import { config } from "../config.ts"
import { UNIT, type FrontendEvent } from "../contracts.ts"
import { publish, withId } from "../events.ts"
import { mockBackend } from "./mock.ts"
import { terseBackend } from "./terse.ts"

// One call shape for every actor method in contracts.md section 2:
//   call("pod:pod-a", "voiceNote", { transcript, nurseId, simTime })
//   call("patient:room-8", "patientRequest", { text, simTime })
//   call("unit:floor-4west", "setClock", { simTime, speed })
export interface Backend {
  name: string
  call(actorId: string, method: string, input?: Record<string, unknown>): Promise<any>
}

export const backend: Backend = config.backend === "terse" ? terseBackend : mockBackend

export async function call(actorId: string, method: string, input: Record<string, unknown> = {}) {
  const started = Date.now()
  try {
    return await backend.call(actorId, method, input)
  } catch (err) {
    console.error(`[${backend.name}] ${actorId}.${method} failed after ${Date.now() - started}ms:`, (err as Error).message)
    throw err
  }
}

/**
 * Send an event to the frontend stream. Published locally right away (our /events socket
 * and the audit log), and pushed through unit.emit so Kenil gets it on the Unit Actor
 * WebSocket. The id lets /events/ingest drop the echo if Aditya forwards it back.
 */
export async function emit(event: FrontendEvent) {
  const stamped = withId(event)
  publish(stamped)
  if (backend.name === "built-in") return
  try {
    await backend.call(UNIT, "emit", { event: stamped })
  } catch (err) {
    console.error("[emit] unit.emit failed; event only reached local subscribers:", (err as Error).message)
  }
}
