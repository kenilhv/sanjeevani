// Agent Relay (Relaycast) mirror. Every agent message is posted to the hosted Relay workspace
// (DM between agents, floor notices to #4-west) so the conversation is saved and searchable.
// Enabled when RELAY_API_KEY (workspace key, rk_live_...) is set.
// All calls go through one queue: the workspace returns 429 "workspace_busy" under concurrent writes.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import type { RelayMessage } from "../src/contracts.js"

const BASE = process.env.RELAY_BASE_URL || "https://cast.agentrelay.com/v1"
const WORKSPACE_KEY = process.env.RELAY_API_KEY || ""
const TOKENS_FILE = new URL("./.relay-tokens.json", import.meta.url).pathname
const CHANNEL = "4-west"
const SYSTEM_AGENT = "unit-4west"

export const relayEnabled = () => Boolean(WORKSPACE_KEY)

// Agent tokens are only returned at registration, so keep them on disk.
const tokens: Record<string, string> = existsSync(TOKENS_FILE) ? JSON.parse(readFileSync(TOKENS_FILE, "utf8")) : {}
let channelReady = false

let queue: Promise<unknown> = Promise.resolve()
function serial<T>(job: () => Promise<T>): Promise<T> {
    const next = queue.then(job, job)
    queue = next.catch(() => {})
    return next
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function call(path: string, token: string, body: unknown): Promise<{ status: number; data: any }> {
    for (let attempt = 0; ; attempt++) {
        const res = await fetch(`${BASE}${path}`, {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(20_000)
        })
        const data: any = await res.json().catch(() => ({}))
        if ((res.status === 429 || res.status >= 500) && attempt < 4) {
            const retryAfter = Number(res.headers.get("retry-after")) || 2 ** attempt
            await sleep(Math.min(retryAfter, 10) * 1000)
            continue
        }
        if (!res.ok && res.status !== 409) throw new Error(`${path} ${res.status} ${JSON.stringify(data?.error ?? data)}`)
        return { status: res.status, data: data?.data }
    }
}

async function tokenFor(name: string): Promise<string | null> {
    if (tokens[name]) return tokens[name]
    const { status, data } = await call("/agents", WORKSPACE_KEY, { name, type: name === SYSTEM_AGENT ? "system" : "agent" })
    if (status === 409 || !data?.token) {
        console.error(`[relay] ${name} already registered without a saved token; skipping its messages`)
        return null
    }
    tokens[name] = data.token
    writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2))
    return data.token
}

// Registers every agent once, one at a time, before any message is mirrored.
export function registerAgents(names: string[]): Promise<void> {
    return serial(async () => {
        for (const name of [SYSTEM_AGENT, ...names]) {
            try {
                await tokenFor(name)
            } catch (error) {
                console.error(`[relay] register ${name} failed:`, String(error))
            }
        }
        console.log(`[relay] agents ready: ${Object.keys(tokens).length}`)
    })
}

export function mirrorToRelay(msg: RelayMessage): Promise<void> {
    return serial(async () => {
        try {
            const token = await tokenFor(msg.from)
            if (!token) return
            const text = JSON.stringify(msg)
            if (msg.to.startsWith("#")) {
                if (!channelReady) {
                    await call("/channels", token, { name: CHANNEL, topic: "Floor 4 West notices" })
                    await call(`/channels/${CHANNEL}/join`, token, {})
                    channelReady = true
                }
                await call(`/channels/${CHANNEL}/messages`, token, { text })
            } else {
                if (!(await tokenFor(msg.to))) return // the recipient must exist before it can get a DM
                await call("/dm", token, { to: msg.to, text })
            }
        } catch (error) {
            console.error("[relay] mirror failed:", String(error))
        }
    })
}
