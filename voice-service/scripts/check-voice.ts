// One-shot check that the OpenAI key and both model names work: text -> speech -> text.
// Run once the key is in .env:  npm run check-voice

import { readFile } from "node:fs/promises"
import { config } from "../src/config.ts"
import { AUDIO_DIR, speak, transcribe } from "../src/voice.ts"

if (!config.openaiKey) {
  console.error("Set OPENAI_API_KEY in .env first.")
  process.exit(1)
}

const phrase = "Room 6, gave zolpidem for sleep."
console.log(`TTS  model=${config.ttsModel} voice=${config.agentVoice}`)
let started = Date.now()
const url = await speak(phrase, "agent")
console.log(`  ✅ ${url} (${Date.now() - started}ms)`)

console.log(`STT  model=${config.sttModel}`)
const mp3 = await readFile(new URL(url!.split("/audio/")[1]!, AUDIO_DIR))
started = Date.now()
const heard = await transcribe(mp3, "audio/mpeg")
console.log(`  ✅ "${heard}" (${Date.now() - started}ms)`)
console.log(/zolpidem/i.test(heard) ? "Round trip OK." : "⚠️ Round trip worked but 'zolpidem' was misheard. Check the STT prompt/model.")
