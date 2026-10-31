import type { Backend } from "./index.ts"

// Live adapter for Aditya's Terse Durable Actors.
//
// Handoff steps (needs Bun 1.4.2+):
//   1. Aditya runs his actors from the actor project: `bunx durable-actors dev` (serves http://127.0.0.1:7100).
//   2. From the actor project, with dev running:
//        bunx durable-actors generate --out-dir <path to this folder>/generated
//      That writes ./generated/index.js plus a standalone runtime/ (fetch + WebSocket only, so Node loads it).
//   3. Make CLASS_FOR match the class names Aditya exports from his src/actors.ts.
//   4. Set BACKEND=terse in .env. If the runtime isn't on this machine's 127.0.0.1:7100, also set
//      DURABLE_ACTORS_CONTROL_PLANE_URL (origin only, no path), DURABLE_ACTORS_PROJECT_ID and DURABLE_ACTORS_SECRET.
//
// The generated client is used as `actors.<Class>.get(<key>).<method>(input)`.
// Every contract method takes a single object argument, so `input` passes through as-is.
// Actor keys may use only letters, digits, '.', '-', '_' (room-2, pod-a, floor-4west are fine).

const CLASS_FOR: Record<string, string> = {
  patient: "Patient",
  pod: "Pod",
  unit: "Unit",
}

let actors: Record<string, { get(key: string): Record<string, unknown> }> | undefined

async function loadClient() {
  if (actors) return actors
  const candidates = ["../../generated/index.ts", "../../generated/index.js"]
  for (const path of candidates) {
    try {
      actors = (await import(path)).actors
      if (actors) return actors
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ERR_MODULE_NOT_FOUND") throw err
    }
  }
  throw new Error("No Terse client in ./generated. From the actor project run `bunx durable-actors generate --out-dir <this folder>/generated` (see src/actors/terse.ts).")
}

export const terseBackend: Backend = {
  name: "terse",
  async call(actorId, method, input = {}) {
    const client = await loadClient()
    const sep = actorId.indexOf(":")
    const kind = actorId.slice(0, sep)
    const key = actorId.slice(sep + 1)
    const actorClass = client[CLASS_FOR[kind] ?? ""]
    if (!actorClass) throw new Error(`No generated actor class for "${kind}" (expected ${CLASS_FOR[kind]})`)
    const handle = actorClass.get(key)
    const fn = handle[method]
    if (typeof fn !== "function") throw new Error(`${CLASS_FOR[kind]}.${method} is not exposed by the generated client`)
    return fn.call(handle, input)
  },
}
