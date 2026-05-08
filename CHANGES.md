# CHANGES

## Phase 1 — Scaffold
- Created Vite + React (no TypeScript) project using `create-vite@latest` with the `react` template.
- Installed only `zustand` as a production dependency beyond Vite defaults.
- Folder structure: `src/styles/`, `src/components/`, `src/services/`, `src/store/`, `src/utils/` — mirrors the spec exactly.
- `.env.local` holds `VITE_HENRIK_API_KEY` and `VITE_ANTHROPIC_API_KEY`; covered by `*.local` in `.gitignore`.
- Dev server verified running on port 5173 before proceeding.

## Phase 2 — Theme & Global Styles
- CSS custom properties defined in `src/styles/theme.css`: light (off-white/near-black/dark-red) and dark (pure-black/off-white/bright-red) via `[data-theme]` attribute on `<html>`.
- `src/styles/global.css`: full-viewport reset, `min-height: 100dvh`, no `overflow-x`, Inter font family on body.
- `src/styles/animations.css`: `rise-in` keyframe (opacity + translateY), `scale-x-in` for the red accent line, `opacity-pulse` for skeleton loading bars. Stagger delays at 55ms increments per child up to 7 items. All wrapped in `@media (prefers-reduced-motion: reduce) { animation: none }`.
- Theme flash prevention: inline `<script>` in `index.html` reads `localStorage` and sets `document.documentElement.dataset.theme` before React mounts.
- Fonts loaded via Google Fonts preconnect: Inter (400/500/600/700) + JetBrains Mono (400/600).

## Phase 3 — Henrik API Service
- `src/services/henrik.js`: three exported functions — `account()`, `mmr()`, `matches()`.
- `Authorization` header attached to every request using `import.meta.env.VITE_HENRIK_API_KEY`.
- 5-minute localStorage cache keyed by endpoint path. Cache entries store `{ data, ts }` and are evicted on read if stale.
- Error mapping: 429 → human rate-limit message, 503 → maintenance message, network fail → server unreachable, others → status code + API message.
- Calls go browser-direct to `api.henrikdev.xyz` — no proxy or backend needed at this scale.

## Phase 4 — Stat Derivation Utils
- `src/utils/deriveStats.js`: pure functions `calcACS`, `calcKD`, `calcHSPercent`, `calcADR`, `calcWinRate` — all guard divide-by-zero, return 0 instead of NaN.
- `buildSnapshot()` aggregates a full `matchesArray` (v4 schema) into a compact player object: `{ player, rank, career, recent, agents, lastMatches }`.
- Agent rollup: groups by `character.name`, accumulates kills/deaths/score/rounds/wins, returns top 3 by games played with per-agent K/D, ACS, win rate.
- Match result strings derived from `teams.blue/red.rounds_won` and player's `team_id`.
- `src/utils/format.js`: `formatKD`, `formatPercent`, `formatRR`, `formatDelta`, `formatACS` — thin display helpers.

## Phase 5 — Zustand Store
- `src/store/useAppStore.js`: single store holding `{ player, rank, matches, snapshot, analysis, loading, error, theme }`.
- `setTheme(t)`: writes to localStorage, sets `document.documentElement.dataset.theme`, updates state.
- `loadPlayer(name, tag)`: fetches account → parallel fetch of MMR + matches → `buildSnapshot` → `analyzePerformance` → set state. On any error: sets `error` message, clears `loading`, does not crash.

## Phase 6 — Claude AI Service
- `src/services/claude.js`: calls `claude-sonnet-4-5-20250929` with `anthropic-dangerous-direct-browser-access: true` for CORS.
- Used **tool_use** with a single `submit_analysis` tool (not the structured-outputs beta header) — this pattern has been GA for over a year and is more stable. Tool `input_schema` enforces `{ summary, strengths[], weaknesses[], focus[] }`.
- `tool_choice: { type: 'tool', name: 'submit_analysis' }` forces Claude to always call the tool — eliminates the need to parse free-form text.
- System prompt contains hard rules: only cite supplied numbers, no generic gaming phrases, every observation must reference a specific stat with its value.
- Temperature 0.3, max_tokens 800.
- Snapshot passed in a `<player_stats>` XML block to leverage Claude's XML structure training.

## Phase 7 — Components
- All colors reference CSS custom properties — zero hardcoded hex in any `.jsx` or component `.css` file.
- `SearchBar`: validates `#` presence before submitting, shows inline format error, red accent bottom-border on focus.
- `StatCard`: JetBrains Mono numerals, delta arrows (▲ in accent, ▼ in muted), omits delta if zero.
- `RankCard`: tier name, RR, last match delta with color, pure-CSS progress bar (no library), peak rank + season.
- `MatchRow`: 5-column grid (map/agent/result/KDA/ACS), 2px left border accent for wins, muted border for losses.
- `AgentBreakdown`: top-3 agents as flex cards that wrap on mobile, 2×2 stat grid per card.
- `AIAnalysis`: four sections rendered from tool_use output; CSS-only `opacity-pulse` skeleton bars while loading; error state in accent color.
- `ThemeToggle`: fixed top-right, JetBrains Mono text toggle, no icon library.

## Phase 8 — App Layout
- `App.jsx` owns all layout state: pre-search (centered), loading (skeleton dashboard), post-search (full dashboard).
- Pre-search: app name + tagline + SearchBar centered in full viewport.
- Post-search: header row → red accent line (scaleX animation) → 3-row dashboard grid.
  - Row 1: `grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr` — RankCard + 4 StatCards.
  - Row 2: `3fr 2fr` — match list left, AIAnalysis right.
  - Row 3: full-width AgentBreakdown.
- Loading state: skeleton cards maintain exact same grid layout as live data.
- Responsive: below 768px → 2-column row 1, single-column row 2. Below 480px → single column everything.
- All spacing via `--gap: 16px` CSS variable.

## Phase 9 — Final Checks
- Confirmed: `.env.local` exists, covered by `.gitignore`, zero API keys in source.
- Confirmed: zero Tailwind utilities, all color references use CSS custom properties.
- Confirmed: `prefers-reduced-motion` wraps all animation rules.
- Confirmed: no TODOs, placeholders, or unimplemented stubs.
- Dev server runs clean on Node 23 / npm 11 via `/opt/homebrew/bin` path.
- README generated with prerequisites, setup, env var descriptions, local dev, Vercel deploy, and custom domain DNS steps.
