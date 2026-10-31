const env = process.env
const port = Number(env.PORT ?? 8787)

export const config = {
  port,
  publicUrl: (env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/$/, ""),

  // "built-in" runs the Patient Twins and Nurse Agents inside this service (Claude when ANTHROPIC_API_KEY is set).
  // "terse" calls the real actors through the generated client in ./generated.
  backend: (env.BACKEND === "terse" ? "terse" : "built-in") as "built-in" | "terse",

  openaiKey: env.OPENAI_API_KEY,
  sttModel: env.OPENAI_STT_MODEL ?? "gpt-4o-mini-transcribe",
  ttsModel: env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
  // Nurse Agent speaks the briefing and answers; the Twin speaks at the bedside.
  agentVoice: env.TTS_VOICE_AGENT ?? "coral",
  twinVoice: env.TTS_VOICE_TWIN ?? "sage",

  supabaseUrl: env.SUPABASE_URL,
  supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseBucket: env.SUPABASE_BUCKET ?? "voice",
  demoPassword: env.DEMO_PASSWORD ?? "sanjeevni-demo",

  // Shell command the Director "Restart backend" button runs. Agree on it with Aditya.
  restartCmd: env.RESTART_CMD,
  // Optional shared secret for POST /events/ingest.
  ingestToken: env.INGEST_TOKEN,
  // How long the 06:45 handoff_prep alarm gets before we jump to 07:00.
  handoffPrepWaitMs: Number(env.HANDOFF_PREP_WAIT_MS ?? 4000),
}

export const hasOpenAI = () => Boolean(config.openaiKey)
export const hasSupabase = () => Boolean(config.supabaseUrl && config.supabaseServiceKey)
