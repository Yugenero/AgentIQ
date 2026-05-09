# AgentIQ — Valorant Performance Analytics

> **Live app → [agent-iq-alpha.vercel.app](https://agent-iq-alpha.vercel.app/)**

A Valorant analytics dashboard built for a friend group. Enter any Riot ID to pull competitive match history, rank, and stats — then get a deterministic AI coaching breakdown grounded in your actual round data.

---

## Screenshots

### Landing
![AgentIQ landing page](docs/screenshot-landing.png)

### Dashboard
![AgentIQ dashboard](docs/screenshot-dashboard.png)

### Match Analysis (VAL-COACH-D2A)
![AgentIQ AI match analysis](docs/screenshot-analysis.png)

---

## Features

- **Player search** — look up any Riot ID, click any scoreboard row to load that player
- **Match history** — last 20 competitive games with KDA, ACS, HS%, RR delta, map, agent
- **Rank tracking** — current rank with RR trendline across recent matches
- **KPI cards** — K/D, ACS, HS%, Win Rate, ADR aggregated over recent games
- **Economy Flow** — win rates by buy type (pistol / eco / force / full) + round timeline
- **Role Fulfillment radar** — spider chart benchmarking your stats against role baselines (duelist / initiator / controller / sentinel)
- **Agent breakdown** — per-agent win rate, K/D, ACS across all tracked games
- **AI match analysis (VAL-COACH-D2A)** — deterministic GPT-4.1-mini coaching grounded in round-level economy, trade rates, opening duels, post-plant, and utility — no vague advice
- **Dark / light theme**
- **Firebase auth** — sign in to save your tracked player

---

## Prerequisites

- Node.js 18+ 
- npm 9+
- A [HenrikDev API key](https://docs.henrikdev.xyz/) — free tier, 30 req/min
- An [OpenAI API key](https://platform.openai.com/api-keys)
- A Firebase project (for auth + Firestore)

---

## Local setup

### 1. Clone

```bash
git clone https://github.com/Yugenero/AgentIQ.git
cd AgentIQ
```

### 2. Install

```bash
npm install
```

### 3. Environment variables

Create `.env.local` in the project root:

```env
VITE_HENRIK_API_KEY=HDEV-your-key-here
VITE_OPENAI_API_KEY=sk-proj-your-key-here
```

| Variable | Where to get it |
|---|---|
| `VITE_HENRIK_API_KEY` | [HenrikDev Discord](https://docs.henrikdev.xyz/) — Basic tier is free |
| `VITE_OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

> **Note:** `VITE_HENRIK_API_KEY` is used client-side. `VITE_OPENAI_API_KEY` is read by the serverless functions and never exposed in the browser bundle.

### 4. Run

```bash
./dev.sh
# or: npm run dev
```

Opens at http://localhost:5173.

---

## Deploy to Vercel

### 1. Push to GitHub, import to Vercel

1. Push the repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Vercel auto-detects Vite. Keep all defaults and click **Deploy**.

### 2. Add environment variables

**Project → Settings → Environment Variables:**

| Name | Value |
|---|---|
| `VITE_HENRIK_API_KEY` | Your HenrikDev key |
| `VITE_OPENAI_API_KEY` | Your OpenAI key |

Then **Deployments → Redeploy** to apply them.

---

## Tech stack

| Layer | Choice |
|---|---|
| Bundler | Vite 8 |
| UI | React 19 |
| State | Zustand |
| Styling | Plain CSS with custom properties |
| Stats API | HenrikDev Valorant API v4 |
| AI | OpenAI `gpt-4.1-mini` + `gpt-4o-mini` via Vercel serverless functions |
| Auth / DB | Firebase Auth + Firestore |
| Fonts | Inter + JetBrains Mono |
| Deploy | Vercel |

---

## Caveats

- **HenrikDev is unofficial.** Riot could ask for it to be taken down. Acceptable risk for a private tool.
- **OpenAI calls run server-side** via Vercel serverless functions — the API key is never in the browser bundle.
- **Match analysis uses `gpt-4.1-mini`** (1M token context) to handle full Henrik V4 round payloads.
- **Around Valorant patch days**, HenrikDev may return 503s for a few hours.
