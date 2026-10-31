// Voice in the browser: push-to-talk and the agents' spoken replies.
// Two ways to hear: if the voice service has speech-to-text (an OpenAI key), the raw clip is sent and kept as
// evidence in Supabase. Otherwise Chrome's built-in speech recognition transcribes while the button is held and
// the text goes to the same endpoint. Replies play the service's audio when there is some, else the browser speaks.
import { API } from './config.js';

const MIN_MS = 350;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const voice = { serverStt: false };
let micPromise;

/** Called with the voice service's /health once it answers. */
export function setServerVoice(health) { voice.serverStt = !!health?.openai; }
export const browserCanListen = () => !!SR;

function mic() {
  micPromise ??= navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  return micPromise;
}

function mimeType() {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return options.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) ?? '';
}

async function post(path, body, type) {
  const res = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': type }, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}
export const sendAudio = (path, blob) => post(path, blob, (blob.type || 'audio/webm').split(';')[0]);
const sendText = (path, text) => post(path, JSON.stringify({ text }), 'application/json');

// Chrome's recogniser, for as long as the button is held. Resolves with everything it heard.
function listen(onInterim) {
  const r = new SR();
  r.lang = 'en-US';
  r.continuous = true;
  r.interimResults = true;
  let heard = '', interim = '';
  r.onresult = (e) => {
    interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) heard += `${t} `; else interim += t;
    }
    onInterim?.(`${heard}${interim}`.trim());
  };
  const done = new Promise((resolve, reject) => {
    r.onend = () => resolve(`${heard}${interim}`.trim());
    r.onerror = (e) => (e.error === 'no-speech' || e.error === 'aborted' ? resolve(`${heard}${interim}`.trim()) : reject(new Error(`Speech recognition: ${e.error}`)));
  });
  r.start();
  return { stop: () => r.stop(), done };
}

/** Hold-to-talk on any button. `path` may be a function so it can follow the nurse on shift. */
export function pushToTalk(button, { path, onState = () => {}, onResult = () => {}, onError = console.error, onInterim }) {
  let rec, chunks = [], t0 = 0, holding = false, session = null;
  const target = () => (typeof path === 'function' ? path() : path);
  const start = async (e) => {
    e.preventDefault();
    if (holding) return;
    holding = true;
    try {
      await mic(); // ask for the microphone either way, so the permission prompt comes up on the first press
      if (!holding) return;
      t0 = performance.now();
      if (!voice.serverStt && SR) {
        session = listen(onInterim);
      } else {
        const type = mimeType();
        rec = new MediaRecorder(await mic(), type ? { mimeType: type } : undefined);
        chunks = [];
        rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
        rec.onstop = finishAudio;
        rec.start();
      }
      onState('recording');
    } catch (err) {
      holding = false;
      onState('idle');
      onError(new Error(window.isSecureContext ? `Microphone unavailable: ${err.message}` : 'The microphone needs https:// or localhost'));
    }
  };
  const stop = (e) => {
    // A mouse press leaves focus on the button; drop it so a later Space (pause) can't start a recording.
    if (e?.type?.startsWith('pointer')) button.blur();
    if (!holding) return;
    holding = false;
    if (session) { const s = session; session = null; s.stop(); finishText(s); }
    else if (rec?.state === 'recording') rec.stop();
  };
  async function finishText(s) {
    onState('sending');
    try {
      const text = await s.done;
      if (!text) throw new Error('Didn’t catch that. Hold the button while you talk.');
      onResult(await sendText(target(), text));
    } catch (err) { onError(err); } finally { onState('idle'); }
  }
  async function finishAudio() {
    const blob = new Blob(chunks, { type: (rec.mimeType || 'audio/webm').split(';')[0] });
    if (performance.now() - t0 < MIN_MS || blob.size < 1000) return onState('idle');
    onState('sending');
    try { onResult(await sendAudio(target(), blob)); } catch (err) { onError(err); } finally { onState('idle'); }
  }
  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointerleave', stop);
  button.addEventListener('pointercancel', stop);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
  button.addEventListener('keydown', (e) => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) start(e); });
  button.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'Enter') stop(); });
}

// Browser voices: the Nurse Agent and the Twins sound different. Best available voice first.
const VOICES = {
  agent: ['Ava (Premium)', 'Ava (Enhanced)', 'Samantha (Enhanced)', 'Google US English', 'Microsoft Aria Online (Natural) - English (United States)', 'Samantha', 'Ava'],
  twin: ['Zoe (Premium)', 'Allison (Enhanced)', 'Google UK English Female', 'Microsoft Sonia Online (Natural) - English (United Kingdom)', 'Karen', 'Moira', 'Serena'],
};
function pickVoice(kind) {
  const all = window.speechSynthesis?.getVoices?.() ?? [];
  for (const name of VOICES[kind] ?? VOICES.agent) { const v = all.find((x) => x.name === name); if (v) return v; }
  return all.find((x) => x.lang?.startsWith('en') && x.localService) ?? all.find((x) => x.lang?.startsWith('en')) ?? null;
}
window.speechSynthesis?.getVoices?.(); // voices load asynchronously; ask early

/** Plays agent speech one at a time: the service's audio clip if there is one, else the browser's voice. */
export function createSpeaker({ onBlocked } = {}) {
  const queue = [], recent = new Set();
  let playing = null, blocked = null;
  const next = () => {
    if (playing || !queue.length) return;
    const item = queue.shift();
    if (item.text) {
      const u = new SpeechSynthesisUtterance(item.text);
      const v = pickVoice(item.kind);
      if (v) u.voice = v;
      u.rate = item.kind === 'twin' ? 0.98 : 1.03;
      playing = u;
      u.onend = u.onerror = () => { playing = null; next(); };
      window.speechSynthesis.speak(u);
      return;
    }
    playing = new Audio(item.url);
    playing.onended = playing.onerror = () => { playing = null; next(); };
    playing.play().catch((err) => {
      playing = null;
      if (err.name !== 'NotAllowedError') return next();
      queue.unshift(item);
      if (!blocked) { blocked = true; onBlocked?.(); }
    });
  };
  addEventListener('pointerdown', () => { if (blocked) { blocked = false; next(); } }, true);
  return {
    /** Speak an agent's words: its audio clip when the service made one, otherwise the browser's voice. */
    speak(text, url, kind = 'agent') {
      const key = url || text;
      if (!key || recent.has(key)) return;
      recent.add(key);
      setTimeout(() => recent.delete(key), 8000);
      queue.push(url ? { url } : window.speechSynthesis ? { text, kind } : null);
      if (!queue.at(-1)) queue.pop();
      next();
    },
    play(url) { this.speak('', url); },
    get speaking() { return !!playing; },
  };
}
