// Agent Relay status for the floor's status bar.
// The agents' messages travel over Agent Relay when the Terse actors run with Relay registered (Aditya's runtime).
// This service has no Relay client of its own, so it reports Relay as live only when that runtime is connected:
// set AGENT_RELAY=live in .env once the actors are registered on Relay.
export const relayLive = () => process.env.AGENT_RELAY === "live"
