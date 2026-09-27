# Persona onboarding prototype

A conversational onboarding for a text + voice personal assistant. Live: https://persona-onboarding-riyad.vercel.app

- **Text**: Claude Opus 5.5 (`/api/chat`) returns structured JSON: the message bubbles, updates to what's been collected, and actions. Only the bubbles are ever shown, so internal text can't leak into the chat.
- **Voice**: ElevenLabs Agents over WebRTC (Eleven v3 Conversational TTS, Claude Sonnet 5 as the call's model). A prompt is built for each call from the current state. In-call tools (`send_google_link`, `save_user_name`, `save_help_need`, `get_status`) write to the same state the text agent uses.
- **Shared state**: one state object in the client (saved in localStorage) that both agents read. Call hangups, drops, page reloads, declines and missed calls are all reported to the text agent, which picks up from there.
- **Google**: real OAuth (Gmail read-only) once `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set; otherwise a clearly labeled demo sign-in. When it connects, the app reads recent mail and texts a short digest.

## Env
```
ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, SESSION_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   # optional
```

## Scripts
- `node --env-file=.env.local scripts/setup-agent.mjs` creates or updates the ElevenLabs agent and tools
- `npx tsx --env-file=.env.local scripts/simulate-call.ts "<user persona>"` runs a simulated voice call against the real prompt
