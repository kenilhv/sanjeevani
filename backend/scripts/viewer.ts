// Debug viewer for the actor runtime (port 7100 is RPC-only, so it shows nothing in a browser).
// Usage: bun scripts/viewer.ts   -> http://localhost:3000
import { actors } from "../generated/index.js"

const ROOMS = ["room-2", "room-4", "room-6", "room-8", "room-3"]

const esc = (s: unknown) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

async function page(): Promise<string> {
    const states = await Promise.all(ROOMS.map(r => actors.Patient.get(r).getState()))
    const cards = states
        .map(s => {
            const notes = s.timeline.length
                ? s.timeline.map(n => `<li><b>${esc(n.simTime)}</b> [${esc(n.status)}] ${esc(n.by)}: ${esc(n.text)}</li>`).join("")
                : "<li><i>no notes</i></li>"
            const vitals = s.vitals.map(v => `${esc(v.type)}=${esc(v.value)} @${esc(v.simTime)}`).join(", ")
            return `<div class="card"><h2>${esc(s.room)} · ${esc(s.profile.name)}, ${esc(s.profile.age)}</h2>
<p>${esc(s.profile.reason)} · ${esc(s.podId)} · risks: ${esc(JSON.stringify(s.riskScores))}</p>
<p>allergies: ${esc(s.allergies.join(", ") || "none")} · vitals: ${vitals || "none"}</p>
<ul>${notes}</ul></div>`
        })
        .join("")
    return `<!doctype html><html><head><meta charset="utf-8"><title>Sanjeevni actors</title>
<style>body{font-family:system-ui;background:#0f172a;color:#e2e8f0;margin:24px}.card{background:#1e293b;border-radius:8px;padding:12px 16px;margin:12px 0}h2{margin:0 0 4px;font-size:18px}p{margin:4px 0;color:#94a3b8}input,select,button{padding:6px;margin-right:6px}</style>
</head><body><h1>Sanjeevni · Patient Actors (live from Terse runtime)</h1>
<form method="post" action="/note"><select name="room">${ROOMS.map(r => `<option>${r}</option>`).join("")}</select>
<input name="text" placeholder="note text" size="40" required><input name="simTime" value="23:30" size="5"><button>Add note</button></form>
${cards}</body></html>`
}

Bun.serve({
    port: 3000,
    async fetch(req) {
        const url = new URL(req.url)
        if (req.method === "POST" && url.pathname === "/note") {
            const form = await req.formData()
            await actors.Patient.get(String(form.get("room"))).addNote({
                text: String(form.get("text")),
                nurseId: "maya",
                simTime: String(form.get("simTime"))
            })
            return Response.redirect("/", 303)
        }
        try {
            return new Response(await page(), { headers: { "content-type": "text/html" } })
        } catch (e) {
            return new Response(`Actor runtime not reachable. Is dev.sh running in WSL?\n\n${e}`, { status: 502 })
        }
    }
})
console.log("Viewer: http://localhost:3000")
