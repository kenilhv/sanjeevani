// Push-to-talk for Sanjeevni screens. Hold the button to record; release to send.
//
//   import { attachPushToTalk, sendTyped } from "http://localhost:8787/ptt.js"
//   attachPushToTalk(button, {
//     url: "http://localhost:8787/voice/nurse?podId=pod-a&nurseId=maya",
//     onState: (s) => {},          // "idle" | "recording" | "sending"
//     onResult: (json) => {},      // { transcript, ... } from the endpoint
//     onError: (err) => {},
//   })
//   sendTyped("http://localhost:8787/voice/nurse?podId=pod-a&nurseId=maya", "Room 6, gave zolpidem for sleep.")

const MIN_MS = 350
let streamPromise

function micStream() {
  // Ask for the mic once and reuse it, so later presses start recording instantly.
  streamPromise ??= navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
  return streamPromise
}

function pickMimeType() {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]
  return options.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) ?? ""
}

async function postJson(url, init) {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
  return body
}

export function sendTyped(url, text) {
  return postJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
}

export function attachPushToTalk(button, { url, onState = () => {}, onResult = () => {}, onError = console.error }) {
  let recorder
  let chunks = []
  let startedAt = 0
  let holding = false

  const getUrl = () => (typeof url === "function" ? url() : url)

  async function start(event) {
    event.preventDefault()
    if (holding) return
    holding = true
    try {
      const stream = await micStream()
      if (!holding) return // released before the mic opened
      const mimeType = pickMimeType()
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunks = []
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      recorder.onstop = finish
      recorder.start()
      startedAt = performance.now()
      onState("recording")
    } catch (err) {
      holding = false
      onError(new Error(`Microphone unavailable: ${err.message}`))
    }
  }

  function stop() {
    if (!holding) return
    holding = false
    if (recorder?.state === "recording") recorder.stop()
  }

  async function finish() {
    const type = (recorder.mimeType || "audio/webm").split(";")[0]
    const blob = new Blob(chunks, { type })
    if (performance.now() - startedAt < MIN_MS || blob.size < 1000) return onState("idle")
    onState("sending")
    try {
      onResult(await postJson(getUrl(), { method: "POST", headers: { "Content-Type": type }, body: blob }))
    } catch (err) {
      onError(err)
    } finally {
      onState("idle")
    }
  }

  button.addEventListener("pointerdown", start)
  button.addEventListener("pointerup", stop)
  button.addEventListener("pointerleave", stop)
  button.addEventListener("pointercancel", stop)
  button.addEventListener("contextmenu", (e) => e.preventDefault())
  // Space bar works as push-to-talk while the button has focus.
  button.addEventListener("keydown", (e) => e.code === "Space" && !e.repeat && start(e))
  button.addEventListener("keyup", (e) => e.code === "Space" && stop())
}
