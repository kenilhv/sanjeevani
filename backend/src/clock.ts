// Demo clock (contracts.md section 6). Story time is stored as minutes since the 19:00 shift start,
// so the night never wraps: 19:00 = 0, 03:30 = 510, 06:45 = 705, 07:00 = 720, 07:30 = 750.

export interface Clock {
    anchorStory: number // story minutes at anchorReal
    anchorReal: number // Unix ms
    speed: number // story minutes per real minute
}

export interface DueItem {
    id: string
    type: string // med_check, pain_recheck, fall_rounds, handoff_prep, shift_change, handoff_deadline
    at: number // story minutes
    data?: Record<string, string>
}

const SHIFT_START = 19 * 60

export function toStory(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number)
    return (h * 60 + m - SHIFT_START + 1440) % 1440
}

export function fromStory(story: number): string {
    const total = (Math.floor(story) + SHIFT_START) % 1440
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

export function defaultClock(): Clock {
    return { anchorStory: 0, anchorReal: Date.now(), speed: 1 }
}

export function storyNow(clock: Clock, nowMs = Date.now()): number {
    return clock.anchorStory + ((nowMs - clock.anchorReal) / 60000) * clock.speed
}

export function simTimeNow(clock: Clock): string {
    return fromStory(storyNow(clock))
}

// Real Unix ms at which a story time is reached: realDelay = (storyDue - storyNow) / speed.
export function realTimeFor(clock: Clock, story: number): number {
    return clock.anchorReal + ((story - clock.anchorStory) / clock.speed) * 60000
}

// Each actor has ONE Terse alarm slot, so it holds a list of due items and points the alarm at the earliest.
export function nextAlarmMs(clock: Clock, dues: DueItem[]): number | null {
    if (dues.length === 0) return null
    const earliest = Math.min(...dues.map(d => d.at))
    return realTimeFor(clock, earliest)
}

export function splitDue(clock: Clock, dues: DueItem[]): { due: DueItem[]; later: DueItem[] } {
    const now = storyNow(clock) + 0.01
    return {
        due: dues.filter(d => d.at <= now).sort((a, b) => a.at - b.at),
        later: dues.filter(d => d.at > now)
    }
}
