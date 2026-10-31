import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

// The agents' judgment: the Patient Twin and the Nurse Agent, on Claude.
// Every call returns structured JSON (what the agent picked up, what it is doing, what it asked), so the screens
// can show the agent's reasoning, not just its conclusion. When Claude isn't configured or doesn't answer in
// time, callers fall back to the rule-based logic in actors/mock.ts, so the floor never stalls.

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5"
const TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS ?? 20000)

export const hasClaude = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)

let client: Anthropic | undefined
const getClient = () => (client ??= new Anthropic({ maxRetries: 1, timeout: TIMEOUT_MS }))

const GUARDRAILS =
  "Hard rules: never give, order or change medicines; never diagnose; agents remind, warn, draft and answer, and humans decide. " +
  "Everything a Twin logs is an AI draft until a nurse confirms it. Use only facts in the chart and timeline you are given; never invent results. " +
  "Write like an experienced charge nurse: short, specific, plain English, real units and times."

const TWIN =
  "You are the Patient Twin for ONE hospital inpatient. You know only this patient, deeply: chart, medicines, risks, every note tonight. " +
  "Your job is to protect your patient: log what you hear, check it against the whole history, and decide how loudly to tell the ward's Nurse Agent. " +
  GUARDRAILS

const NURSE_AGENT =
  "You are the Nurse Agent for a hospital ward. You serve whichever nurse is on shift and never clock out. " +
  "You rank what matters across rooms and ask a room's Patient Twin when you need details. Say \"ward\", never \"pod\". " +
  GUARDRAILS

async function think<T>(system: string, prompt: string, schema: z.ZodType<T>, label: string): Promise<T | null> {
  if (!hasClaude()) return null
  const started = Date.now()
  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system,
      output_config: { effort: "low", format: zodOutputFormat(schema) },
      messages: [{ role: "user", content: prompt }],
    })
    if (response.stop_reason === "refusal") {
      console.error(`[brain] ${label}: declined, using rules`)
      return null
    }
    console.log(`[brain] ${label} ${Date.now() - started}ms`)
    return response.parsed_output ?? null
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) console.error("[brain] Claude key rejected; using rules")
    else if (err instanceof Anthropic.RateLimitError) console.error("[brain] rate limited; using rules")
    else if (err instanceof Anthropic.APIError) console.error(`[brain] ${label}: API ${err.status} ${err.message}`)
    else console.error(`[brain] ${label}:`, (err as Error).message)
    return null
  }
}

const Picked = z.object({ label: z.string().describe("Short field name, e.g. Medication, Dose, Symptom, Time, Vital"), value: z.string() })
const Exchange = z.object({
  question: z.string().describe("A specific question the Nurse Agent asks this Twin to decide what to do"),
  answer: z.string().describe("The Twin's answer, grounded only in the chart and timeline"),
})
const Level = z.enum(["none", "fyi", "soon", "urgent"]).describe("urgent: could harm the patient soon; soon: needs attention this hour; fyi: information only")

export const NoteReview = z.object({
  picked: z.array(Picked).describe("Every concrete fact extracted from the nurse's words"),
  logAs: z.string().describe("The clean chart entry the Twin drafts"),
  actions: z.array(z.string()).describe("What the Twin is doing right now, 3 to 5 steps, present tense"),
  alertLevel: Level,
  alertText: z.string().describe("Under 22 words, the key reason. Empty when alertLevel is none"),
  resolvesOpenFlag: z.boolean().describe("True if this note addresses one of the patient's open flags"),
  ack: z.string().describe("The Twin's one-line confirmation to the Nurse Agent"),
  nurseAgentChat: z.array(Exchange).describe("1 or 2 exchanges; empty only for routine notes"),
})
export type NoteReview = z.infer<typeof NoteReview>

export const PatientReview = z.object({
  picked: z.array(Picked).describe("What the Twin understood from the patient: symptom, request, feeling, time"),
  actions: z.array(z.string()).describe("What the Twin is doing right now, 3 to 5 steps, present tense"),
  callNurse: z.boolean().describe("Should the nurse come to this patient now?"),
  urgency: Level,
  toNurseAgent: z.string().describe("The escalation message to the Nurse Agent, with the context only the Twin knows; under 35 words"),
  replyToPatient: z.string().describe("What the Twin says back to the patient: calm, kind, honest, under 20 words"),
  nurseAgentChat: z.array(Exchange).describe("1 or 2 exchanges when the nurse is being called; empty otherwise"),
})
export type PatientReview = z.infer<typeof PatientReview>

export const AskReview = z.object({
  room: z.string().describe("The room the question is about, like room-4, or 'ward' for the whole ward"),
  picked: z.array(Picked),
  actions: z.array(z.string()).describe("What the Nurse Agent is doing to answer, 2 to 4 steps"),
  nurseAgentChat: z.array(Exchange).describe("The Nurse Agent's questions to that room's Twin and its answers; empty for ward-wide questions"),
  answer: z.string().describe("The answer spoken to the nurse; under 45 words"),
})
export type AskReview = z.infer<typeof AskReview>

export const Briefing = z.object({
  spoken: z.string().describe("The spoken briefing for the incoming nurse: sickest first, then open flags, then what's due; 60 to 90 words, warm and clear"),
  sections: z.array(z.object({
    room: z.string(),
    patient: z.string(),
    status: z.enum(["stable", "watcher", "unstable"]),
    summary: z.string().describe("One line: who they are and why they're here"),
    overnight: z.array(z.string()).describe("What happened tonight, in time order, each item starting with the time, e.g. '23:30 Zolpidem 5 mg given'"),
    patientSaid: z.array(z.string()).describe("Only the patient's own words at the bedside (timeline entries whose 'by' starts with bedside-), each with the time and what was done about it. Never include nurse notes. Empty if the patient said nothing"),
    todo: z.array(z.string()),
    watchFor: z.string(),
  })),
})
export type Briefing = z.infer<typeof Briefing>

const fmt = (o: unknown) => JSON.stringify(o, null, 1)

export function reviewNurseNote(input: { chart: unknown; tonight: unknown; openFlags: string[]; nurse: string; note: string; simTime: string }) {
  return think(TWIN,
    `Time now: ${input.simTime}. Nurse ${input.nurse} just said this about your patient:\n"${input.note}"\n\n` +
    `Your patient's chart:\n${fmt(input.chart)}\n\nTonight so far:\n${fmt(input.tonight)}\n\nOpen flags: ${input.openFlags.join("; ") || "none"}\n\n` +
    "Review it as the Twin. Also write the Nurse Agent's genuine questions to you about this note (for example about history, the last dose, or vitals) and your answers.",
    NoteReview, "twin.note")
}

export function reviewPatientWords(input: { chart: unknown; tonight: unknown; openFlags: string[]; said: string; simTime: string; nurseOnShift: string }) {
  return think(TWIN,
    `Time now: ${input.simTime}. Your patient just said at the bedside:\n"${input.said}"\n\n` +
    `Your patient's chart:\n${fmt(input.chart)}\n\nTonight so far:\n${fmt(input.tonight)}\n\nOpen flags: ${input.openFlags.join("; ") || "none"}\n\n` +
    `Decide whether ${input.nurseOnShift} needs to come now. Comfort requests (water, blanket, TV) do not need the nurse now. ` +
    "Anything that could mean harm (new pain, breathing, shakiness, confusion, a fall) does, with the context only you know. " +
    "If the nurse is called, also write the Nurse Agent's genuine questions to you and your answers.",
    PatientReview, "twin.patient")
}

export function answerNurseQuestion(input: { question: string; nurse: string; pod: unknown; simTime: string }) {
  return think(NURSE_AGENT,
    `Time now: ${input.simTime}. ${input.nurse} asks: "${input.question}"\n\nThe ward (each room's chart and tonight's timeline, as its Twin knows it):\n${fmt(input.pod)}\n\n` +
    "If the question is about one patient, ask that room's Twin specific questions and answer from its replies.",
    AskReview, "nurse.ask")
}

export function writeBriefing(input: { from: string; to: string; pod: unknown; simTime: string }) {
  return think(NURSE_AGENT,
    `Time now: ${input.simTime}. ${input.from} is handing Ward A over to ${input.to}. Write the handover from everything below, ` +
    "including every note, everything patients said at the bedside, and every flag from tonight. Sickest patient first. Say \"ward\", never \"pod\".\n\n" + fmt(input.pod),
    Briefing, "nurse.brief")
}
