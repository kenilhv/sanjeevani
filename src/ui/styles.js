// All interface CSS. Injected as one <style> tag so the single-file build stays simple.
import { C } from '../style/palette.js';

export const CSS = /* css */ `
.hv {
  --ink: ${C.ink}; --ink2: rgba(44,47,56,.7); --ink3: rgba(44,47,56,.5); --ink4: rgba(44,47,56,.3);
  --glass: rgba(255,255,255,.66); --glass2: rgba(255,255,255,.86); --solid: #fbfaf8;
  --fill: rgba(44,47,56,.05); --fill2: rgba(44,47,56,.085); --hair: rgba(44,47,56,.08);
  --accent: #118d92; --accent-2: ${C.teal}; --accent-soft: rgba(47,196,196,.16); --on-ink: #fff; --button: ${C.ink};
  --ok: #1fa97c; --watch: #d9921a; --danger: ${C.coralDeep}; --info: #3a93d4;
  --ok-soft: rgba(47,191,143,.14); --watch-soft: rgba(245,180,58,.17); --danger-soft: rgba(239,90,99,.13); --info-soft: rgba(74,168,232,.14);
  --label: rgba(255,255,255,.9); --veil: 247,243,238;
  --edge: inset 0 0 0 .5px rgba(255,255,255,.6), inset 0 1px 0 rgba(255,255,255,.8);
  --shadow: var(--edge), 0 0 0 .5px rgba(44,47,70,.06), 0 1px 2px rgba(44,47,70,.05), 0 8px 20px rgba(58,66,98,.08), 0 26px 52px -8px rgba(58,66,98,.13);
  --shadow-up: var(--edge), 0 0 0 .5px rgba(44,47,70,.07), 0 2px 4px rgba(44,47,70,.06), 0 12px 26px rgba(58,66,98,.11), 0 32px 60px -8px rgba(58,66,98,.17);
  --spring: cubic-bezier(.2,.9,.2,1); --pop: cubic-bezier(.3,1.45,.45,1); --soft: cubic-bezier(.4,0,.15,1);
  --sans: 'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --serif: 'Instrument Serif', 'Iowan Old Style', Georgia, serif;
  --mono: 'JetBrains Mono Variable', ui-monospace, 'Cascadia Mono', Menlo, monospace;
  --m: 18px; --side: 340px; --rail: 256px; --top-h: 72px; --bottom-h: 56px;
  font-family: var(--sans); font-size: 13.5px; line-height: 1.42; letter-spacing: -.006em; color: var(--ink);
  font-synthesis: none; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;
  transition: color .9s ease; overflow: hidden; user-select: none; -webkit-user-select: none;
}
.hv[data-theme=night] {
  --ink: #eef1f8; --ink2: rgba(236,240,250,.74); --ink3: rgba(236,240,250,.52); --ink4: rgba(236,240,250,.3);
  --glass: rgba(20,27,50,.62); --glass2: rgba(24,32,58,.88); --solid: #182038;
  --fill: rgba(255,255,255,.07); --fill2: rgba(255,255,255,.12); --hair: rgba(255,255,255,.09);
  --accent: ${C.tealLight}; --accent-2: ${C.teal}; --accent-soft: rgba(127,224,220,.15); --on-ink: #18203a; --button: #eef1f8;
  --ok: #57dcae; --watch: #f7c766; --danger: #ff8f8a; --info: #86c7f4;
  --ok-soft: rgba(87,220,174,.14); --watch-soft: rgba(247,199,102,.14); --danger-soft: rgba(255,143,138,.15); --info-soft: rgba(134,199,244,.14);
  --label: rgba(24,32,58,.88); --veil: 16,22,42;
  --edge: inset 0 0 0 .5px rgba(255,255,255,.1), inset 0 1px 0 rgba(255,255,255,.13);
  --shadow: var(--edge), 0 0 0 .5px rgba(0,0,0,.3), 0 2px 4px rgba(4,8,22,.25), 0 10px 24px rgba(4,8,22,.28), 0 28px 56px -8px rgba(4,8,22,.42);
  --shadow-up: var(--edge), 0 0 0 .5px rgba(0,0,0,.34), 0 3px 6px rgba(4,8,22,.28), 0 14px 30px rgba(4,8,22,.34), 0 34px 64px -8px rgba(4,8,22,.5);
}
.hv *, .hv *::before, .hv *::after { box-sizing: border-box; }
:where(.hv) button { font: inherit; color: inherit; letter-spacing: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.hv :focus { outline: none; }
.hv :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.hv input:focus-visible { outline: none; }
:where(.hv) :where(h2, h3, p) { margin: 0; font: inherit; }
.hv-i { width: 1em; height: 1em; display: block; flex: none; }
.hv [hidden] { display: none !important; }
.hv ::-webkit-scrollbar { width: 0; height: 0; }
.hv-scroll { overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; -webkit-overflow-scrolling: touch; }

/* Material */
.hv-glass {
  pointer-events: auto; background-color: var(--glass); box-shadow: var(--shadow);
  -webkit-backdrop-filter: blur(22px) saturate(1.55); backdrop-filter: blur(22px) saturate(1.55);
  transition: background-color .9s ease, box-shadow .35s var(--soft), transform .55s var(--spring), opacity .4s ease;
}
.hv[data-glass=lite] .hv-glass { -webkit-backdrop-filter: none; backdrop-filter: none; background-color: var(--glass2); }

/* Entrance. Regions stay put; the panels inside them travel. */
.hv-enter { opacity: 0; transform: translateY(14px) scale(.975); }
.hv-enter.in { opacity: 1; transform: none; transition: opacity .75s ease var(--d, 0ms), transform .95s var(--spring) var(--d, 0ms), background-color .9s ease, box-shadow .35s var(--soft); }
.hv-enter.done { transition: background-color .9s ease, box-shadow .35s var(--soft), transform .4s var(--spring), opacity .4s ease; }

/* Pressable things share one feel: lift on hover, squash on press. */
.hv-press { transition: transform .32s var(--spring), background-color .2s ease, box-shadow .3s var(--soft), color .2s ease, opacity .2s ease; }
@media (hover: hover) { .hv-press:hover { transform: translateY(-1px); } }
.hv-press:active { transform: scale(.955); transition-duration: .08s; }

/* Top left: brand */
.hv-tl { position: absolute; left: var(--m); top: var(--m); }
.hv-brand { display: flex; align-items: center; gap: 12px; height: var(--top-h); padding: 0 22px 0 14px; border-radius: 24px; min-width: var(--rail); }
.hv-mark { width: 44px; height: 44px; border-radius: 15px; flex: none; display: grid; place-items: center; color: #fff;
  background: linear-gradient(155deg, #3ed0cc, #14989c 75%); box-shadow: inset 0 1px 0 rgba(255,255,255,.45), inset 0 -1px 0 rgba(0,70,75,.16), 0 3px 8px rgba(20,140,145,.3); }
.hv-mark svg { width: 25px; height: 25px; --mark-cross: #18a0a3; }
.hv-name { font-family: var(--serif); font-style: italic; font-size: 25px; line-height: 1.04; letter-spacing: -.012em; white-space: nowrap; }
.hv-status { position: relative; display: flex; align-items: center; gap: 7px; margin-top: 3px; font-size: 12.5px; color: var(--ink2); white-space: nowrap; height: 17px; }
.hv-live { position: relative; width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--c, var(--ok)); transition: background-color .6s ease; --c: var(--ok); }
.hv-live[data-s=watch] { --c: var(--watch); } .hv-live[data-s=danger] { --c: var(--danger); }
.hv-live::after { content: ''; position: absolute; inset: -1px; border-radius: 50%; background: var(--c); animation: hv-ping 2.6s var(--soft) infinite; }
@keyframes hv-ping { 0% { transform: scale(1); opacity: .55; } 70%, 100% { transform: scale(3.1); opacity: 0; } }
.hv-status-t { display: inline-block; transition: opacity .3s ease, transform .4s var(--spring); }
.hv-status-t.out { opacity: 0; transform: translateY(5px); }

/* Top centre: floor switch */
.hv-tc { position: absolute; left: 0; right: 0; top: var(--m); display: flex; justify-content: center; pointer-events: none; }
.hv-seg { position: relative; display: flex; padding: 4px; border-radius: 999px; }
.hv-seg-thumb { position: absolute; top: 4px; bottom: 4px; left: 0; width: 80px; border-radius: 999px; background: var(--glass2);
  box-shadow: var(--edge), 0 0 0 .5px rgba(44,47,70,.07), 0 2px 6px rgba(44,47,70,.14);
  transition: transform .55s var(--pop), width .45s var(--spring), background-color .9s ease; }
.hv-seg button { position: relative; height: 36px; min-width: 76px; padding: 0 17px; border-radius: 999px; font-weight: 540; font-size: 13.5px; color: var(--ink2); transition: color .25s ease, transform .3s var(--spring); }
.hv-seg button[aria-pressed=true] { color: var(--ink); }
.hv-seg button:active { transform: scale(.95); }

/* Top right: clock */
.hv-tr { position: absolute; right: var(--m); top: var(--m); width: var(--side); display: flex; flex-direction: column; gap: 10px; pointer-events: none; }
.hv-clock { height: var(--top-h); padding: 10px 14px 0 18px; border-radius: 24px; display: flex; flex-direction: column; justify-content: flex-start; gap: 4px; }
.hv-clock-top { display: flex; align-items: center; gap: 9px; height: 30px; }
.hv-time { font-family: var(--mono); font-size: 25px; font-weight: 480; letter-spacing: -.045em; font-variant-numeric: tabular-nums; line-height: 1; font-feature-settings: 'zero' 0; }
.hv-time i { font-style: normal; opacity: .9; margin: 0 -.03em; animation: hv-colon 2s steps(1) infinite; }
.hv[data-paused='1'] .hv-time i { animation: none; opacity: .45; }
@keyframes hv-colon { 50% { opacity: .35; } }
.hv-part { font-size: 12.5px; color: var(--ink2); }
.hv-speed { margin-left: auto; display: flex; align-items: center; gap: 1px; padding: 2px; border-radius: 12px; background: var(--fill); }
.hv-speed button { position: relative; min-width: 30px; height: 25px; padding: 0 5px; border-radius: 10px; font-family: var(--mono); font-size: 11.5px; font-weight: 540; letter-spacing: -.04em; color: var(--ink2); display: grid; place-items: center; transition: background-color .25s ease, color .2s ease, transform .3s var(--spring), box-shadow .25s ease; }
.hv-speed button .hv-i { font-size: 11px; }
.hv-speed button:active { transform: scale(.9); }
.hv-speed button[aria-pressed=true] { background: var(--glass2); color: var(--ink); box-shadow: 0 0 0 .5px rgba(44,47,70,.07), 0 1px 3px rgba(44,47,70,.14); }
.hv-scrub { display: flex; align-items: center; gap: 8px; height: 22px; cursor: ew-resize; touch-action: none; color: var(--ink3); }
.hv-scrub .hv-i { font-size: 14px; flex: none; }
.hv-scrub-track { position: relative; flex: 1; height: 6px; border-radius: 99px; box-shadow: inset 0 0 0 .5px rgba(44,47,70,.08), inset 0 1px 2px rgba(44,47,70,.14);
  background: linear-gradient(90deg, #f7c9a9 0%, #ffe2a4 9%, #cdeaf7 26%, #bde3f6 42%, #ffd591 55%, #f49d8a 62%, #7a6ea8 70%, #39406e 78%, #2c3358 90%, #4a4a84 100%); }
.hv-scrub-knob { position: absolute; top: 50%; left: 0; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 .5px rgba(44,47,70,.1), 0 2px 6px rgba(44,47,70,.26), inset 0 -1px 2px rgba(44,47,70,.08); will-change: transform; display: grid; place-items: center; transition: scale .3s var(--pop), box-shadow .3s ease; }
.hv-scrub-knob::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: ${C.stripe}; box-shadow: 0 0 6px rgba(240,192,74,.75); transition: background-color .6s ease, box-shadow .6s ease; }
.hv[data-theme=night] .hv-scrub-knob::after { background: #aab4dc; box-shadow: 0 0 6px rgba(170,180,220,.7); }
.hv-scrub:hover .hv-scrub-knob, .hv-scrub.drag .hv-scrub-knob { scale: 1.16; }

/* Left rail */
.hv-rail { position: absolute; left: var(--m); top: calc(var(--m) + var(--top-h) + 10px); bottom: calc(var(--m) + var(--bottom-h) + 10px); width: var(--rail); display: flex; flex-direction: column; justify-content: center; gap: 10px; pointer-events: none; }
.hv-card { position: relative; display: block; width: 100%; text-align: left; padding: 13px 16px 13px; border-radius: 22px; overflow: hidden; }
@media (hover: hover) { .hv-card:hover { box-shadow: var(--shadow-up); } }
.hv-card[aria-expanded=true] { box-shadow: var(--shadow-up), inset 0 0 0 1.5px var(--accent); }
.hv-card-top { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 540; color: var(--ink2); }
.hv-card-top .hv-i { font-size: 15px; color: var(--tint, var(--accent)); }
.hv-card-n { display: flex; align-items: baseline; gap: 6px; margin-top: 3px; }
.hv-card-n b { font-family: var(--serif); font-weight: 400; font-size: 44px; line-height: 1; letter-spacing: -.015em; font-variant-numeric: tabular-nums lining-nums; }
.hv-card-n small { font-size: 13px; color: var(--ink3); font-weight: 500; }
.hv-card-s { display: block; margin-top: 3px; font-size: 12.5px; line-height: 1.34; color: var(--ink2); min-height: 17px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.hv-spark { position: absolute; right: 14px; top: 30px; width: 86px; height: 34px; color: var(--tint, var(--accent)); overflow: visible; }
.hv-spark .a { fill: currentColor; opacity: .13; }
.hv-spark .l { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.hv-spark circle { fill: currentColor; }
.hv-card[data-state=watch] { --tint: var(--watch); } .hv-card[data-state=danger] { --tint: var(--danger); } .hv-card[data-state=ok] { --tint: var(--accent); }
.hv-card[data-k=attn][data-state=danger] { background-color: color-mix(in srgb, var(--glass) 88%, ${C.coral}); }

/* List flyout */
.hv-fly { position: absolute; left: calc(var(--m) + var(--rail) + 10px); top: calc(var(--m) + var(--top-h) + 10px); bottom: calc(var(--m) + var(--bottom-h) + 10px); width: 308px; display: flex; flex-direction: column; justify-content: center; pointer-events: none; }
.hv-fly-in { display: flex; flex-direction: column; max-height: 100%; border-radius: 24px; overflow: hidden; background-color: var(--glass2); transform-origin: left center; animation: hv-sprout .5s var(--spring); }
.hv-fly.out .hv-fly-in { opacity: 0; transform: translateX(-10px) scale(.97); }
@keyframes hv-sprout { from { opacity: 0; transform: translateX(-14px) scale(.96); } }
.hv-fly-h { display: flex; align-items: flex-start; gap: 8px; padding: 16px 12px 10px 18px; }
.hv-fly-h h3 { font-family: var(--serif); font-style: italic; font-size: 25px; line-height: 1.08; letter-spacing: -.01em; }
.hv-fly-h p { font-size: 12.5px; color: var(--ink2); margin-top: 2px; }
.hv-fly-h > div { flex: 1; min-width: 0; }
.hv-fly-b { padding: 2px 8px 10px; }
.hv-group { padding: 11px 10px 4px; font-size: 11.5px; font-weight: 580; color: var(--ink3); }
.hv-row { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 46px; text-align: left; padding: 6px 10px; border-radius: 14px; transition: background-color .2s ease, transform .3s var(--spring); }
.hv-row[role=button], button.hv-row { cursor: pointer; }
@media (hover: hover) { button.hv-row:hover { background: var(--fill); } }
button.hv-row:active { transform: scale(.98); }
.hv-row > span:nth-child(2), .hv-row-t { flex: 1; min-width: 0; }
.hv-row b { display: block; font-weight: 560; font-size: 13.5px; line-height: 1.26; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hv-row small { display: block; font-size: 12px; color: var(--ink2); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hv-row-r { flex: none; font-size: 12px; color: var(--ink3); font-variant-numeric: tabular-nums; }
.hv-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; background: var(--c, var(--ok)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c, var(--ok)) 16%, transparent); margin: 0 4px; }
.hv-dot[data-s=ok] { --c: var(--ok); } .hv-dot[data-s=watch] { --c: var(--watch); } .hv-dot[data-s=critical], .hv-dot[data-s=danger] { --c: var(--danger); } .hv-dot[data-s=info] { --c: var(--info); }
.hv-empty { padding: 18px 12px 22px; text-align: center; color: var(--ink2); }
.hv-empty em { display: block; font-family: var(--serif); font-size: 21px; color: var(--ink); margin-bottom: 2px; }
.hv-av { --t: ${C.steel}; width: 34px; height: 34px; flex: none; border-radius: 50%; display: inline-grid; place-items: center; font-size: 11.5px; font-weight: 620; letter-spacing: .01em; color: #27303c;
  background: radial-gradient(120% 120% at 30% 20%, color-mix(in srgb, var(--t) 62%, #fff), var(--t)); box-shadow: inset 0 0 0 .5px rgba(255,255,255,.5), 0 1px 2px rgba(44,47,70,.12); }
.hv-av.s { width: 28px; height: 28px; font-size: 10.5px; } .hv-av.l { width: 54px; height: 54px; font-size: 17px; }
.hv-x { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: var(--ink2); flex: none; font-size: 15px; background: var(--fill); }
@media (hover: hover) { .hv-x:hover { background: var(--fill2); color: var(--ink); } }

/* Inspector */
.hv-insp { position: absolute; right: var(--m); top: calc(var(--m) + var(--top-h) + 10px); bottom: calc(var(--m) + var(--bottom-h) + 10px); width: var(--side); display: flex; flex-direction: column; justify-content: flex-start; pointer-events: none; }
.hv-insp-in { position: relative; display: flex; flex-direction: column; max-height: 100%; border-radius: 26px; overflow: hidden; background-color: var(--glass2); opacity: 0; transform: translateX(34px) scale(.965); transform-origin: right center; visibility: hidden; transition: transform .62s var(--pop), opacity .3s ease, visibility 0s .4s, background-color .9s ease; }
.hv-insp.open .hv-insp-in { opacity: 1; transform: none; visibility: visible; pointer-events: auto; transition: transform .62s var(--pop), opacity .3s ease, visibility 0s, background-color .9s ease; }
.hv-grab { display: none; }
.hv-insp-h { display: flex; align-items: flex-start; gap: 10px; padding: 18px 14px 12px 20px; }
.hv-insp-h > div { flex: 1; min-width: 0; }
.hv-eyebrow { font-size: 12.5px; font-weight: 540; color: var(--ink2); }
.hv-insp-h h2 { font-family: var(--serif); font-style: italic; font-size: 34px; line-height: 1.06; letter-spacing: -.016em; margin-top: 1px; }
.hv-insp-b { padding: 0 20px 18px; }
.hv-insp-b.fade > * { animation: hv-rise .55s var(--spring) both; }
.hv-insp-b.fade > *:nth-child(2) { animation-delay: 45ms; } .hv-insp-b.fade > *:nth-child(3) { animation-delay: 90ms; } .hv-insp-b.fade > *:nth-child(4) { animation-delay: 135ms; } .hv-insp-b.fade > *:nth-child(5) { animation-delay: 180ms; }
@keyframes hv-rise { from { opacity: 0; transform: translateY(10px); } }
.hv-lede { color: var(--ink2); font-size: 14px; line-height: 1.42; }
.hv-sec { margin-top: 18px; }
.hv-sec > h3 { font-size: 12.5px; font-weight: 580; color: var(--ink2); margin-bottom: 6px; display: flex; justify-content: space-between; }
.hv-sec > h3 span { font-weight: 500; color: var(--ink3); }
.hv-sec .hv-row { padding-left: 0; padding-right: 0; min-height: 44px; border-radius: 0; }
.hv-sec button.hv-row { margin: 0 -8px; padding: 6px 8px; width: calc(100% + 16px); border-radius: 13px; }
.hv-occ { display: flex; align-items: center; gap: 16px; margin-top: 2px; padding: 14px 16px; border-radius: 20px; background: var(--fill); }
.hv-ringwrap { position: relative; width: 74px; height: 74px; flex: none; }
.hv-ring { transform: rotate(-90deg); width: 100%; height: 100%; display: block; }
.hv-ring circle { fill: none; stroke-width: 7; stroke-linecap: round; }
.hv-ring .bg { stroke: var(--fill2); }
.hv-ring .fg { stroke: var(--c, var(--accent)); transition: stroke-dashoffset .9s var(--spring), stroke .5s ease; }
.hv-ring-v { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--serif); font-size: 25px; letter-spacing: -.01em; padding-top: 1px; }
.hv-occ b { display: block; font-weight: 580; font-size: 14.5px; }
.hv-occ span.t { display: block; font-size: 12.5px; color: var(--ink2); margin-top: 1px; }
.hv-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.hv-ecg { position: relative; display: flex; align-items: flex-end; margin: 2px 0 0; height: 104px; padding: 12px 16px; border-radius: 20px; overflow: hidden; background: #17202f; color: #fff; }
.hv-ecg canvas { position: absolute; left: 0; top: 8px; width: 100%; height: 88px; display: block; }
.hv-ecg::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(90deg, #17202f 0, transparent 20%); }
.hv-ecg-hr { position: relative; z-index: 1; margin-left: auto; text-align: right; line-height: 1; align-self: center; }
.hv-ecg-hr b { display: block; font-family: var(--mono); font-size: 37px; font-weight: 440; letter-spacing: -.06em; font-variant-numeric: tabular-nums; color: var(--c, #fff); }
.hv-ecg-hr span { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; color: rgba(255,255,255,.66); margin-top: 3px; }
.hv-ecg-hr .hv-i { font-size: 12px; color: var(--c, #fff); fill: currentColor; animation: hv-beat var(--beat, 1s) ease-out infinite; }
@keyframes hv-beat { 0%, 100% { transform: scale(1); } 14% { transform: scale(1.32); } 34% { transform: scale(1); } }
.hv-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
.hv-tile { --c: var(--ok); --bg: var(--ok-soft); padding: 11px 13px 11px; border-radius: 18px; background: var(--bg); transition: background-color .6s ease; }
.hv-tile[data-s=watch] { --c: var(--watch); --bg: var(--watch-soft); } .hv-tile[data-s=danger] { --c: var(--danger); --bg: var(--danger-soft); }
.hv-tile > span { display: block; font-size: 12px; font-weight: 540; color: var(--ink2); }
.hv-tile b { display: inline-block; margin-top: 2px; font-family: var(--mono); font-size: 23px; font-weight: 460; letter-spacing: -.05em; line-height: 1.1; font-variant-numeric: tabular-nums; }
.hv-tile small { font-size: 12px; color: var(--ink2); margin-left: 3px; }
.hv-tile em { display: block; font-style: normal; font-size: 12px; color: var(--c); font-weight: 560; margin-top: 1px; transition: color .6s ease; }
.hv-bar { height: 10px; border-radius: 99px; background: var(--fill2); overflow: hidden; }
.hv-bar i { display: block; height: 100%; border-radius: 99px; background: var(--c, var(--ok)); transform-origin: left; transition: transform .9s var(--spring), background-color .5s ease; }
.hv-kv { display: grid; grid-template-columns: auto 1fr; gap: 3px 14px; }
.hv-pill { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 11px; border-radius: 99px; font-size: 12.5px; font-weight: 560; background: var(--bg, var(--fill)); color: var(--c, var(--ink)); }
.hv-pill[data-s=ok] { --c: var(--ok); --bg: var(--ok-soft); } .hv-pill[data-s=watch] { --c: var(--watch); --bg: var(--watch-soft); } .hv-pill[data-s=danger] { --c: var(--danger); --bg: var(--danger-soft); } .hv-pill[data-s=info] { --c: var(--info); --bg: var(--info-soft); }
.hv-person { display: flex; align-items: center; gap: 14px; }
.hv-step { display: flex; gap: 12px; padding: 7px 0; }
.hv-step > .hv-i { font-size: 18px; color: var(--accent); margin-top: 1px; }
.hv-step b { display: block; font-size: 12.5px; font-weight: 580; color: var(--ink2); }
.hv-step p { font-size: 15px; line-height: 1.34; }

/* Bottom row */
.hv-bottom { position: absolute; left: var(--m); right: var(--m); bottom: var(--m); display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: end; gap: 12px; pointer-events: none; }
.hv-ask { justify-self: start; display: flex; align-items: center; gap: 9px; height: var(--bottom-h); padding: 0 12px 0 18px; border-radius: 22px; font-weight: 540; font-size: 14px; white-space: nowrap; }
.hv-ask .hv-i { font-size: 18px; color: var(--accent); }
.hv-kbd { font-family: var(--mono); font-size: 11px; color: var(--ink3); background: var(--fill); border-radius: 8px; padding: 3px 7px; letter-spacing: -.02em; }
@media (hover: hover) { .hv-ask:hover { box-shadow: var(--shadow-up); } .hv-agents-chip:hover { box-shadow: var(--shadow-up); } }

.hv-dock { display: flex; align-items: center; height: var(--bottom-h); padding: 0 7px; gap: 0; border-radius: 26px; min-width: 0; max-width: 100%; }
.hv-dock-t { font-family: var(--serif); font-style: italic; font-size: 19px; padding: 0 7px 0 12px; white-space: nowrap; letter-spacing: -.005em; }
.hv-chip { position: relative; display: inline-flex; align-items: center; gap: 5px; height: 38px; padding: 0 11px 0 9px; border-radius: 19px; font-size: 13px; font-weight: 530; color: var(--ink2); white-space: nowrap; flex: none; }
.hv-chip .hv-i { font-size: 16px; }
@media (hover: hover) { .hv-chip:hover { background: var(--fill); color: var(--ink); } }
.hv-chip[aria-pressed=true] { background: var(--button); color: var(--on-ink); box-shadow: 0 2px 6px rgba(44,47,70,.22); }
.hv-sep { width: 1px; height: 24px; margin: 0 6px; background: var(--hair); flex: none; }
.hv-tool { position: relative; width: 34px; height: 38px; display: grid; place-items: center; border-radius: 13px; color: var(--ink2); font-size: 18px; flex: none; }
.hv-tool span { display: none; }
@media (hover: hover) { .hv-tool:hover { background: var(--fill); color: var(--ink); } }
.hv-tool[aria-pressed=true] { background: var(--accent-soft); color: var(--accent); }
.hv-hint { position: absolute; bottom: calc(100% + 13px); left: 50%; translate: -50% 0; padding: 7px 11px 8px; border-radius: 12px; background: var(--solid); box-shadow: var(--shadow); white-space: nowrap; font-size: 12.5px; font-weight: 500; color: var(--ink); opacity: 0; transform: translateY(5px) scale(.97); transition: opacity .18s ease, transform .3s var(--spring); pointer-events: none; }
.hv-hint small { display: block; font-size: 12px; font-weight: 450; color: var(--ink2); }
.hv-hint kbd { font-family: var(--mono); font-size: 11px; color: var(--ink3); margin-left: 6px; }
@media (hover: hover) { .hv-tool:hover .hv-hint { opacity: 1; transform: none; transition-delay: .28s; } }
.hv-legend { position: absolute; bottom: calc(100% + 10px); left: 50%; display: flex; align-items: center; gap: 9px; height: 34px; padding: 0 14px; border-radius: 99px; font-size: 12.5px; color: var(--ink2); translate: -50% 0; opacity: 0; transform: translateY(8px) scale(.97); pointer-events: none; }
.hv-legend i { width: 96px; height: 7px; border-radius: 99px; background: linear-gradient(90deg, ${C.teal}, ${C.watch} 50%, ${C.coral}); }
.hv-legend.on { opacity: 1; transform: none; }
.hv-dockwrap { position: relative; min-width: 0; display: flex; }
.hv-nudge { position: absolute; bottom: calc(100% + 10px); left: 50%; translate: -50% 0; height: 34px; padding: 0 15px; display: flex; align-items: center; border-radius: 99px; font-size: 13px; font-weight: 500; color: var(--ink2); white-space: nowrap; opacity: 0; transform: translateY(8px) scale(.97); pointer-events: none; }
.hv-nudge.on { opacity: 1; transform: none; }
.hv-legend.on ~ .hv-nudge { display: none; }

/* Ask box */
.hv-askbox { position: absolute; left: var(--m); bottom: calc(var(--m) + var(--bottom-h) + 10px); width: 440px; max-width: calc(100vw - 2 * var(--m)); max-height: calc(100vh - 150px); display: flex; flex-direction: column; padding: 18px 18px 16px; border-radius: 28px; background-color: var(--glass2); transform-origin: left bottom; opacity: 0; transform: translateY(14px) scale(.94); visibility: hidden; transition: transform .5s var(--pop), opacity .22s ease, visibility 0s .3s, background-color .9s ease; }
.hv-askbox.open { opacity: 1; transform: none; visibility: visible; transition: transform .55s var(--pop), opacity .22s ease, visibility 0s, background-color .9s ease; }
.hv-askbox h3 { font-family: var(--serif); font-style: italic; font-size: 29px; line-height: 1.08; letter-spacing: -.014em; padding: 0 4px; }
.hv-askbox > p { color: var(--ink2); padding: 2px 4px 0; }
.hv-ask-log { margin: 10px 0 0; padding: 0 4px; }
.hv-ask-log:empty { display: none; }
.hv-qa { padding: 8px 0 10px; }
.hv-qa + .hv-qa { border-top: 1px solid var(--hair); }
.hv-qa-q { font-size: 12.5px; font-weight: 540; color: var(--ink2); }
.hv-qa-a { font-family: var(--serif); font-size: 22px; line-height: 1.22; letter-spacing: -.005em; margin-top: 3px; user-select: text; -webkit-user-select: text; }
.hv-qa-a.typing::after { content: ''; display: inline-block; width: 2px; height: .9em; margin-left: 2px; vertical-align: -.1em; background: var(--accent); animation: hv-caret .9s steps(1) infinite; }
@keyframes hv-caret { 50% { opacity: 0; } }
.hv-sugg { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.hv-sugg button { height: 32px; padding: 0 12px; border-radius: 99px; font-size: 12.5px; font-weight: 520; color: var(--ink2); background: var(--fill); white-space: nowrap; }
@media (hover: hover) { .hv-sugg button:hover { background: var(--accent-soft); color: var(--accent); } }
.hv-field { display: flex; align-items: center; gap: 8px; margin-top: 12px; height: 50px; padding: 0 7px 0 15px; border-radius: 18px; background: var(--fill); box-shadow: inset 0 0 0 1px transparent; transition: box-shadow .25s ease, background-color .25s ease; }
.hv-field:focus-within { box-shadow: inset 0 0 0 1.5px var(--accent); background: var(--glass2); }
.hv-field .hv-i { font-size: 18px; color: var(--accent); }
.hv-field input { flex: 1; min-width: 0; height: 100%; border: 0; background: none; outline: none; font: inherit; font-size: 15px; color: var(--ink); user-select: text; -webkit-user-select: text; }
.hv-field input::placeholder { color: var(--ink3); }
.hv-send { width: 36px; height: 36px; border-radius: 13px; display: grid; place-items: center; background: var(--button); color: var(--on-ink) !important; font-size: 16px; }
.hv-send .hv-i { color: inherit; font-size: 16px; }

/* Agent network */
.hv-agents-chip { justify-self: end; display: flex; align-items: center; gap: 10px; height: var(--bottom-h); padding: 0 18px 0 14px; border-radius: 22px; font-weight: 540; font-size: 14px; white-space: nowrap; }
.hv-stack { display: flex; }
.hv-stack .hv-ag { margin-left: -9px; } .hv-stack .hv-ag:first-child { margin-left: 0; }
.hv-ag { --t: ${C.teal}; position: relative; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; flex: none; color: color-mix(in srgb, var(--t) 40%, #1e2430); background: radial-gradient(120% 120% at 30% 20%, color-mix(in srgb, var(--t) 45%, #fff), color-mix(in srgb, var(--t) 86%, #fff)); box-shadow: 0 0 0 2px var(--ring, var(--solid)), 0 1px 2px rgba(44,47,70,.14); transition: transform .4s var(--pop), box-shadow .9s ease; }
.hv-ag .hv-i { font-size: 15px; stroke-width: 1.9; }
.hv-ag.talk { transform: translateY(-4px) scale(1.1); z-index: 2; }
.hv-agents-meta { line-height: 1.2; }
.hv-agents-meta small { display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 480; color: var(--ink2); }
.hv-agentbox { position: absolute; right: var(--m); bottom: calc(var(--m) + var(--bottom-h) + 10px); width: var(--side); height: min(560px, calc(100vh - 190px)); display: flex; flex-direction: column; border-radius: 28px; overflow: hidden; background-color: var(--glass2); transform-origin: right bottom; opacity: 0; transform: translateY(14px) scale(.94); visibility: hidden; transition: transform .5s var(--pop), opacity .22s ease, visibility 0s .3s, right .55s var(--spring), background-color .9s ease; }
.hv-agentbox.open { opacity: 1; transform: none; visibility: visible; transition: transform .55s var(--pop), opacity .22s ease, visibility 0s, right .55s var(--spring), background-color .9s ease; }
.hv[data-inspect='1'] .hv-agentbox { right: calc(var(--m) + var(--side) + 10px); }
.hv-agentbox header { display: flex; gap: 8px; align-items: flex-start; padding: 18px 14px 4px 20px; }
.hv-agentbox header > div { flex: 1; }
.hv-agentbox h3 { font-family: var(--serif); font-style: italic; font-size: 27px; line-height: 1.08; letter-spacing: -.012em; }
.hv-agentbox header p { font-size: 12.5px; color: var(--ink2); margin-top: 2px; }
.hv-crew { position: relative; display: flex; justify-content: space-between; padding: 26px 22px 12px; }
.hv-crew svg.links { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.hv-crew .hv-ag { width: 36px; height: 36px; --ring: transparent; box-shadow: 0 1px 3px rgba(44,47,70,.16); }
.hv-crew .hv-ag .hv-i { font-size: 18px; }
.hv-crew-n { position: absolute; top: 100%; left: 50%; translate: -50% 0; margin-top: 4px; font-size: 10.5px; font-weight: 540; color: var(--ink2); white-space: nowrap; }
.hv-crew { margin-bottom: 14px; }
.hv-link { fill: none; stroke: var(--accent); stroke-width: 1.6; stroke-linecap: round; stroke-dasharray: 1 1; animation: hv-link 1.5s var(--soft) both; filter: drop-shadow(0 0 3px var(--accent-soft)); }
@keyframes hv-link { 0% { stroke-dashoffset: 1; opacity: 1; } 55% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: -1; opacity: .2; } }
.hv-feed { flex: 1; min-height: 0; padding: 6px 14px 14px; display: flex; flex-direction: column; gap: 2px; -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 22px); mask-image: linear-gradient(180deg, transparent 0, #000 22px); }
.hv-feed-pad { flex: 1; }
.hv-msg { display: flex; gap: 10px; padding: 7px 6px; border-radius: 14px; flex: none; }
.hv-msg.new { animation: hv-msg .6s var(--spring) both; }
@keyframes hv-msg { from { opacity: 0; transform: translateY(14px) scale(.97); } }
.hv-msg .hv-ag { --ring: transparent; width: 30px; height: 30px; margin-top: 1px; }
.hv-msg-w { font-size: 12px; color: var(--ink3); }
.hv-msg-w b { color: var(--ink); font-weight: 580; }
.hv-msg p { font-size: 13.5px; line-height: 1.36; color: var(--ink); }
.hv-msg time { float: right; font-family: var(--mono); font-size: 11px; letter-spacing: -.03em; color: var(--ink3); margin-left: 8px; }
.hv-msg[data-k=alert] p { color: var(--danger); }

/* Toasts */
.hv-toasts { display: flex; flex-direction: column; gap: 8px; transition: transform .6s var(--spring); pointer-events: none; }
.hv[data-inspect='1'] .hv-toasts { transform: translateX(calc(-1 * var(--side) - 10px)); }
.hv-toast { --c: var(--info); position: relative; display: flex; gap: 11px; padding: 12px 12px 12px 14px; border-radius: 20px; overflow: hidden; background-color: var(--glass2); animation: hv-toast .62s var(--pop) both; }
.hv-toast.out { opacity: 0; transform: translateX(26px) scale(.96); transition: opacity .25s ease, transform .3s ease; }
.hv-toast[data-s=watch] { --c: var(--watch); } .hv-toast[data-s=critical] { --c: var(--danger); }
@keyframes hv-toast { from { opacity: 0; transform: translateX(32px) scale(.96); } }
.hv-toast-ic { width: 34px; height: 34px; border-radius: 12px; flex: none; display: grid; place-items: center; font-size: 18px; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); }
.hv-toast-b { flex: 1; min-width: 0; }
.hv-toast b { display: block; font-weight: 590; font-size: 13.5px; line-height: 1.28; }
.hv-toast p { font-size: 12.5px; color: var(--ink2); line-height: 1.34; margin-top: 1px; }
.hv-toast-a { display: flex; gap: 6px; margin-top: 8px; }
.hv-toast-a button { height: 29px; padding: 0 12px; border-radius: 99px; font-size: 12.5px; font-weight: 560; background: var(--fill); }
.hv-toast-a button.go { background: var(--c); color: #fff; }
.hv[data-theme=night] .hv-toast-a button.go { color: #18203a; }
.hv-toast .hv-x { width: 26px; height: 26px; font-size: 13px; background: none; margin: -3px -3px 0 0; }
.hv-edgeglow { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 1.4s ease; }
.hv-edgeglow::before { content: ''; position: absolute; inset: 0; box-shadow: inset 0 0 120px 10px rgba(255,138,122,.34), inset 0 0 24px 2px rgba(239,90,99,.2); animation: hv-breathe 3.6s ease-in-out infinite; }
.hv-edgeglow.on { opacity: 1; }
@keyframes hv-breathe { 0%, 100% { opacity: .42; } 50% { opacity: 1; } }

/* Labels in the world */
.hv-labels { position: absolute; inset: 0; overflow: hidden; pointer-events: none; contain: strict; }
.hv-lb { position: absolute; left: 0; top: 0; will-change: transform; }
.hv-lb > * { transition: opacity .32s ease, scale .42s var(--spring); opacity: 0; scale: .86; }
.hv-lb.on > * { opacity: 1; scale: 1; }
.hv-lroom { display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px 0 9px; border-radius: 99px; translate: -50% -50%; white-space: nowrap; font-size: 12.5px; font-weight: 570; background: var(--label); color: var(--ink); box-shadow: 0 0 0 .5px rgba(44,47,70,.08), 0 2px 8px rgba(44,47,70,.14); pointer-events: none; }
.hv-lb.on .hv-lroom { pointer-events: auto; cursor: pointer; }
.hv-lroom small { font-family: var(--mono); font-size: 11px; color: var(--ink2); letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.hv-lroom i { width: 7px; height: 7px; border-radius: 50%; background: var(--c, var(--ok)); }
.hv-lroom[data-s=busy] { --c: var(--info); } .hv-lroom[data-s=full] { --c: var(--watch); } .hv-lroom[data-s=alert] { --c: var(--danger); }
.hv-lbed { display: block; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; border: 2px solid #fff; background: var(--c); box-shadow: 0 1px 4px rgba(44,47,70,.34); }
.hv-lbed[data-s=free] { --c: var(--ok); } .hv-lbed[data-s=occupied] { --c: var(--info); } .hv-lbed[data-s=cleaning] { --c: var(--watch); } .hv-lbed[data-s=reserved] { --c: ${C.purple}; }
.hv-beacon { position: relative; display: grid; place-items: center; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; font-size: 17px; color: #fff; background: var(--c); box-shadow: 0 3px 10px color-mix(in srgb, var(--c) 45%, transparent), inset 0 1px 0 rgba(255,255,255,.4); --c: ${C.danger}; pointer-events: none; }
.hv-lb.on .hv-beacon { pointer-events: auto; cursor: pointer; }
.hv-beacon[data-s=watch] { --c: ${C.watch}; }
.hv-beacon::before, .hv-beacon::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: var(--c); opacity: .4; z-index: -1; animation: hv-beacon 2.2s ease-out infinite; }
.hv-beacon::after { animation-delay: 1.1s; }
@keyframes hv-beacon { to { transform: scale(2.4); opacity: 0; } }
.hv-beacon .hv-i { stroke-width: 2.1; }
.hv-ltag { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px 0 8px; border-radius: 99px; translate: -50% -50%; white-space: nowrap; font-size: 12.5px; font-weight: 570; background: var(--label); color: var(--ink); box-shadow: 0 0 0 .5px rgba(44,47,70,.08), 0 3px 10px rgba(44,47,70,.16); pointer-events: none; }
.hv-lb.on .hv-ltag { pointer-events: auto; cursor: pointer; }
.hv-ltag .hv-i { font-size: 17px; color: ${C.coralDeep}; }
.hv-ltag small { font-family: var(--mono); font-size: 11.5px; color: var(--ink2); letter-spacing: -.04em; }
.hv-route { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; opacity: 0; transition: opacity .4s ease; }
.hv-route.on { opacity: 1; }
.hv-route polyline { fill: none; stroke: var(--accent-2); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: .1 9; animation: hv-march 1s linear infinite; filter: drop-shadow(0 1px 1px rgba(10,60,70,.3)); }
.hv-route circle { fill: var(--accent-2); stroke: #fff; stroke-width: 2.5; }
@keyframes hv-march { to { stroke-dashoffset: -18.2; } }
.hv-tip { position: absolute; left: 0; top: 0; padding: 8px 12px 9px; border-radius: 14px; max-width: 250px; background: var(--solid); box-shadow: var(--shadow); pointer-events: none; opacity: 0; transition: opacity .16s ease; will-change: transform; }
.hv-tip.on { opacity: 1; }
.hv-tip b { display: block; font-weight: 590; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hv-tip span { display: block; font-size: 12.5px; color: var(--ink2); line-height: 1.32; }

/* Welcome */
.hv-welcome { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; pointer-events: auto; cursor: default; padding: 24px; transition: opacity .8s ease, visibility 0s .8s; }
.hv-welcome::before { content: ''; position: absolute; inset: -10%; background: radial-gradient(60% 40% at 50% 47%, rgba(var(--veil),.88) 0%, rgba(var(--veil),.7) 46%, rgba(var(--veil),.18) 80%, rgba(var(--veil),0) 100%); animation: hv-veil 1.6s ease both; }
@keyframes hv-veil { from { opacity: 0; } }
.hv-welcome-in { position: relative; margin-top: -3vh; transition: transform .9s var(--spring), opacity .55s ease, filter .55s ease; }
.hv-welcome.bye { opacity: 0; visibility: hidden; pointer-events: none; }
.hv-welcome.bye .hv-welcome-in { transform: translateY(-26px) scale(1.02); opacity: 0; filter: blur(6px); }
.hv-welcome h1 { margin: 0; font-family: var(--serif); font-style: italic; font-weight: 400; font-size: clamp(58px, min(9.6vw, 19vh), 176px); line-height: 1; letter-spacing: -.024em; white-space: nowrap; }
.hv-welcome h1 span { display: inline-block; opacity: 0; transform: translateY(.34em); filter: blur(10px); animation: hv-word 1.3s var(--spring) forwards; animation-delay: calc(240ms + var(--i) * 190ms); }
@keyframes hv-word { to { opacity: 1; transform: none; filter: blur(0); } }
.hv-welcome p { margin-top: 16px; font-size: clamp(15px, 1.5vw, 19px); line-height: 1.4; color: var(--ink2); opacity: 0; animation: hv-rise 1.1s var(--spring) 1s forwards; }
@keyframes hv-rise-in { to { opacity: 1; transform: none; } }
.hv-welcome p { transform: translateY(10px); animation-name: hv-rise-in; }
.hv-welcome-a { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 30px; opacity: 0; transform: translateY(12px); animation: hv-rise-in 1.1s var(--spring) 1.3s forwards; }
.hv-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 52px; padding: 0 26px; border-radius: 99px; font-size: 15px; font-weight: 560; white-space: nowrap; }
.hv-btn.pri { background: var(--button); color: var(--on-ink); box-shadow: 0 2px 4px rgba(44,47,70,.18), 0 12px 26px rgba(44,47,70,.26), inset 0 1px 0 rgba(255,255,255,.12); }
.hv-btn.pri .hv-i { font-size: 17px; }
.hv-btn.sec { background: rgba(255,255,255,.56); box-shadow: inset 0 0 0 .5px rgba(44,47,70,.1), 0 2px 8px rgba(44,47,70,.08); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
.hv[data-theme=night] .hv-btn.sec { background: rgba(255,255,255,.1); }
@media (hover: hover) { .hv-btn.pri:hover { box-shadow: 0 3px 6px rgba(44,47,70,.2), 0 16px 34px rgba(44,47,70,.3), inset 0 1px 0 rgba(255,255,255,.12); } }

/* Tour */
.hv-tour { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .7s ease; }
.hv-tour.on { opacity: 1; }
.hv-tour::before { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 46%; background: linear-gradient(0deg, rgba(var(--veil),.92) 0%, rgba(var(--veil),.72) 38%, rgba(var(--veil),0) 100%); }
.hv-tour-c { position: absolute; left: 0; right: 0; bottom: 92px; padding: 0 28px; text-align: center; }
.hv-tour-c h2 { font-family: var(--serif); font-style: italic; font-size: clamp(34px, 4.5vw, 66px); line-height: 1.04; letter-spacing: -.018em; max-width: 1040px; margin: 0 auto; text-wrap: balance; }
.hv-tour-c p { font-size: clamp(15px, 1.35vw, 18px); line-height: 1.42; color: var(--ink2); max-width: 680px; margin: 12px auto 0; text-wrap: balance; }
.hv-tour-c.swap h2, .hv-tour-c.swap p { animation: hv-cap 1s var(--spring) both; }
.hv-tour-c.swap p { animation-delay: .14s; }
@keyframes hv-cap { from { opacity: 0; transform: translateY(16px); filter: blur(6px); } }
.hv-tour-f { position: absolute; left: 0; right: 0; bottom: 30px; display: flex; align-items: center; justify-content: center; gap: 16px; }
.hv-dots { display: flex; gap: 6px; align-items: center; }
.hv-dots i { position: relative; width: 7px; height: 7px; border-radius: 99px; background: var(--ink4); overflow: hidden; transition: width .5s var(--spring), background-color .4s ease; }
.hv-dots i.past { background: var(--ink2); }
.hv-dots i.now { width: 40px; }
.hv-dots i.now::after { content: ''; position: absolute; inset: 0; background: var(--ink); transform-origin: left; animation: hv-fill var(--dur, 8s) linear both; border-radius: 99px; }
@keyframes hv-fill { from { transform: scaleX(0); } }
.hv-skip { pointer-events: auto; height: 34px; padding: 0 14px; border-radius: 99px; font-size: 13px; font-weight: 540; color: var(--ink2); background: var(--fill); }
@media (hover: hover) { .hv-skip:hover { background: var(--fill2); color: var(--ink); } }
.hv-tour-end { display: none; justify-content: center; gap: 10px; margin-top: 20px; pointer-events: auto; }
.hv-tour.end .hv-tour-end { display: flex; animation: hv-rise .9s var(--spring) .5s both; }
.hv[data-tour='1'] .hv-rail, .hv[data-tour='1'] .hv-bottom, .hv[data-tour='1'] .hv-tc, .hv[data-tour='1'] .hv-toasts { opacity: 0; pointer-events: none; transform: translateY(10px); transition: opacity .6s ease, transform .7s var(--spring); }
.hv[data-tour='1'] .hv-rail *, .hv[data-tour='1'] .hv-bottom *, .hv[data-tour='1'] .hv-tc * { pointer-events: none !important; }
.hv-rail, .hv-bottom, .hv-tc { transition: opacity .6s ease, transform .7s var(--spring); }

/* Roomier screens get labels on the view toggles */
@media (min-width: 1760px) {
  .hv-tool[data-text] { width: auto; padding: 0 12px 0 10px; display: inline-flex; align-items: center; gap: 6px; }
  .hv-tool[data-text] span { display: inline; font-size: 13px; font-weight: 530; }
  .hv-tool[data-text] .hv-hint { display: none; }
}
@media (max-width: 1500px) { .hv-kbd { display: none; } .hv-ask { padding-right: 18px; } }
@media (max-width: 1360px) {
  .hv-agents-meta { display: none; } .hv-agents-chip { padding: 0 14px; }
  .hv-ask { padding: 0 16px; } .hv-ask span { display: none; }
  .hv-chip { padding: 0 10px 0 8px; font-size: 12.5px; }
}
@media (max-width: 1140px) {
  .hv-chip .hv-i { display: none; } .hv-chip { padding: 0 10px; }
  .hv-dock { overflow-x: auto; scrollbar-width: none; }
  .hv-hint { display: none; }
}
@media (max-height: 800px) and (min-width: 900px) {
  .hv-card-s { display: none; } .hv-card { padding: 11px 15px 10px; } .hv-card-n b { font-size: 36px; } .hv-spark { top: 24px; }
  .hv-rail { gap: 8px; }
}
@media (max-height: 620px) and (min-width: 900px) {
  .hv-card-top .hv-i { display: none; } .hv-card-n b { font-size: 28px; } .hv-card { padding: 8px 14px; border-radius: 18px; } .hv-spark { top: 14px; height: 28px; }
}

/* Phones and small tablets */
@media (max-width: 899px) {
  .hv { --m: 12px; --top-h: 58px; --bottom-h: 50px; --side: 100%; }
  .hv-brand { min-width: 0; padding: 0 16px 0 9px; gap: 9px; border-radius: 20px; }
  .hv-mark { width: 38px; height: 38px; border-radius: 13px; } .hv-mark svg { width: 22px; height: 22px; }
  .hv-name { font-size: 21px; } .hv-status { font-size: 11.5px; margin-top: 1px; }
  .hv-tl { max-width: calc(100vw - 134px - 2 * var(--m)); }
  .hv-brand { overflow: hidden; }
  .hv-tr { width: 124px; z-index: 4; }
  .hv-clock { padding: 7px 12px 0 14px; align-items: flex-end; border-radius: 20px; gap: 0; }
  .hv-clock-top { height: 26px; } .hv-time { font-size: 22px; }
  .hv-part { font-size: 11.5px; line-height: 1.3; position: absolute; top: 34px; right: 14px; }
  .hv-speed, .hv-scrub { display: none; }
  .hv-clock { position: relative; transition: height .5s var(--spring), width .5s var(--spring), background-color .9s ease; width: 124px; align-self: flex-end; align-items: stretch; }
  .hv-clock.wide { width: min(306px, calc(100vw - 24px)); height: 100px; }
  .hv-clock.wide .hv-part { position: static; margin-right: auto; }
  .hv-clock.wide .hv-speed { display: flex; } .hv-clock.wide .hv-scrub { display: flex; height: 40px; }
  .hv-clock.wide .hv-part { font-size: 12px; }
  .hv-clock.wide .hv-clock-top { justify-content: flex-start; height: 32px; }
  .hv-toasts { position: absolute; top: calc(var(--top-h) + 8px); right: 0; width: calc(100vw - 2 * var(--m)); }
  .hv[data-inspect='1'] .hv-toasts { transform: none; }

  .hv-tc { top: calc(var(--m) + var(--top-h) + 8px); justify-content: flex-start; padding-left: var(--m); }
  .hv-seg button { height: 32px; min-width: 62px; padding: 0 12px; font-size: 13px; }
  .hv-bottom { display: block; position: absolute; left: 0; right: 0; bottom: 0; top: 0; }
  .hv-dockwrap { position: absolute; left: 0; right: 0; bottom: max(10px, env(safe-area-inset-bottom)); padding: 0 var(--m); }
  .hv-dock { width: 100%; max-width: none; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; border-radius: 24px; padding: 0 6px; }
  .hv-sep { margin: 0 4px; }
  .hv-chip .hv-i { display: block; } .hv-chip { padding: 0 11px 0 9px; }
  .hv-ask, .hv-agents-chip { position: absolute; top: calc(var(--m) + var(--top-h) + 8px); height: 40px; border-radius: 20px; }
  .hv-ask { left: auto; right: calc(var(--m) + 88px); width: 44px; padding: 0; justify-content: center; }
  .hv-agents-chip { right: var(--m); padding: 0 8px; gap: 0; width: 80px; justify-content: center; }
  .hv-agents-chip .hv-ag { width: 24px; height: 24px; margin-left: -10px; } .hv-agents-chip .hv-ag:first-child { margin-left: 0; } .hv-agents-chip .hv-ag:nth-child(n+4) { display: none; }
  .hv-agents-chip .hv-ag .hv-i { font-size: 13px; }

  .hv-rail { top: auto; left: 0; right: 0; bottom: calc(max(10px, env(safe-area-inset-bottom)) + var(--bottom-h) + 8px); width: auto; height: auto; flex-direction: row; justify-content: flex-start; gap: 8px; padding: 2px var(--m) 6px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding: 0 var(--m); pointer-events: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }
  .hv-card { flex: none; width: 158px; padding: 10px 13px 10px; border-radius: 19px; scroll-snap-align: start; }
  .hv-card-top { font-size: 12px; } .hv-card-n { margin-top: 1px; } .hv-card-n b { font-size: 31px; } .hv-card-n small { font-size: 12px; }
  .hv-card-s { display: none; } .hv-spark { display: none; }

  .hv-fly { left: var(--m); right: var(--m); top: auto; width: auto; bottom: calc(var(--bottom-h) + 104px); max-height: 56vh; }
  .hv-fly-in { transform-origin: bottom center; }

  .hv-insp { left: 0; right: 0; top: auto; bottom: 0; width: auto; height: auto; max-height: 76vh; display: block; }
  .hv-insp-in { max-height: 76vh; height: 76vh; border-radius: 28px 28px 0 0; transform: translateY(104%); opacity: 1; transform-origin: bottom center; transition: transform .6s var(--spring), visibility 0s .6s, background-color .9s ease; }
  .hv-insp.open .hv-insp-in { transform: translateY(var(--drag, 0)); transition: transform .6s var(--spring), visibility 0s, background-color .9s ease; }
  .hv-insp.dragging .hv-insp-in { transition: none; }
  .hv-grab { display: block; flex: none; height: 22px; touch-action: none; position: relative; cursor: grab; }
  .hv-grab::after { content: ''; position: absolute; left: 50%; top: 9px; width: 40px; height: 5px; margin-left: -20px; border-radius: 9px; background: var(--ink4); }
  .hv-insp-h { padding-top: 4px; }
  .hv-insp-h h2 { font-size: 30px; }

  .hv-askbox { width: auto; right: var(--m); bottom: calc(var(--bottom-h) + 22px); transform-origin: bottom center; max-height: calc(100vh - 160px); }
  .hv-agentbox { left: var(--m); right: var(--m); width: auto; bottom: calc(var(--bottom-h) + 22px); transform-origin: bottom center; height: min(520px, calc(100vh - 200px)); }
  .hv[data-inspect='1'] .hv-agentbox { right: var(--m); }
  .hv-sugg { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin-left: -18px; margin-right: -18px; padding: 0 18px; }
  .hv-legend, .hv-nudge { bottom: calc(100% + 92px); }
  .hv-tour-c { bottom: 86px; padding: 0 20px; }
  .hv-tour-c p { font-size: 14.5px; }
  .hv-welcome h1 { font-size: clamp(56px, 19vw, 96px); white-space: normal; line-height: .96; }
  .hv-welcome::before { background: radial-gradient(90% 46% at 50% 47%, rgba(var(--veil),.9) 0%, rgba(var(--veil),.72) 50%, rgba(var(--veil),.12) 86%, rgba(var(--veil),0) 100%); }
  .hv-welcome-a { flex-direction: column; align-items: stretch; max-width: 300px; margin-left: auto; margin-right: auto; }
  .hv-tip { display: none; }
  .hv-edgeglow::before { box-shadow: inset 0 0 70px 14px rgba(255,138,122,.5); }
}

@media (prefers-reduced-motion: reduce) {
  .hv *, .hv *::before, .hv *::after { animation-duration: .01ms !important; animation-delay: 0ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; transition-delay: 0ms !important; }
  .hv-live::after, .hv-beacon::before, .hv-beacon::after { display: none; }
  .hv-edgeglow::before { opacity: .8; }
}
@media (prefers-reduced-transparency: reduce) {
  .hv-glass { -webkit-backdrop-filter: none; backdrop-filter: none; background-color: var(--glass2); }
}
`;

export function injectStyles() {
  if (document.getElementById('hv-css')) return;
  const s = document.createElement('style');
  s.id = 'hv-css';
  s.textContent = CSS;
  document.head.append(s);
}
