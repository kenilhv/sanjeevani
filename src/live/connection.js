// One WebSocket to the Sanjeevani event stream (contracts.md §4), reconnecting on its own.
// On every (re)connect the caller gets a fresh /state snapshot and the recent message history,
// so a reload or a backend restart lands on exactly the state the actors hold.
import { API, EVENTS_URL } from './config.js';

export async function getJSON(path) {
  const res = await fetch(API + path);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

export async function postJSON(path, data = {}) {
  const res = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

export function connect({ onEvent, onSnapshot, onStatus }) {
  let ws, retry = 0, everOpen = false, closed = false;

  function open() {
    onStatus?.(everOpen ? 'reconnecting' : 'connecting');
    ws = new WebSocket(EVENTS_URL);
    ws.onopen = async () => {
      const reconnect = everOpen;
      everOpen = true;
      retry = 0;
      onStatus?.('live');
      const [state, history] = await Promise.all([getJSON('/state').catch(() => null), getJSON('/history').catch(() => null)]);
      onSnapshot?.({ state, history: history?.events ?? [], reconnect });
    };
    ws.onmessage = (m) => {
      try { onEvent(JSON.parse(m.data)); } catch (e) { console.warn('[live] bad event', e); }
    };
    ws.onclose = () => {
      if (closed) return;
      onStatus?.(everOpen ? 'reconnecting' : 'offline');
      setTimeout(open, Math.min(4000, 500 * 2 ** retry++));
    };
    ws.onerror = () => ws.close();
  }
  open();
  return { close() { closed = true; ws?.close(); } };
}
