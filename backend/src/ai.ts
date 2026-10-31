import Anthropic from "@anthropic-ai/sdk"

// Agent brains call Claude from inside the actors. Every caller has a rule-based fallback,
// so a slow or malformed reply never crashes the demo.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5"

let client: Anthropic | null = null
function getClient(): Anthropic | null {
    if (!process.env.ANTHROPIC_API_KEY) return null
    client ??= new Anthropic({ timeout: 15_000, maxRetries: 1 })
    return client
}

// Pulls the first JSON object or array out of the model's reply.
function extractJson(text: string): unknown {
    const start = text.search(/[[{]/)
    if (start < 0) return null
    const open = text[start]
    const close = open === "{" ? "}" : "]"
    const end = text.lastIndexOf(close)
    if (end <= start) return null
    try {
        return JSON.parse(text.slice(start, end + 1))
    } catch {
        return null
    }
}

async function complete(system: string, user: string, maxTokens: number): Promise<string | null> {
    const anthropic = getClient()
    if (!anthropic) return null
    try {
        const response = await anthropic.messages.create({
            model: MODEL,
            max_tokens: maxTokens,
            output_config: { effort: "low" },
            system,
            messages: [{ role: "user", content: user }]
        })
        if (response.stop_reason === "refusal") return null
        return response.content.map(b => (b.type === "text" ? b.text : "")).join("")
    } catch (error) {
        if (error instanceof Anthropic.RateLimitError) console.error("[ai] rate limited")
        else if (error instanceof Anthropic.APIError) console.error(`[ai] API error ${error.status}: ${error.message}`)
        else console.error("[ai] request failed:", error)
        return null
    }
}

export async function askJson<T>(system: string, user: string, maxTokens = 2000): Promise<T | null> {
    const text = await complete(system, user, maxTokens)
    return text === null ? null : (extractJson(text) as T | null)
}

export async function askText(system: string, user: string, maxTokens = 2000): Promise<string | null> {
    const text = await complete(system, user, maxTokens)
    return text?.trim() || null
}
