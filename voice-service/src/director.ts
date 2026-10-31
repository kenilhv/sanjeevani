import { spawn } from "node:child_process"
import { call, emit } from "./actors/index.ts"
import { config } from "./config.ts"
import { clearHistory } from "./events.ts"
import { UNIT, podActor, patientActor, nurseAgent } from "./contracts.ts"
import { HttpError, speak } from "./voice.ts"
import { getProfile, signInWithPassword } from "./supabase.ts"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ---- Shift sign-in / sign-out (Supabase identity -> Pod Actor) ----

export async function signIn(nurseId: string, password?: string) {
  const profile = await getProfile(nurseId)
  if (!profile) throw new HttpError(404, `Unknown account "${nurseId}"`)
  const session = await signInWithPassword(profile.id, password ?? config.demoPassword)
  if (profile.role === "nurse" && profile.pod_id) {
    await call(UNIT, "assign", { podId: profile.pod_id, nurseId: profile.id })
    await call(podActor(profile.pod_id), "signIn", { nurseId: profile.id })
  }
  return { profile, accessToken: session?.accessToken ?? null }
}

export async function signOut(nurseId: string) {
  const profile = await getProfile(nurseId)
  if (!profile) throw new HttpError(404, `Unknown account "${nurseId}"`)
  if (profile.role === "nurse" && profile.pod_id) await call(podActor(profile.pod_id), "signOut", { nurseId: profile.id })
  return { profile }
}

// ---- The 7am briefing ----

function briefingText(result: unknown): string {
  if (typeof result === "string") return result
  const r = result as { text?: string; briefing?: string } | undefined
  return r?.text ?? r?.briefing ?? ""
}

/** Gets the briefing and its audio ready without playing it, so stage playback is instant. */
export async function prepareBriefing(podId = "pod-a", nurseId = "jordan") {
  const result = await call(podActor(podId), "brief", { nurseId })
  const text = briefingText(result)
  const sections = Array.isArray(result?.sections) ? result.sections : []
  const audioUrl = await speak(text, "agent").catch((err) => {
    console.error("[director] briefing TTS failed, will show text only:", err.message)
    return null
  })
  return { text, audioUrl, sections }
}

export async function playBriefing(podId = "pod-a", nurseId = "jordan", fromId?: string) {
  const briefing = await prepareBriefing(podId, nurseId)
  // The written report goes up on screen while the Nurse Agent speaks the briefing.
  await emit({ kind: "report", pod: podId, from: fromId ?? null, to: nurseId, spoken: briefing.text, sections: briefing.sections })
  await emit({ kind: "speech", who: nurseAgent(podId), text: briefing.text, audioUrl: briefing.audioUrl })
  return briefing
}

// ---- Director buttons (shresth.md section 3a) ----

const actions: Record<string, (body: Record<string, any>) => Promise<unknown>> = {
  async "start-night"() {
    await call(UNIT, "setClock", { simTime: "19:00", speed: 1 })
    await signIn("maya")
    await signIn("sam")
    return { simTime: "19:00", nurses: ["maya", "sam"] }
  },
  async "jump-2330"() {
    return call(UNIT, "setClock", { simTime: "23:30", speed: 1 })
  },
  // Story time runs at 600x so the Room 4 med_due alarm fires on its own at 03:30.
  async "ff-0330"() {
    return call(UNIT, "setClock", { simTime: "03:00", speed: 600 })
  },
  // Room 2's blood pressure drops on 3 checks, so the pods help each other.
  async "jump-0400"() {
    await call(UNIT, "setClock", { simTime: "04:00", speed: 1 })
    const readings: [string, number][] = [["03:00", 128], ["03:30", 112], ["04:00", 98]]
    for (const [simTime, value] of readings) {
      await call(patientActor("room-2"), "addVital", { type: "bp_systolic", value, simTime })
    }
    return { room: "room-2", bp: readings.map(([, v]) => v) }
  },
  // 06:45 handoff_prep -> 07:00 shift_change -> Maya out, Jordan in -> spoken briefing.
  async handoff() {
    await call(UNIT, "setClock", { simTime: "06:45", speed: 1 })
    await sleep(config.handoffPrepWaitMs)
    await call(UNIT, "setClock", { simTime: "07:00", speed: 1 })
    await signOut("maya")
    await signIn("jordan")
    return playBriefing("pod-a", "jordan", "maya")
  },
  async "prep-briefing"(body) {
    return prepareBriefing(body.podId, body.nurseId)
  },
  async "play-briefing"(body) {
    return playBriefing(body.podId, body.nurseId)
  },
  // Clock capsule on the floor: drag the slider (simTime), 1×/4×/16× (speed), pause (speed 0).
  async "set-clock"(body) {
    return call(UNIT, "setClock", {
      ...(typeof body.simTime === "string" ? { simTime: body.simTime } : {}),
      ...(body.speed !== undefined && body.speed !== null ? { speed: Number(body.speed) } : {}),
    })
  },
  async reset() {
    // Clear the night and reseed every patient (the Unit Actor's reset).
    clearHistory()
    return call(UNIT, "reset", {})
  },
  restart,
}

export async function runDirector(action: string, body: Record<string, any>) {
  const fn = actions[action]
  if (!fn) throw new HttpError(404, `Unknown director action "${action}". Try: ${Object.keys(actions).join(", ")}`)
  return fn(body)
}

// ---- The restart moment ----

async function restart() {
  if (!config.restartCmd) {
    throw new HttpError(501, "RESTART_CMD is not set in .env. Agree with Aditya on what gets killed (actor runtime or agent worker).")
  }
  const started = Date.now()
  // Screens dim on phase "down" and clear on "up", even though their own socket (to this service) never drops.
  await emit({ kind: "system", phase: "down", text: "Backend restarting…" })
  try {
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn(config.restartCmd!, { shell: true })
      let log = ""
      child.stdout.on("data", (d) => (log += d))
      child.stderr.on("data", (d) => (log += d))
      child.on("error", reject)
      child.on("exit", (code) => (code === 0 ? resolve(log) : reject(new HttpError(500, `RESTART_CMD exited ${code}: ${log.slice(-500)}`))))
    })
    // Wait until the actors answer again, then tell the floor.
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const state = await call(UNIT, "getState", {})
        await emit({ kind: "system", phase: "up", text: "Backend restarted. All state restored." })
        return { restartedInMs: Date.now() - started, state, output: output.slice(-500) }
      } catch {
        await sleep(500)
      }
    }
    throw new HttpError(504, "Backend did not come back within 30s after restart")
  } catch (err) {
    // Never leave the screens dimmed.
    await emit({ kind: "system", phase: "up", text: "Restart did not complete. Check the actor runtime." })
    throw err
  }
}
