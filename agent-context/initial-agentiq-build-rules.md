# Valorant Performance Analytics — Research Report for `build.md`

## TL;DR
- **Best data source:** Use the unofficial **HenrikDev Valorant API** (`api.henrikdev.xyz`). The official Riot Valorant API is gated by a production key + RSO OAuth flow that is impractical for a small private app, and Tracker.gg's public Developer API does not officially support Valorant. With a free Basic HenrikDev key (30 req/min) you can fetch every KPI you need (ACS, K/D, HS%, RR, rank, agent usage, match history) by Riot ID.
- **Architecture:** A Vite + React SPA can talk directly to the HenrikDev API and to the Claude API from the browser (Anthropic supports CORS via the `anthropic-dangerous-direct-browser-access: true` header). For a private friend-group app this is fine if the API keys are accepted as semi-public; for any real protection, deploy a thin Vercel/Netlify serverless function as a proxy and keep keys server-side. A small `useState` + Zustand store, CSS custom properties for theming, and a pure-CSS fade-in animation cover the UI requirements without Tailwind.
- **AI layer:** Use `claude-sonnet-4-5` (or Haiku 4.5 for cost) with **JSON Schema structured outputs** (beta header `anthropic-beta: structured-outputs-2025-11-13`) and a strict system prompt that forbids any claim not directly supported by the supplied stat object. Single-shot (non-streaming) calls are simpler and sufficient for a 3–6 paragraph performance summary.

---

## Key Findings

### 1. Data API: HenrikDev wins by a wide margin
- **HenrikDev (`api.henrikdev.xyz`, v4.5 as of Dec 2025)** — community-run, requires registering a key on their Discord, supports `Authorization: <key>` header. Basic tier = 30 req/min, Advanced (application required, ~1–2 week wait) = 90 req/min. Returns rich data parsed from Riot's in-game endpoints (full player KPIs per match). Not officially endorsed by Riot, explicitly "not designed for production apps" but ideal for hobby/small-group tooling. Has CORS enabled (it's used by browser clients in the wild).
- **Riot Games official Valorant API (`developer.riotgames.com`)** — endpoints: `val-match-v1`, `val-ranked-v1`, `val-content-v1`, `val-status-v1`, `val-console-match-v1`. Match history and ranked endpoints **require a Production API Key**, which requires a written application, an approved use case, and **mandatory RSO (Riot Sign On) OAuth integration** — every player must opt in to share their data. This is a non-starter for a small friend-group analytics app.
- **Tracker.gg API** — Tracker Network's official developer program at `tracker.gg/developers` covers Apex, CSGO, Division 2, Splitgate, etc. **Valorant is not listed**. Their internal endpoints (e.g. `api.tracker.gg/api/v2/valorant/...`) are undocumented, behind Cloudflare bot protection, and using them violates Tracker.gg ToS. Skip it.

### 2. KPIs the app should surface
**Per-player core (all available via HenrikDev):**
- **ACS** (Average Combat Score) — overall combat impact, target ~200+ (good), 250+ (excellent). Calculated from damage + kills (150/130/110/90/70 by enemies-alive) + multikills + assists.
- **K/D ratio**, **K/D/A**
- **Headshot %** (head/body/leg shot counts in match data → compute HS%)
- **ADR** (Average Damage per Round) — sum damage / rounds played
- **Win rate** (overall + per-agent + per-map)
- **First blood / first death rate** (derivable from `kills[]` array `kill_time_in_round`)
- **KAST%** — *not directly returned* by either API; would need to be computed from per-round kill events (kills + assists + survival + trades). Mark this as "advanced" — feasible but adds parsing complexity.

**Rank/MMR (HenrikDev `/v2/mmr` and `/v2/by-puuid/mmr`):**
- Current tier (e.g. "Diamond 1"), current RR (0–100), `last_change` (RR change last game), `elo` (numeric MMR), leaderboard placement
- Peak rank tier + season
- Per-season wins/games/end_tier history

**Agent / role stats:** derive by aggregating recent matches grouped by `character.name` — kills, deaths, ACS, win rate per agent. Role mapping (Duelist / Initiator / Sentinel / Controller) can be hard-coded from the static agent list.

**Match history (HenrikDev `/v3/matches` or `/v4/matches`):** map, mode, score, agent, K/D/A, ACS, HS%, ADR, win/loss, date — everything needed for a "last 5 matches" card.

### 3. AI Analysis Layer (Claude)
**Model choice (May 2026):**
- `claude-sonnet-4-5-20250929` (alias `sonnet`) — best balance of quality/cost for this task.
- `claude-haiku-4-5-20251001` — ~5–10× cheaper, fast, sufficient for a 200–400 word stat recap.

**Determinism patterns (from Anthropic docs on reducing hallucinations):**
1. **Always pass the stat object as JSON inside a `<player_stats>` XML block** in the user message. Claude is trained to respect XML structure.
2. **Explicitly allow "I don't know"** in the system prompt: e.g. *"If a stat is not present in the supplied data, do NOT mention or estimate it."*
3. **Require quote-grounding:** *"Every numeric claim you make must reference a field from the supplied JSON, e.g. `(ACS: 234)`."* Anthropic's official guidance: "Use direct quotes for factual grounding…verify with citations."
4. **Use Structured Outputs (beta)** instead of free-form text when you want a structured analysis card. Send header `anthropic-beta: structured-outputs-2025-11-13` and pass a JSON Schema in `output_format`. Returns guaranteed-valid JSON in `response.content[0].text`.
5. **Use temperature 0.2–0.4** for analytical consistency.
6. **Single-shot, not streaming.** A 300-word recap returns in <3s; streaming adds complexity (Anthropic SDK in browser supports it but you don't need it).

**Prompt structure (recommended):**
```
SYSTEM: You are a Valorant performance analyst. You analyze the JSON
stats below and produce a concise, specific, data-grounded summary.
Hard rules:
- Only cite numbers that appear in the supplied JSON.
- Do not invent map names, agent names, or scores.
- If KAST is not provided, do not discuss KAST.
- Use direct, blunt feedback (no fluff like "great job!").
- Output exactly 4 sections: Summary, Strengths, Weaknesses, Next Focus.

USER: <player_stats>{ ...full JSON... }</player_stats>
Produce the analysis now.
```
Pair with structured output schema (`{summary, strengths[], weaknesses[], focus[]}`) so the React app can render a uniform card.

### 4. React App Architecture (KISS)
**Stack:** Vite + React (JS, no TS), `zustand` for global state (player profile + theme), native `fetch`. No Tailwind — plain CSS files using CSS custom properties.

**API key handling — three options ranked by realism for "private friend group":**
1. **Pure client-side with `VITE_*` env vars (simplest, least secure).** Vite inlines `import.meta.env.VITE_HENRIK_KEY` and `VITE_ANTHROPIC_KEY` into the bundle at build time. **They are visible in the browser.** Acceptable only for: a private link shared with friends, behind a basic gate, where you accept that worst case someone exhausts your rate limit / Claude credits. Set spending limits on the Anthropic console as a safety net.
2. **Serverless function proxy (recommended for safety).** Add `/api/henrik.js` and `/api/claude.js` on Vercel or Netlify. Store keys as **server-side** env vars (no `VITE_` prefix). React calls `/api/henrik?name=...&tag=...` and the function adds the key. Works identically on Vercel (`api/` folder) and Netlify (`netlify/functions/`).
3. **"Bring your own Claude key"** pattern — let each user paste their own Anthropic key into a settings dialog and store in `localStorage`. Anthropic explicitly endorses this pattern with the `anthropic-dangerous-direct-browser-access: true` header.

**CORS:**
- HenrikDev API: CORS-enabled in practice (used by browser clients widely). No proxy needed for direct calls.
- Anthropic API: requires the `anthropic-dangerous-direct-browser-access: true` request header on every call to bypass CORS. Without it you'll hit a CORS error in the browser.
- If you proxy via serverless functions, both issues disappear.

**State management:** For this scale, a single Zustand store (~30 lines) is the sweet spot. `useState` is fine for component-local UI; use Zustand for `{ player, stats, matches, analysis, theme, loading, error }`. Skip Redux/Context.

**Folder structure (KISS):**
```
src/
  main.jsx
  App.jsx
  styles/
    global.css        ← reset + CSS variables
    theme.css         ← [data-theme="dark"|"light"] vars
    animations.css
  components/
    SearchBar.jsx
    StatCard.jsx
    RankCard.jsx
    MatchRow.jsx
    AgentBreakdown.jsx
    AIAnalysis.jsx
    ThemeToggle.jsx
  services/
    henrik.js         ← fetch wrappers
    claude.js         ← Claude API client
  store/
    useAppStore.js    ← Zustand
  utils/
    format.js         ← number/percent formatters
    deriveStats.js    ← compute aggregates from match list
  api/                ← Vercel/Netlify serverless (optional)
    henrik.js
    claude.js
```

### 5. Deployment
**Vercel vs Netlify for a Vite + React SPA — both work, both deploy in <2 minutes from a Git push.** Either is fine; pick on preference.

| Aspect | Vercel | Netlify |
|---|---|---|
| Vite SPA detection | Auto (Framework: Vite) | Auto |
| Build command | `npm run build` (auto) | `npm run build` (auto) |
| Output dir | `dist` (auto) | `dist` (auto) |
| Serverless functions | `/api/*.js` (Node, default) | `/netlify/functions/*.js` |
| Env vars UI | Project → Settings → Environment Variables | Site → Settings → Environment Variables |
| Free tier commercial use | **Hobby tier forbids commercial** | Allowed |
| Custom domain | Easy, automatic SSL via Let's Encrypt | Easy, automatic SSL |

**Recommendation:** **Vercel** — its zero-config Vite detection and `/api/` convention are the smoothest for this exact stack.

**Environment variable security:**
- Variables prefixed with `VITE_` are **inlined into the JS bundle** and are public.
- For real secrets, set them in the Vercel/Netlify dashboard **without** the `VITE_` prefix and use them only in serverless functions (`process.env.ANTHROPIC_API_KEY`).

**Custom domain (Vercel):**
1. Buy domain (Namecheap, Cloudflare Registrar, or directly through Vercel).
2. Project → Settings → Domains → Add → enter `yourdomain.com`.
3. Vercel shows DNS records to add at your registrar:
   - **Apex (`yourdomain.com`)**: A record `@ → 76.76.21.21`
   - **`www` subdomain**: CNAME `www → cname.vercel-dns-0.com`
   - Or, easiest: change nameservers to `ns1.vercel-dns.com` / `ns2.vercel-dns.com` and let Vercel manage DNS.
4. SSL provisions automatically via Let's Encrypt within a few minutes of DNS propagation.

### 6. UI / Design Patterns (no Tailwind)

**Full-viewport layout primitives:**
```css
html, body, #root { height: 100%; width: 100%; margin: 0; }
body { min-height: 100dvh; overflow-x: hidden; }
#root { display: flex; flex-direction: column; }
```
Use CSS Grid for the dashboard (`grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`).

**Theming with CSS custom properties:**
```css
:root {
  --bg: #f7f5f2;        /* off-white */
  --fg: #0a0a0a;
  --muted: #6b6b6b;
  --surface: #ffffff;
  --border: #e3e0db;
  --accent: #b3122d;    /* dark red */
  --accent-fg: #ffffff;
  --shadow: 0 1px 2px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.04);
  color-scheme: light dark;
}
[data-theme="dark"] {
  --bg: #000000;
  --fg: #f2f2f2;
  --muted: #888;
  --surface: #0e0e0e;
  --border: #1f1f1f;
  --accent: #e11d2e;
  --accent-fg: #ffffff;
  --shadow: 0 0 0 1px #1f1f1f, 0 8px 32px rgba(0,0,0,.6);
}
body {
  background: var(--bg); color: var(--fg);
  transition: background-color .25s ease, color .25s ease;
}
```
Toggle by setting `document.documentElement.dataset.theme = 'dark' | 'light'` and persisting to `localStorage`. Run a tiny inline script in `index.html` *before* React mounts to avoid a flash of wrong theme.

**Entry animation (CSS-only, simple but impactful):**
```css
@keyframes rise-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}
.app-enter { animation: rise-in .55s cubic-bezier(.2,.7,.2,1) both; }
.stagger > * { animation: rise-in .55s cubic-bezier(.2,.7,.2,1) both; }
.stagger > *:nth-child(1) { animation-delay: .05s; }
.stagger > *:nth-child(2) { animation-delay: .12s; }
.stagger > *:nth-child(3) { animation-delay: .19s; }
.stagger > *:nth-child(4) { animation-delay: .26s; }
.stagger > *:nth-child(5) { animation-delay: .33s; }
@media (prefers-reduced-motion: reduce) {
  .app-enter, .stagger > * { animation: none; }
}
```
For an extra "open" feel, animate a top-to-bottom red accent line on first paint (1px high, scaleX from 0 to 1 over 600ms) — minimal effort, signature look.

**Stat card pattern:**
```
+----------------------------------+
|  K/D RATIO                       |  ← --muted, uppercase, letter-spacing
|                                  |
|  1.34                            |  ← large mono numeral, --fg
|                                  |
|  ▲ +0.12 vs last 10              |  ← --accent for ▲, --muted for delta text
+----------------------------------+
```
- Background `var(--surface)`, 1px border `var(--border)`, 12px radius, 24px padding.
- Use a **monospace** font for numerals (great for grids of stats and easy to align right).
- Reserve `--accent` (dark red) for: positive deltas, rank tier badges, the entry-animation accent line, and focus rings — **not** as a fill background; it loses impact if overused.

**Font recommendations (Google Fonts):**
- **Headings/UI:** `Inter` (variable weight 400–700) — clean, neutral, perfect for dashboards.
- **Numerals/labels:** `JetBrains Mono` (400, 600) — gives stats an analytical, terminal-like feel that matches the gaming/competitive aesthetic; widely used together with Inter.
- Alternative gaming-leaning option: `Rajdhani` or `Chakra Petch` for headings if you want a more Valorant-y angular display face. Stick to **two families max**.

Load efficiently:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap">
```

---

## Details

### HenrikDev API endpoint cookbook
Authentication: header `Authorization: <YOUR_KEY>` on every request. Region is one of `eu`, `na`, `ap`, `kr`, `latam`, `br`. Platform is `pc` or `console`.

**Step 1 — Resolve account → puuid:**
```
GET https://api.henrikdev.xyz/valorant/v2/account/{name}/{tag}
→ data.puuid, data.region, data.account_level, data.card, data.platforms
```

**Step 2 — Current rank + RR:**
```
GET https://api.henrikdev.xyz/valorant/v2/mmr/{region}/{name}/{tag}
→ data.current.tier.name (e.g. "Diamond 1"), data.current.rr,
  data.current.last_change, data.current.elo,
  data.peak.tier.name, data.peak.season.short,
  data.seasonal[] (per-act wins/games/end_tier)
```

**Step 3 — Recent matches (rich data):**
```
GET https://api.henrikdev.xyz/valorant/v4/matches/{region}/{platform}/{name}/{tag}?mode=competitive&size=10
→ Array of matches. Each match contains:
  metadata: { map, mode, started_at, rounds_played, season }
  players[]: { puuid, name, tag, team_id, character (agent), stats:
    { score (=ACS×rounds), kills, deaths, assists,
      headshots, bodyshots, legshots, damage, ability_casts } }
  teams: { red: {has_won, rounds_won, rounds_lost}, blue: {...} }
  rounds[]: full round data including kill_events for KAST/first-blood derivation
```

**Step 4 — Lightweight career stats (alternative, less detailed):**
```
GET https://api.henrikdev.xyz/valorant/v1/lifetime/matches/{region}/{name}/{tag}
GET https://api.henrikdev.xyz/valorant/v1/by-puuid/lifetime/matches/{region}/{puuid}
```

**Derivations (in `utils/deriveStats.js`):**
- ACS (per match) = `player.stats.score / metadata.rounds_played`
- HS% = `headshots / (headshots + bodyshots + legshots)`
- ADR = `player.stats.damage.dealt / rounds_played` (newer schemas store `damage` as `{dealt, received}`)
- K/D = `kills / deaths` (guard divide-by-zero)
- Win = match where player's team `has_won === true`
- Per-agent rollup: `groupBy(matches, m => playerInMatch(m).character.name)` then aggregate

### Claude integration sketch (browser-direct mode)
```js
// services/claude.js
export async function analyzePerformance(playerSnapshot) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'anthropic-beta': 'structured-outputs-2025-11-13'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 800,
      temperature: 0.3,
      system: SYSTEM_PROMPT,                // see Section 3
      messages: [{
        role: 'user',
        content: `<player_stats>${JSON.stringify(playerSnapshot)}</player_stats>\nProduce the analysis now.`
      }],
      output_format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['summary','strengths','weaknesses','focus'],
          properties: {
            summary: { type: 'string' },
            strengths: { type: 'array', items: { type: 'string' }, maxItems: 4 },
            weaknesses: { type: 'array', items: { type: 'string' }, maxItems: 4 },
            focus: { type: 'array', items: { type: 'string' }, maxItems: 3 }
          }
        }
      }
    })
  });
  const data = await res.json();
  return JSON.parse(data.content[0].text);
}
```
Reshape `playerSnapshot` to be **small and pre-aggregated** (don't dump 10 raw matches × 100 KB each). Send something like:
```js
{
  player: { name, tag, region, level, card },
  rank: { current: 'Diamond 1', rr: 38, peak: 'Ascendant 1', last_change: 15, elo: 1538 },
  career: { games: 42, wins: 22, winrate: 0.524 },
  recent: { games: 10, kd: 1.18, acs_avg: 231, hs_pct: 0.27, adr: 142, fb_per_game: 1.4 },
  agents: [
    { name: 'Jett', games: 6, winrate: 0.66, kd: 1.4, acs: 252 },
    { name: 'Reyna', games: 3, winrate: 0.33, kd: 0.9, acs: 198 }
  ],
  last_matches: [
    { map: 'Ascent', agent: 'Jett', result: 'W 13-9', kda: '22/14/4', acs: 268 },
    /* ... */
  ]
}
```

### Zustand store sketch
```js
import { create } from 'zustand';
export const useAppStore = create((set) => ({
  player: null, rank: null, matches: [], analysis: null,
  loading: false, error: null,
  theme: localStorage.getItem('theme') || 'dark',
  setTheme: (t) => {
    localStorage.setItem('theme', t);
    document.documentElement.dataset.theme = t;
    set({ theme: t });
  },
  loadPlayer: async (name, tag) => {
    set({ loading: true, error: null });
    try {
      const account = await henrik.account(name, tag);
      const [rank, matches] = await Promise.all([
        henrik.mmr(account.region, name, tag),
        henrik.matches(account.region, 'pc', name, tag, { mode: 'competitive', size: 10 })
      ]);
      const snapshot = buildSnapshot(account, rank, matches);
      const analysis = await claude.analyzePerformance(snapshot);
      set({ player: account, rank, matches, analysis, loading: false });
    } catch (e) { set({ error: e.message, loading: false }); }
  }
}));
```

### vercel.json (serverless proxy variant)
```json
{
  "rewrites": [
    { "source": "/api/henrik/:path*", "destination": "/api/henrik" }
  ]
}
```
Then `api/henrik.js` reads `process.env.HENRIK_API_KEY` and forwards the request — keys stay off the client.

---

## Caveats

- **HenrikDev is unofficial.** The maintainer has stated it's not designed for production scale; Riot could (in theory) ask for it to be shut down. For a private friend-group app this is acceptable risk; do not build a paid product on it. Status page: `status.henrikdev.xyz`.
- **HenrikDev rate limits are shared globally** (the "global API limit") in addition to your per-key limit. If the global limit is hit you'll see 429s even when your personal allowance is fine. Plan for graceful retry + caching (e.g. cache match list in `localStorage` keyed by `name#tag` for 5 minutes).
- **KAST is not a first-class field.** Computing it accurately requires walking each round's `kill_events` to determine, per round per player, whether they had a kill, an assist, survived, or were traded. This is doable but adds ~50 lines of logic. Consider shipping v1 without KAST and adding it later.
- **Anthropic API key in the browser is exposed.** Anyone can open DevTools, copy the key, and use it. The `anthropic-dangerous-direct-browser-access` header literally has the word "dangerous" in it for a reason. Mitigations: spending limit on the Anthropic console, IP-restriction is **not** available for Anthropic keys, so the safer pattern is the serverless proxy. Same applies to the HenrikDev key (less catastrophic — worst case is rate-limit exhaustion).
- **Claude structured outputs are still in beta** (`anthropic-beta: structured-outputs-2025-11-13` header required). They work on Sonnet 4.5+ and Opus 4.1+ but do **not** work on older Claude 3.x models. If you don't want to depend on a beta header, fall back to tool-use with a single tool whose `input_schema` is your desired shape — it has been GA for over a year and produces equally reliable structured JSON.
- **Vercel Hobby (free) tier forbids commercial use.** If you ever monetize this app, switch plan or use Netlify (whose free tier permits commercial projects).
- **`VITE_*` env vars are public.** Multiple sources confirm: even if you mark them "secret" in the Vercel dashboard, anything inlined into the bundle is visible in the browser. The serverless function pattern is the only real way to keep keys server-side in a frontend-only stack.
- **Riot patches break the in-game API roughly every 2 weeks.** HenrikDev usually catches up within hours, but expect occasional `503` responses around patch days — surface a clean error state in the UI ("Riot API in maintenance, try again shortly") rather than a generic crash.
- **Tracker.gg API key the user holds is not useful here.** Their key is for their official program (which doesn't cover Valorant). Do not attempt to scrape `api.tracker.gg/api/v2/valorant/...` — it violates ToS, is Cloudflare-protected, and will be unstable.
- **`prefers-reduced-motion`:** Always wrap entry animations in `@media (prefers-reduced-motion: reduce)` to disable them — users with vestibular sensitivity should not be forced to see motion.
- **Theme flash:** Set the `data-theme` attribute on `<html>` from a tiny inline script in `index.html` *before* React mounts, otherwise users will briefly see the wrong theme on first paint.