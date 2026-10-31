import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { config } from "./config.ts"
import { audioExt, uploadAudio } from "./supabase.ts"

export const AUDIO_DIR = new URL("../public/audio/", import.meta.url)

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Biases transcription toward the words the demo depends on.
const STT_PROMPT =
  "Hospital nurse voice note. Room 2, Room 3, Room 4, Room 6, Room 8. Zolpidem, oxycodone, potassium, milligrams, " +
  "blood pressure, bed alarm, glucose, read-back. Daniel Okafor, Linda Park, Walter Hughes, Grace Lee, Grace Li, Maya, Jordan, Sam."

const TTS_STYLE = {
  agent: "Warm, calm and clear, like an experienced charge nurse giving a morning handoff. Unhurried, never alarmed.",
  twin: "Gentle and reassuring, speaking to a patient in a hospital bed at night. Soft and slow.",
}

function requireKey() {
  if (!config.openaiKey) throw new HttpError(503, "OPENAI_API_KEY is not set. Use the typed fallback (send JSON { text }).")
  return config.openaiKey
}

export async function transcribe(audio: Buffer, contentType: string): Promise<string> {
  const key = requireKey()
  if (audio.length < 1000) throw new HttpError(400, "Recording too short. Hold the button while you talk.")
  const form = new FormData()
  form.append("file", new Blob([audio], { type: contentType }), `clip.${audioExt(contentType)}`)
  form.append("model", config.sttModel)
  form.append("language", "en")
  form.append("prompt", STT_PROMPT)
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  if (!res.ok) throw new HttpError(502, `Speech to text failed (${res.status}): ${await res.text()}`)
  const text = String((await res.json()).text ?? "").trim()
  if (!text) throw new HttpError(422, "Didn't catch that. Try again closer to the mic.")
  return text
}

const inflight = new Map<string, Promise<string | null>>()

/**
 * Text to speech. Returns a URL served by this service (instant playback), or null without an
 * OpenAI key so screens can fall back to showing text. Same text + voice is generated once and
 * cached on disk, which is how the 7am briefing is pre-generated.
 */
export function speak(text: string, voice: "agent" | "twin" = "agent"): Promise<string | null> {
  if (!config.openaiKey || !text.trim()) return Promise.resolve(null)
  const voiceName = voice === "agent" ? config.agentVoice : config.twinVoice
  const hash = createHash("sha1").update(`${config.ttsModel}|${voiceName}|${text}`).digest("hex").slice(0, 16)
  const file = `${hash}.mp3`
  const url = `${config.publicUrl}/audio/${file}`
  if (existsSync(new URL(file, AUDIO_DIR))) return Promise.resolve(url)
  if (!inflight.has(hash)) {
    const job = synthesize(text, voiceName, TTS_STYLE[voice])
      .then(async (mp3) => {
        await mkdir(AUDIO_DIR, { recursive: true })
        await writeFile(new URL(file, AUDIO_DIR), mp3)
        void uploadAudio(`tts/${file}`, mp3, "audio/mpeg")
        return url
      })
      .finally(() => inflight.delete(hash))
    inflight.set(hash, job)
  }
  return inflight.get(hash)!
}

async function synthesize(text: string, voice: string, instructions: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ttsModel,
      voice,
      input: text,
      response_format: "mp3",
      // Only the gpt-4o TTS models accept speaking instructions.
      ...(config.ttsModel.startsWith("gpt-4o") ? { instructions } : {}),
    }),
  })
  if (!res.ok) throw new HttpError(502, `Text to speech failed (${res.status}): ${await res.text()}`)
  return Buffer.from(await res.arrayBuffer())
}
