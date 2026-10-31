# 🎬 Round 1: video + submission run sheet (Shresth)

**Record 3:15–3:35pm. Submit by 3:55pm.** 2 minutes max. Two takes, keep the better one, edit ≤ 5 min.

## Before you hit record

- [ ] `/floor` full screen on the recording display; Director console (`http://<you>:8787/`) on another screen, off camera
- [ ] `GET /health` shows `openai: true` (and `backend: terse` if Aditya's actors are live)
- [ ] `PUBLIC_URL` in `.env` is your **LAN IP** (not localhost), or audio links break on other machines
- [ ] **Click once on the `/floor` page** to arm audio (browsers block autoplay until a click)
- [ ] Headset mic on; one hold-to-talk test; typed fallback box ready
- [ ] **Reset demo** → **Start night** → **Pre-generate briefing** (so 7am audio plays instantly)
- [ ] Restart drill rehearsed 3 times with Aditya (`RESTART_CMD` set)
- [ ] Notifications off, the screen recorder captures system audio (the spoken briefing must be heard)

## The 2 minutes: what to press, what to say

| Time | Press / do | Say |
|---|---|---|
| 0:00–0:15 | Nothing: dark 3D floor | "Communication failures play a part in up to 80% of the worst hospital harms, and the riskiest moment is 7am." |
| 0:15–0:35 | **Jump to 23:30**, then hold to talk: *"Room 6, gave zolpidem for sleep."* (typed fallback if the mic fails) | "Our night nurse just talks. Her agent sends it to Room 6's Patient Twin..." |
| 0:35–0:50 | Room 6 flashes amber. Then say/type *"Room 6, bed alarm is on."* | "...and the Twin protects its patient. He's 81, and falls are the number one serious hospital harm." |
| 0:50–1:05 | **Fast-forward to 03:30**; Room 4 flashes red on its own. Then *"Room 4, given at 3, forgot to chart."* | "The actor's alarm fires on its own and catches a missed dose." |
| 1:05–1:35 | **7am handoff**: sunrise, Maya → Jordan, briefing plays. Hold to ask: *"Did Room 4's pain improve?"* Then read back Room 4: *"3am potassium given late, confirmed."* ✅ | "The nurse changed. The agent didn't. It briefs Jordan with the whole night's context." |
| 1:35–1:50 | **💥 Restart backend**; floor shows "Reconnecting...", then "Backend restarted. All state restored." | "The server just crashed. Every patient's story survived." |
| 1:50–2:00 | Daylight floor | "Sanjeevni. Nothing gets lost at 7am." |

If running long, skip the Room 6 "bed alarm" follow-up and the Jordan question. **Never cut:** Room 6 pushback,
Room 4 alarm, 7am briefing with read-back, restart.

## Description (paste as-is)

> **Sanjeevni: nothing gets lost at 7am.**
> Communication failures contribute to an estimated 50–80% of the most serious hospital harms, and the riskiest moment is the shift-change handoff. Structured handoffs cut adverse events by up to 47%, but after a 12-hour night shift, no nurse can do one perfectly for every patient.
> Sanjeevni gives every patient an AI **Patient Twin** and every group of rooms an AI **Nurse Agent**. Nurses just talk; the agents remember. Twins catch missed doses, spot risks for their own patient, and listen to the patient at the bedside. The Nurse Agent ranks alerts across patients, coordinates with other pods, and never clocks out: at 7am it briefs the new nurse with the whole night's context, and each Twin confirms the read-back.
> **Terse Durable Actors:** every patient, pod, and floor is an actor with its own memory and alarms, so patient stories survive shift changes and crashes. **Agent Relay:** Twins alert their Nurse Agent, pods help each other, and every message is an accountability record. **Supabase:** nurse sign-in, voice-note audio, and a floor-wide audit log.
> Humans always decide. Agents remind, warn, draft, and answer.

## Submit (3:35–3:55)

- [ ] Video uploaded (≤ 2:00)
- [ ] Description pasted
- [ ] All three sponsors named: Terse Durable Actors, Agent Relay, Supabase
- [ ] Team members listed: Aditya, Shresth, Kenil
- [ ] Submitted before 3:55. Screenshot the confirmation.
