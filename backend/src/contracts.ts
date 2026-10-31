// Shared shapes from contracts.md (sections 3 and 4). Used by actors and the gateway.

export type Level = "urgent" | "soon" | "fyi"

export type RelayType =
    | "note.new"
    | "note.ack"
    | "alert"
    | "patient.request"
    | "question"
    | "answer"
    | "handoff.section"
    | "readback"
    | "readback.ok"
    | "readback.missing"
    | "help.request"
    | "help.response"
    | "floor.notice"

// Agent Relay message body (contracts.md section 3)
export interface RelayMessage {
    type: RelayType
    from: string // "twin-room-6", "nurse-pod-a", "unit-4west"
    to: string // agent name or "#4-west"
    room?: string
    level?: Level
    text: string
    simTime: string
    refs?: string[]
    nurseId?: string // the human behind a Nurse Agent message, when there is one
}

export type RoomStatus = "stable" | "warning" | "urgent" | "resolved"

// Frontend events (contracts.md section 4)
export type FrontendEvent =
    | { kind: "clock"; simTime: string; speed: number }
    | { kind: "room.status"; room: string; status: RoomStatus; owner?: string; label?: string }
    | { kind: "agent.message"; from: string; to: string; type: RelayType; level?: Level; text: string; room?: string; simTime?: string }
    | { kind: "transcript"; who: string; text: string }
    | { kind: "speech"; who: string; text: string; audioUrl?: string }
    | { kind: "nurse.change"; pod: string; from: string | null; to: string }
    | { kind: "handoff.progress"; room: string; state: string }
    | { kind: "system"; text: string }

export interface Outbox {
    messages?: RelayMessage[]
    events?: FrontendEvent[]
}

export const twinName = (room: string) => `twin-${room}`
export const nurseAgentName = (podId: string) => `nurse-${podId}`
export const roomLabel = (room: string) => `Room ${room.replace("room-", "")}`
