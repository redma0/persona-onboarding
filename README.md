# Persona onboarding

A conversational onboarding for Persona, the AI assistant that lives in your messages, rebuilt as a web simulator with a real voice call.

**Live:** https://persona-onboarding-riyad.vercel.app

The assistant collects **its own name** (by text), then tries a **phone call** to get **your name, what you need help with, and a connected Gmail**. Anything that doesn't happen on the call gets collected over text. It's built to survive people not playing along: declined, missed, or dropped calls, hang-ups, page reloads, blocked mics, refusals, bursts of messages, prompt injection, and users who just want to get to the point ("graduate early").

## How it works

| Piece | What it does |
|---|---|
| **Text agent** (`src/lib/agent.ts`, `/api/chat`) | Claude Opus 5.5 returns structured JSON (bubbles, collected fields, actions). Only the bubbles reach the user. Tools: web search, and read-only Gmail + Calendar once connected. |
| **Onboarding plan** (`src/lib/onboarding.ts`) | Deterministic: what's missing, the next step to attempt (round-robin, max 2 attempts each, declines respected), and when graduation is allowed. The model decides *how* to say things; the plan decides *what's next*. |
| **Voice call** (`src/components/Call.tsx`) | ElevenLabs Agents over WebRTC in the browser (Eleven v3 Conversational voice, Claude Sonnet 5). A per-call prompt is built from the conversation so far; in-call tools send the Google link, save your name/need, and check status. The voice follows the name you give it (male / female / neutral). |
| **Shared state** | One state object in the browser drives both the text and voice sides. Every call outcome (hang-up, drop, decline, miss, failure) becomes an event the text agent follows up on, including delivering anything promised on the call. |
| **Google** (`/api/google/*`) | Real OAuth (Gmail + Calendar, read-only). Tokens live in an encrypted http-only cookie. The inbox is only read after the user says yes. If Google blocks an unapproved tester, there's a clearly labeled demo sign-in fallback. |
| **Persona Band upsell** (`src/lib/engagement.ts`, `src/components/band.tsx`) | A commitment score (points for real usage) gates it: the Band is offered once, only past the threshold and only when the user describes a moment it's made for. Rendered with real iOS patterns: iMessage rich link → App Clip card → App Clip. |
| **iOS 26 UI** (`src/components/ios.tsx`, `Thread.tsx`, `cards.tsx`) | Liquid Glass nav/input, bubble tails, Delivered/Read, typing indicator, Dynamic Island call pill, iMessage-style link previews (`/api/unfurl`, generated fallback cards). |

Also in the repo but not the deliverable: an **iMessage channel** (`src/lib/imessage.ts`, Sendblue/BlueBubbles + Twilio calls) and an **App Clip proof-of-concept** (`../appclip-test`) showing Apple Pay pre-orders work inside an App Clip.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in keys (see below)
npm run setup:agents         # creates/updates the ElevenLabs voice agents
npm run dev
```

**Env:** `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `SESSION_SECRET`, `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Upstash Redis), optional `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## Testing

Simulations run AI-played users against the real agent and have a judge grade each transcript. They print their real cost and stop at `SIM_BUDGET` (dollars).

```bash
SIM_BUDGET=1 npm run sim:text -- happy-path no-calls   # text onboarding personas (dev server running)
npm run sim:voice                                       # voice-call personas via ElevenLabs' simulator
npm run sim:band                                        # Band upsell: when it should / shouldn't pitch
npm run chats                                           # read stored conversations (30-day retention)
```
