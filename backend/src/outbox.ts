import type { Outbox } from "./contracts.js"

// Actors never call each other and wait (that can freeze two single-request actors).
// They hand outgoing Relay messages and frontend events to the gateway, which answers
// immediately and delivers them afterwards.

const GATEWAY_URL = process.env.GATEWAY_URL || "http://127.0.0.1:8787"

export async function post(outbox: Outbox): Promise<void> {
    if (!outbox.messages?.length && !outbox.events?.length) return
    try {
        await fetch(`${GATEWAY_URL}/outbox`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(outbox),
            signal: AbortSignal.timeout(3000)
        })
    } catch (error) {
        console.error("[outbox] gateway unreachable:", error)
    }
}
