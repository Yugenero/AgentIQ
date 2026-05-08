# AgentIQ — Valorant Performance Analytics

A private friend-group Valorant analytics dashboard. Enter a Riot ID to pull competitive match history, rank, and stats, then get an AI-generated performance breakdown grounded in your actual numbers.

---

## Prerequisites

- Node.js 18+ (tested on Node 23 via Homebrew)
- npm 9+
- A HenrikDev API key — register at their Discord (Basic tier is free, 30 req/min)
- An Anthropic API key — get one at console.anthropic.com

---

## Setup

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd agentiq
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
VITE_HENRIK_API_KEY=HDEV-your-key-here
VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here
```

| Variable | Description |
|---|---|
| `VITE_HENRIK_API_KEY` | HenrikDev Valorant API key. Fetches player stats, rank, and match history. |
| `VITE_ANTHROPIC_API_KEY` | Anthropic API key. Generates AI performance analysis via Claude. |

> **Security note:** These keys are inlined into the browser bundle at build time and are visible in DevTools. This is acceptable for a private friend-group tool. Set a spending limit on your Anthropic console as a safety net. Never commit `.env.local` to git — it is already in `.gitignore`.

---

## Running locally

```bash
npm run dev
```

Opens at http://localhost:5173. Enter any Riot ID in `name#TAG` format (e.g. `TenZ#SEN`) to load a player's profile.

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "initial build"
git push origin main
```

### 2. Import to Vercel

1. Go to vercel.com and sign in.
2. Click **Add New Project** and import your GitHub repository.
3. Vercel auto-detects Vite. Keep the defaults:
   - Framework: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
4. Click **Deploy**.

### 3. Add environment variables

After the first deploy:

1. Project → **Settings** → **Environment Variables**.
2. Add `VITE_HENRIK_API_KEY` and `VITE_ANTHROPIC_API_KEY` with your values.
3. Redeploy: **Deployments** → latest → **Redeploy**.

---

## Custom domain (Vercel)

1. Buy a domain from Namecheap, Cloudflare Registrar, or directly through Vercel.
2. Project → **Settings** → **Domains** → **Add** → enter your domain.
3. Add the DNS records Vercel shows at your registrar:
   - **Apex (`yourdomain.com`):** A record `@ → 76.76.21.21`
   - **www:** CNAME `www → cname.vercel-dns-0.com`
   - Or: change nameservers to `ns1.vercel-dns.com` / `ns2.vercel-dns.com` to let Vercel manage DNS.
4. SSL provisions automatically within minutes of DNS propagation.

---

## Tech stack

| Layer | Choice |
|---|---|
| Bundler | Vite 6 |
| UI | React 19 |
| State | Zustand |
| Styling | Plain CSS with custom properties |
| Stats API | HenrikDev Valorant API (unofficial, browser-direct) |
| AI | Claude claude-sonnet-4-5 via tool_use |
| Fonts | Inter + JetBrains Mono (Google Fonts) |
| Deploy | Vercel |

---

## Caveats

- **HenrikDev is unofficial.** Riot could ask for it to be taken down. Acceptable risk for a private tool.
- **API keys are exposed in the browser bundle.** Set spending limits on both dashboards.
- **Match data is cached in localStorage for 5 minutes** per player to stay within rate limits.
- **Around Valorant patch days**, HenrikDev may return 503s for a few hours. The app surfaces a clean error message.
