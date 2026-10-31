import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { config, hasSupabase } from "./config.ts"
import { LOCAL_PROFILES, type FrontendEvent, type Profile } from "./contracts.ts"

// Supabase is supporting only: identity, audio evidence, audit log.
// Live patient state never lives here. Nothing in a request path waits on a write.

let admin: SupabaseClient | undefined

function db() {
  if (!hasSupabase()) return undefined
  admin ??= createClient(config.supabaseUrl!, config.supabaseServiceKey!, { auth: { persistSession: false } })
  return admin
}

export const demoEmail = (profileId: string) => `${profileId}@sanjeevni.demo`

export async function getProfile(id: string): Promise<Profile | undefined> {
  const client = db()
  if (client) {
    const { data, error } = await client.from("profiles").select("id,name,role,pod_id,room").eq("id", id).maybeSingle()
    if (!error && data) return data as Profile
    if (error) console.error("[supabase] profile lookup failed, using local seed:", error.message)
  }
  return LOCAL_PROFILES.find((p) => p.id === id)
}

/** Real Supabase Auth sign-in for a seeded demo account. Returns undefined when Supabase is off. */
export async function signInWithPassword(profileId: string, password: string) {
  if (!hasSupabase()) return undefined
  // Fresh client per sign-in so one nurse's session never sticks to the shared admin client.
  const client = createClient(config.supabaseUrl!, config.supabaseServiceKey!, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({ email: demoEmail(profileId), password })
  if (error) throw Object.assign(new Error(`Supabase sign-in failed: ${error.message}`), { status: 401 })
  return { accessToken: data.session?.access_token, userId: data.user?.id }
}

/** Upload to Storage and return the public URL, or undefined if Supabase is off or the upload fails. */
export async function uploadAudio(path: string, audio: Buffer, contentType: string) {
  const client = db()
  if (!client) return undefined
  const { error } = await client.storage.from(config.supabaseBucket).upload(path, audio, { contentType, upsert: true })
  if (error) {
    console.error("[supabase] audio upload failed:", error.message)
    return undefined
  }
  return client.storage.from(config.supabaseBucket).getPublicUrl(path).data.publicUrl
}

const EXT: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg" }

export function audioExt(contentType: string) {
  return EXT[contentType] ?? "webm"
}

/** Evidence trail: the original clip plus its transcript, linked to the actor it went to. Fire and forget. */
export function saveVoiceClip(clip: { actorId: string; who: string; transcript: string; audio?: Buffer; contentType?: string }) {
  const client = db()
  if (!client) return
  void (async () => {
    let audioUrl: string | undefined
    if (clip.audio?.length) {
      const path = `clips/${clip.actorId.replace(":", "/")}/${Date.now()}-${clip.who}.${audioExt(clip.contentType ?? "")}`
      audioUrl = await uploadAudio(path, clip.audio, clip.contentType ?? "audio/webm")
    }
    const { error } = await client.from("voice_clips").insert({
      actor_id: clip.actorId,
      who: clip.who,
      audio_url: audioUrl ?? null,
      transcript: clip.transcript,
    })
    if (error) console.error("[supabase] voice_clips insert failed:", error.message)
  })().catch((err) => console.error("[supabase] saveVoiceClip crashed:", err))
}

/** The last agent messages from audit_log as frontend events, oldest first. Undefined when Supabase is off. */
export async function auditHistory(limit = 80): Promise<FrontendEvent[] | undefined> {
  const client = db()
  if (!client) return undefined
  const { data, error } = await client.from("audit_log").select("id,sim_time,from,to,type,text").order("id", { ascending: false }).limit(limit)
  if (error) {
    console.error("[supabase] audit_log read failed:", error.message)
    return undefined
  }
  return data.reverse().map((r) => ({ kind: "agent.message", id: `audit-${r.id}`, simTime: r.sim_time, from: r.from, to: r.to, type: r.type, text: r.text }))
}

/** Copies every agent.message into audit_log: who was told what, and when. Fire and forget. */
export function logAudit(event: FrontendEvent) {
  const client = db()
  if (!client || event.kind !== "agent.message") return
  client
    .from("audit_log")
    .insert({
      sim_time: event.simTime ?? null,
      from: event.from,
      to: event.to,
      type: event.type,
      text: event.text,
    })
    .then(({ error }) => error && console.error("[supabase] audit_log insert failed:", error.message))
}
