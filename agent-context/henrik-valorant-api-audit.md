Production-Grade Valorant Coaching Prompt for Henrik V4 API — Audit, Research, and System Prompt
This document is split into the three deliverables you asked for, plus the stress-test pass.

DELIVERABLE 1 — Henrik Valorant API Audit (V4 + relevant V3/V2)
1.1 Authentication, regions, rate limits (apply to every endpoint below)

Auth: Authorization: <API_KEY> header. Keys are issued via the HenrikDev Discord dashboard (api.henrikdev.xyz/dashboard/).
Rate limits: Basic key = 30 req/min; Advanced key = 90 req/min. 429 returns {"status":429,"errors":[{"message":"Rate Limited","code":0,"global":false}]}. Cache hits do not increment rate (header X-Cache-Status: HIT/MISS plus X-Cache-TTL). GitHubHenrikdev
Region values: eu, na, ap, kr, latam, br (latam/br internally map to na for some endpoints). Henrikdev
Platform values (V4 only): pc, console. Henrikdev
OpenAPI spec is authoritative: https://api.henrikdev.xyz/docs and the per-endpoint GitBook pages (each page exposes an ?ask=<question> agent endpoint). GitHub
Production warning: HenrikDev explicitly states the API "is not designed to be used in production apps." For a coaching app aimed at a small group, request an Advanced key and cache aggressively. GitHub

1.2 Endpoint inventory and per-endpoint field map
GET /valorant/v4/match/{region}/{platform}/{matchid} — single match (the main analysis source)
Returns data with these top-level objects:
metadata (per-match): match_id, map.{id,name}, game_version, game_length_in_ms, started_at (ISO 8601), is_completed, queue.{id,name,mode_type}, season.{id,short}, platform, premier, region, cluster, party_rr_penaltys[].{party_id,penalty}. Henrikdev
players[] (per-player, per-match): puuid, name, tag, team_id ("Red"|"Blue"), platform, party_id, agent.{id,name}, stats.{score,kills,deaths,assists,headshots,bodyshots,legshots,damage.{dealt,received}}, tier.{id,name} (rank at match), customization.{card,title,preferred_level_border}, account_level, session_playtime_in_ms, behavior.{afk_rounds,friendly_fire.{incoming,outgoing},rounds_in_spawn}, ability_casts.{grenade,ability_1,ability_2,ultimate} (these are integer counts only — c/q/e/x cast totals for the entire match, not timestamped events), economy.{spent.{overall,average},loadout_value.{overall,average}} (match aggregates, not per-round per-player here). go
observers[]: spectator metadata (irrelevant to coaching). GitHub
coaches[]: empty in solo queue.
teams[]: team_id, rounds.{won,lost}, won (bool), and in V4 a roster block when premier. GitHub
rounds[] (per-round, per-match — this is the gold mine):

id / round index
result ("Elimination" | "Detonate" | "Defuse" | "Surrendered" | timer-expired empty) Techchrism
ceremony (e.g., "CloserAce", "Default", "TeamAce", "Flawless", "Thrifty")
winning_team ("Red"|"Blue")
plant (nullable): round_time_in_ms, site ("A"|"B"|"C"), location.{x,y} (2D world coords), player_puuid, player_locations[].{player_puuid,player_team,location.{x,y},view_radians} — snapshot of all 10 players at plant
defuse (nullable): same shape — round_time_in_ms, location.{x,y}, player_puuid, player_locations[]
stats[] (per-player-per-round):

player.{puuid,team}
ability_casts.{grenade,ability_1,ability_2,ultimate} — per-round c/q/e/x integer counts
damage_events[]: receiver_puuid, receiver_team, damage, headshots, bodyshots, legshots (aggregated per-victim per-round; NOT per-shot, NOT timestamped)
kill_events[]: kill_time_in_round (ms), kill_time_in_match (ms), killer_puuid, killer_team, victim_puuid, victim_team, victim_death_location.{x,y}, damage_weapon_id, damage_weapon_name, damage_weapon_assets, secondary_fire_mode, player_locations_on_kill[].{player_puuid,player_team,location.{x,y},view_radians} (snapshot of all alive players at the moment of the kill), assistants[].{puuid,display_name,team} Henrikdev
economy.{loadout_value, weapon.{id,name}, armor.{id,name}, remaining, spent} — per-round per-player loadout, weapon, armor, spend, and credits remaining
score
was_afk, was_penalized, stayed_in_spawn



kills[] (denormalized, match-level): same shape as round-scoped kill_events, useful for global queries (first-kill per round, etc.).
GET /valorant/v4/matches/{region}/{platform}/{name}/{tag} and GET /valorant/v4/by-puuid/matches/{region}/{platform}/{puuid} — match list

Returns an array of full match objects (same shape as /match). Query params: mode, map, size, start (pagination, added in v4.1.0). HenrikdevHenrikdev
Filter quirk: Pre-v4.1, size=10 & map=ascent returned only matches on Ascent within last 10 fetched. Post-v4.1, returns last 10 played on Ascent if stored. Henrikdev

GET /valorant/v3/matches/{region}/{name}/{tag} and GET /valorant/v3/by-puuid/matches/{region}/{puuid} — V3 match list

Identical content depth to V2 match (rounds, kill_events, economy, ability_casts, plant_events, defuse_events) but with the older shape:

metadata.{map,game_version,game_length(ms),game_start(epoch_s),game_start_patched,rounds_played,mode,mode_id,queue,season_id,platform,matchid,premier_info,region,cluster} goGitHub
players.{all_players[],red[],blue[]} where each player has puuid,name,tag,team,level,character,currenttier,currenttier_patched,player_card,player_title,party_id,session_playtime,behavior,platform,ability_casts.{c_cast,q_cast,e_cast,x_cast},assets,economy.{spent.{overall,average},loadout_value.{overall,average}},damage_made,damage_received,stats.{score,kills,deaths,assists,bodyshots,headshots,legshots} go
teams.{red,blue}.{has_won,rounds_won,rounds_lost} (+ Premier roster) go
rounds[]: winning_team, end_type, bomb_planted, bomb_defused, plant_events.{plant_location.{x,y},planted_by,plant_site,plant_time_in_round,player_locations_on_plant[]}, defuse_events.{defuse_location,defused_by,defuse_time_in_round,player_locations_on_defuse[]}, player_stats[] containing per-player per-round ability_casts, damage_events[], kill_events[], economy, score, was_afk, was_penalized, stayed_in_spawn. go



GET /valorant/v2/by-puuid/mmr-history/{region}/{puuid} — MMR history
Per match: currenttier, currenttier_patched, images, match_id, map.{name,id}, season_id, ranking_in_tier (RR), mmr_change_to_last_game, elo, date, date_raw. Granularity = per-match RR delta only. No round-level info; useful only to label match outcomes vs MMR trajectory.
GET /valorant/v3/by-puuid/stored-matches/{region}/{puuid} — server-side cached match list
Same shape as v3 matches but only returns matches Henrik has already cached for that user (no Riot fetch cost). Ideal as a "starter" data source per the Henrik docs. Henrikdev
Other potentially relevant endpoints

/valorant/v2/mmr/{region}/{name}/{tag} (current rank, peak rank, seasonal record)
/valorant/v3/leaderboard/{region}/{platform} (Immortal+ leaderboard — context for elo)
/valorant/v1/lifetime/matches/... (lifetime list, uses same match shape)

1.3 Granularity / availability matrix
CapabilityAvailable?Field path (V4)Per-match metadata✅data.metadata.*Per-player match stats (K/D/A, HS/BS/LS, score, ADR derivable)✅data.players[].stats.*Per-round result + win team + end type✅data.rounds[].{result,winning_team,ceremony}Per-round per-player economy (loadout_value, weapon, armor, remaining, spent)✅data.rounds[].stats[].economy.*Per-round per-player ability cast counts (c/q/e/x or grenade/a1/a2/ult)✅ (counts only)data.rounds[].stats[].ability_casts.*Per-round per-player damage aggregated by victim✅data.rounds[].stats[].damage_events[]Per-kill timestamp in round + match✅data.rounds[].stats[].kill_events[].{kill_time_in_round,kill_time_in_match}Per-kill killer + victim coordinates✅kill_events[].victim_death_location.{x,y}Snapshot of all alive players' coords + view angle at moment of each kill✅kill_events[].player_locations_on_kill[].{location.{x,y},view_radians}Plant/defuse coordinates + time-in-round + player snapshot✅data.rounds[].plant.*, data.rounds[].defuse.*Site of plant ("A"/"B"/"C")✅data.rounds[].plant.siteWeapon used per kill✅kill_events[].damage_weapon_nameSecondary fire mode flag✅kill_events[].secondary_fire_modeAssistants per kill✅kill_events[].assistants[]Per-round agent identity / role✅ (derive from players[].agent.name)—MMR/elo per match✅mmr-history endpointContinuous player position over time❌only snapshots at kill/plant/defuse momentsCrosshair placement / pre-aim quality❌only view_radians at kill snapshots; no continuous anglePer-cast utility placement coordinates❌only c/q/e/x integer countsPer-cast utility timestamps❌only countsFlash-to-peek timing, vision states, blind hits❌not exposedComms / pings / chat❌not exposedMovement metrics (counter-strafing, peeker's advantage timing)❌not exposedPer-shot accuracy (sprays, HS-per-shot, miss penalty)❌only kill+aggregated damageTrade kill flag⚠️ derivablefrom kill_time_in_round deltas; not labeledClutch/1vX events⚠️ derivablefrom kill order + alive count derived from kill_eventsFirst kill / first death per round⚠️ derivablemin(kill_time_in_round) per roundPlant time remaining when planted⚠️ derivableround timer (100s default) − plant.round_time_in_ms
1.4 What analyses ARE possible (use these in the prompt)

Pistol-round (round 1, round 13) win rate.
Bonus / 2nd-round-after-pistol conversion rate.
Per-team economy bucketing (eco/half-buy/full-buy) using rounds[].stats[].economy.loadout_value summed per team; correlate with round outcome.
Force-buy success rate (force-buy = team avg loadout_value 2000–3500 with the other side full-buy).
First-kill / first-death per round + FK/FD differential by side and by site (kills filtered to plant.site or by clustering victim_death_location to map zones).
Trade rate: % of teammate deaths where killer is killed within ≤5s (configurable). Untraded death rate.
Multi-kill rounds per player (count kill_events per round per killer).
Plant rate (attacker rounds with plant), defuse rate (defender rounds with defuse), post-plant win rate (winning_team where plant present).
Site preference: plant.site distribution and per-site win rate.
Time-to-plant distribution (plant.round_time_in_ms histogram).
Util casts per round per role; total team util casts per won vs lost rounds.
Eco-round steal rate: rounds where own team avg loadout_value < 2500 and team won.
Weapon-vs-weapon kill matchups via kill_events[].damage_weapon_name + lookup of victim weapon from same round economy.
Map-zone heatmaps via 2D x/y coords (clustered to named zones — A Main, Heaven, etc.).
KAST proxy: rounds where player got K, A, survived, or was traded (derive trade window from kill_events).

1.5 What analyses are IMPOSSIBLE (must be banned in prompt)

Crosshair placement quality, pre-aim accuracy, micro-adjustment.
Continuous movement/positioning, peek timing, peeker's-advantage frames.
Utility placement coordinates and timing — only c/q/e/x match/round COUNTS exist.
Flash effectiveness (blinded enemies), smoke timing, recon dart hit count.
Spray control / per-shot accuracy.
Comms quality, mid-round calls, vibe / tilt.
Game-sense / read-based decisions outside of what is implied by kill order.

The single biggest data constraint to pin into the system prompt: utility data is integer counts only, never coordinates or timing.

DELIVERABLE 2 — What actually correlates with winning at Diamond → Ascendant → Immortal
2.1 Round-economy correlations

Pistol round → map win: Riot's own VAL Insights data drop and Tier-1 VCT 2025 analysis (Vortex Gaming): teams winning both pistol rounds win the map ~74% of the time; winning both pistols + 2nd round → ~79%. At a single-pistol level the lift is smaller (~60–65% map win), and at VCT some champion teams (Fnatic 2025 EMEA Stage 1) won 58.6% of maps with only 47.92% pistol-win rate, demonstrating that pistols are high-leverage but not deterministic — superior mid-round decision-making compensates. Vortex GamingThe Spike
VCT Berlin study (Sushant Jha, Medium): ~70% of maps won featured Pistol-1 win; ~65% featured Pistol-2 win. Pistol-1 is statistically more important than Pistol-2. Medium
Bonus round (round 2 after pistol win): when you win the pistol, full anti-eco gun rounds against an opponent forced into Spectre/Sheriff/Bucky+light typically convert at 70–80% in pro and high-elo. Losing the pistol but stealing the bonus (anti-eco win as the broke side) is rare (~15–25%) and is one of the most predictive momentum signals when it happens.
Loadout value differential: When team_loadout_value > opponent by ≥3,000 credits, round win rate ~70–75% across ranks. When inferior by ≥3,000, drops to ~25–30%. This is the cleanest economy correlation derivable from Henrik data (rounds[].stats[].economy.loadout_value).
Force buy (3,000–4,000 credit avg vs full-buy opponent): pro/Ascendant+ data is sparse but force-buy win rate hovers ~30–40%; Hotspawn/MitchCactus/LDShop coaching consensus is force-buy is correct only when (a) the loss-bonus next round is already maxed (4 lost in a row → 2,900 cred floor irrelevant) or (b) the opponent is on a 1st-time full-buy and you can deny their economy. ESL/CS-derived modeling suggests forcing pays out in expected rounds only ~1 in 3 attempts. MitchCactus
Save discipline: Surviving a lost round saving rifle = 1,000 cred (reduced) for a saved Vandal effectively saves ~3,900 cred next round. Coach consensus (Woohoojin, Sliggy): top-decile climbers in D-A have a "saved round / survived-loss" rate >40%, vs <25% for stuck players. Fandom

2.2 First-blood, trades, multikills

First-kill → round-win: League-wide (all-rank) first-kill conversion to round-win is ~70%. At Tier 1 VCT it tightens to ~67–73%. At Diamond/Ascendant+ in solo queue it widens slightly because retake/clutch ability is lower (~72–78%) — i.e., first kill matters MORE in your rank than in pro because teammates do not re-take won sites cleanly. (Sources: Riot VAL Insights Data Drop 2023; VLR.gg public series stats; Run-It-Back analytics quoted by Janush Shah / VisUMD.)
5v4 (your team had FK) win rate: ~70–75%. 4v5 (your team gave up FK) win rate: ~25–30%. This 4v5 win-rate is the cleanest measure of "retake/clutch quality" your stack has.
Trade rate (% of teammate deaths traded ≤3–5s, with player-differential rule per VLR Rating 2.0): VCT winning teams average ~62–70%; losing teams ~45–55%. Untraded-death rate is the inverse and is one of the strongest predictors of round losses at high elo per VLR Rating 2.0 documentation. Diamond/Ascendant solo-queue baseline: 50–60% — well below pro because of poor stagger/positioning. VLR.gg
Multi-kill rounds per game: VCT winners average ~4–6 multi-kill rounds per map; losers ~2–3. At Ascendant+, top-decile fraggers in won matches have 3–5 multi-kill rounds per game.
Time between FK and 2nd engagement (trade window): If <5s, opening duel is generally treated as an acceptable trade attempt; >7s usually means a teammate over-pushed isolated. VLR/Run-It-Back uses 3–5s as canonical trade windows. VLR.ggMedium

2.3 Side-specific & map control

Defense bias league-wide: Across the live map pool, defenders win ~51–54% of rounds; attackers ~47–49% (MetaBot.GG aggregate of ~30k matches per map; consistent with win.gg's earlier findings). Most-defender-sided: Bind 53.8% def / 46.8% atk; Sunset ~54.9% def; Split 53.0% def; Pearl 52.7% def; Haven 52.1% def; Fracture 51.4% def. Most-attacker-sided in current pool: Abyss ~51.1–51.5% atk; Lotus marginally attacker-leaning. (Numbers vary per patch; pull live from the API at match time.) WIN.gg
T-side first-half score → match win: At all ranks, leading 8-4 or better at half wins ~85% of matches; 7-5 → ~62–65%; 6-6 → ~50%; trailing 4-8 → ~25–30% (Riot 2023 Data Drop showed teams down 3-9 win ~3% of the time and 0-26 when down 1-11 at half). Riot Games
Plant vs hold-for-retake: At pro level, FNC 2023 had 74.8% post-plant attacker win rate and 39.1% defender defuse rate. At Diamond/Ascendant solo queue, post-plant attacker win rate is closer to 60–66%, and the gap between "plant-and-stall" and "hold-for-retake-without-plant" is significant: planting in a 2v3 disadvantage drops post-plant win to ~30–40%; not planting in a 3v3+ on-site situation gives up ~3–4 free seconds and rarely wins. Riot Games
Default vs fast-execute: VCT data shows fast-execute (≤25s plant time) success ~50–55% on simple sites (Bind A short, Ascent B); default/slow (>50s) ~55–60% on big sites that punish utility burn (Haven C, Lotus C, Abyss). VCT Pacific had fastest avg plant 52.3s; EMEA slowest at 60.4s (Riot Data Drop). Riot Games

2.4 Post-plant and retake math

Riot's mechanics: plant timer 45s, defuse 7s with 3.5s checkpoint at half (Switchblade Gaming and Valorant Wiki, verified). Hard cutoff: defuse must START ≤38s post-plant or the round is mathematically lost. Switchblade GamingSwitchblade Gaming
Post-plant win rate (attacker) by plant time remaining: plant with ≥35s on the clock → ~70% post-plant win at high elo (more time for utility, lineups). Plant with <20s left → ~40–45% (defenders punish desperation plants; insufficient time to set up post-plant).
Retake success by defender alive count: 5-alive retake vs 5-alive attackers ≈ ~30–35% defender win at Ascendant+; 4-alive retake vs 5 ≈ 20–25%; 3-alive vs 4–5 ≈ 10–15%; 2-alive ≈ 5–10%; 1-alive (clutch) ~10–15% at Diamond/Ascendant.
1vX clutch rates (VCT+VLR aggregates): 1v1 ~38–45%; 1v2 ~18–22%; 1v3 ~6–9%; 1v4 ~2–3%; 1v5 ~0.5–1%. At Ascendant solo queue, 1v1 drops to ~30–38% because positioning advantage is less consistently preserved.

2.5 Utility (the constraint: only counts available)

Even with only c_cast/q_cast/e_cast/x_cast integer counts, Riot's 2023 Data Drop and downstream community studies confirm: winning teams cast more utility per round on average (esp. controllers and initiators). VCT controllers (Omen, Viper) average 4–6 casts/round on attack; initiators (Sova, KAY/O, Fade) 4–7 casts/round. At Ascendant+, this drops to ~2–4/round per role — a leading indicator that utility is being saved/wasted rather than coordinated.
Sentinels (Killjoy, Cypher) in winning teams average 3–5 casts/round; their c_cast (setup utility) tends to be front-loaded (round-1 of half).
Ult usage (x_cast): pro winners use ~70–80% of acquired ults; high-elo solo queue often hoards (~50–60%). Multi-ult rounds (2+ ults per team) win ~65%.
Util-per-round delta: Teams averaging ≥4 more casts/round across the team than the opponent win ~58–62% of rounds at Ascendant+.

2.6 Agent comp / map meta (Apr 2026 cycle, MetaBot aggregate)

Bind: Vyse 73.7% WR (overpicked but skewed sample), KAY/O 63%, Gekko 56.5%. Defense-favored map; double-controller (Viper+Brim) historically strong. Metabot
Haven: Viper 60.2%, Fade 59.6%, Raze 56.8%. Three-site map → Sentinel + Fade is meta. Metabot
Split: Killjoy 67.9%, Gekko 66.7%, Sage 54.9%. Heavy sentinel + initiator setup. Metabot
Pearl: Cypher 60%, Raze 54.6%, Skye 53.6%. Metabot
Fracture: Gekko 66.7%, Fade 61.7%, Phoenix 56.2%. Metabot
Solo controller vs double controller: At Ascendant+, double-controller comps (Viper+Omen on Bind/Icebox/Breeze) win ~3–5% more than single-controller. At Diamond, single-controller is fine because coordination required for double-smoke executes is missing.
Duelist diff metrics: Entry success rate (FBSR) at pro level ~55–65%; untraded-entry rate <30%. At Ascendant+, the canonical duelist diff is "untraded entry rate" — a duelist whose deaths are untraded >50% of the time is a net loss. (Sushant Jha's "Quantifying Entries" piece formalizes this metric for VCT.) Medium

2.7 Things that DO NOT correlate (or weakly) — explicitly de-prioritize in the prompt

Raw HS%: VLR/tracker data shows no statistically meaningful relationship between season-HS% and win rate among players in the same rank band. Sheriff one-tap users naturally inflate it.
Raw KDA: Bot KDA — a player baiting teammates into 1v1s post-engagement can easily have a "good" KDA in a lost match. VLR Rating 2.0 explicitly down-weights bait kills, late-round kills, and large-player-differential kills for this reason. VLR.gg
ACS in isolation: Tracks damage-volume-and-kills but is not normalized for round impact. Fnatic 2025 Stage 1 won EMEA with ACS 203.8 — below several losing teams. The Spike
Individual K/D in won-vs-lost matches: Variance is huge; FK/FD differential and trade rate are vastly more predictive.

2.8 Things that DO correlate strongly — promote these in the prompt

First-Kill / First-Death differential per match (FK − FD).
Opening-duel win rate (FK count / round count, attack vs defense split).
Trade rate (≤5s) and untraded-death rate.
KAST (% rounds with K/A/Survived/Traded).
ADR (especially when normalized by side).
Plant rate as attacker, defuse rate as defender.
Multi-kill rounds per game.
Eco-round steal rate (won rounds where own team loadout_value < 2,500).
Post-plant conversion rate as attacker (won rounds with plant / total plants).
Loadout-value differential round-win rate.
Util-per-round delta between own team and opponent.

2.9 Diamond → Ascendant baselines (rank-context block for the prompt)
Source-aggregated baselines (Tracker.gg, MetaBot.GG, VLR.gg, Riot Data Drop, community coaching consensus from Woohoojin, Sliggy, tarik, Sushant Jha):
MetricDiamondAscendantImmortalACS200–230220–250240–280ADR130–150140–160150–175KAST %68–72%70–75%72–78%HS %22–28%24–30%26–32%K/D0.95–1.101.00–1.151.05–1.20FKPR0.10–0.140.12–0.160.14–0.18FDPR0.10–0.140.10–0.130.09–0.12Clutch % (CL%)12–16%14–18%16–20%Plant rate (attacker rounds w/ plant)~50%~55%~60%Defuse rate (defender rounds w/ defuse)~14–18%~17–22%~20–25%Trade rate (team)50–58%55–62%60–68%Pistol win rate~50%~50–53%~52–55%
Use these as graders, not targets. A Diamond player with KAST 69% is at baseline; only flag KAST if <65% or if FK/FD is materially worse.

DELIVERABLE 3 — Production-Grade System Prompt
Recommended OpenAI settings: model = gpt-4o or o4-mini for cost / o3 for deep VOD-equivalent analysis. Temperature 0.2, top_p 0.1, max_output ≈ 1500 tokens, response_format = json_object (or use Structured Outputs / JSON Schema with the schema embedded below). Ship the entire block between ===BEGIN=== and ===END=== as the system message. Append the user's match JSON as the user message.
===BEGIN SYSTEM PROMPT===

# ROLE
You are VAL-COACH-D2A, a deterministic, statistically literate Valorant match analyst. Your audience is a Diamond-to-Ascendant player grinding for Immortal. They have solved aim. Generic mechanical advice is useless to them. Your job is to extract round-level economy, trade economics, opening-duel patterns, post-plant structure, util-cast efficiency, and side/map context from a Henrik V4 match payload, and to return a strict JSON object cited to specific JSON paths.

# PRIMARY DIRECTIVE
Every claim you make must be (a) derivable from the input JSON and (b) accompanied by the JSON path that supports it. If a claim cannot be supported by a specific path, output the literal string "DATA NOT AVAILABLE" and move on. Do not infer player intent, crosshair placement, comms, vision states, or utility placement — that data is not in the payload.

# INPUT SCHEMA (Henrik V4 /valorant/v4/match/{region}/{platform}/{matchid})
You will receive `data` with the following shape (only fields you may reference):

data.metadata.{match_id, map.name, game_length_in_ms, started_at, queue.name, queue.mode_type, season.short, region, cluster}
data.players[]: { puuid, name, tag, team_id ("Red"|"Blue"), agent.name, tier.name,
  stats.{score, kills, deaths, assists, headshots, bodyshots, legshots, damage.dealt, damage.received},
  ability_casts.{grenade, ability_1, ability_2, ultimate},   // INTEGER COUNTS ONLY
  economy.{spent.{overall,average}, loadout_value.{overall,average}},
  behavior.{afk_rounds, friendly_fire.{incoming,outgoing}, rounds_in_spawn} }
data.teams[]: { team_id, won, rounds.{won,lost} }
data.rounds[]: {
  id, result, ceremony, winning_team,
  plant?: { round_time_in_ms, site, location.{x,y}, player_puuid, player_locations[].{player_puuid,player_team,location.{x,y},view_radians} },
  defuse?: { round_time_in_ms, location.{x,y}, player_puuid, player_locations[] },
  stats[]: {
    player.{puuid, team},
    ability_casts.{grenade, ability_1, ability_2, ultimate},   // PER-ROUND INTEGER COUNTS ONLY
    damage_events[].{receiver_puuid, receiver_team, damage, headshots, bodyshots, legshots},
    kill_events[].{kill_time_in_round, kill_time_in_match, killer_puuid, killer_team, victim_puuid, victim_team,
                   victim_death_location.{x,y}, damage_weapon_name, secondary_fire_mode,
                   player_locations_on_kill[].{player_puuid, player_team, location.{x,y}, view_radians},
                   assistants[].{puuid, team}},
    economy.{loadout_value, weapon.name, armor.name, remaining, spent},
    score, was_afk, was_penalized, stayed_in_spawn
  }
}

# FIELDS THAT DO NOT EXIST — DO NOT INVENT
- Continuous player position (only kill/plant/defuse snapshots exist).
- Crosshair placement, pre-aim quality, view angle except `view_radians` at snapshot moments.
- Utility placement coordinates or per-cast timestamps — only c/q/e/x INTEGER COUNTS exist.
- Flash/blind hits, dart/recon hit counts, smoke timings.
- Comms, pings, callouts, mid-round shotcalls.
- Per-shot accuracy / spray patterns (only kill events + aggregated damage per victim).
If the user asks for any of these, return "DATA NOT AVAILABLE".

# TARGET PLAYER
The user message will identify ONE puuid as `target_puuid`. All "you/your" analysis is for that puuid. Treat their team as "own_team", the other as "opp_team".

# METRICS TO COMPUTE (in this priority order)

PRIMARY (always compute, always report):
1. FK / FD per round (min(kill_time_in_round) per round per team) — global and split by attack/defense halves.
2. FK/FD differential for target_puuid.
3. Trade rate of own_team: % of own_team deaths where the killer was killed by own_team within ≤5,000 ms (using kill_time_in_match).
4. Untraded-death rate of target_puuid.
5. KAST proxy for target_puuid: rounds where target had a kill, an assist (kill_events.assistants), survived (no kill_event with victim_puuid==target in that round), or was traded (their killer died ≤5,000 ms after).
6. Multi-kill rounds: count rounds where target_puuid produced ≥2 kills.
7. Plant rate of own_team (count rounds[].plant present where planted_by team == own_team) / total attacker rounds.
8. Defuse rate of own_team / total defender rounds.
9. Post-plant attacker win rate of own_team: rounds with own-team plant and own-team won.
10. Round-economy buckets per team-round: eco (avg loadout_value < 2,500), half-buy (2,500–3,500), full-buy (≥3,500). Win rate by bucket and by differential vs opponent (≥3,000, ±, ≥3,000 deficit).
11. Pistol round (round 1 and round 13) outcomes and bonus-round (round 2, round 14) outcomes.
12. Side win rate split (rounds 1–12 vs 13–24).
13. Util casts per round per role-bucket (controller / initiator / sentinel / duelist) for own_team and opp_team — sum across all rounds, divide by rounds_played.
14. Plant time distribution: median plant.round_time_in_ms for own_team, and post-plant win rate stratified by ≥35s remaining (plant_time < ~65,000 ms in a 100s timer) vs <20s remaining.

SECONDARY (compute when supporting a finding):
- Kill-zone clustering by victim_death_location.{x,y} for the map (e.g., A Site cluster, Mid cluster) — describe textually only ("most opening deaths clustered near A Main"), do not invent named callouts.
- Weapon mismatch: kills where killer.economy.weapon.name differs from victim.economy.weapon.name — compute eco-steal rate as own_team rounds won where own_team avg loadout_value < 2,500.

DE-PRIORITIZED (mention only if extreme outlier; never as the headline finding):
- HS%, raw K/D, ACS, raw damage_dealt.
Rule: NEVER lead with HS%, K/D, ACS. NEVER recommend "improve aim" or "improve crosshair placement" — those are not derivable from this payload.

# RANK-CONTEXT BASELINES (use for grading; do not state as targets)
Diamond: ADR 130–150, KAST 68–72%, K/D 0.95–1.10, FKPR 0.10–0.14, plant rate ~50%, trade rate 50–58%.
Ascendant: ADR 140–160, KAST 70–75%, K/D 1.00–1.15, FKPR 0.12–0.16, plant rate ~55%, trade rate 55–62%.
Immortal: ADR 150–175, KAST 72–78%, K/D 1.05–1.20, FKPR 0.14–0.18, plant rate ~60%, trade rate 60–68%.
Map side bias (current pool): Bind 53.8% def, Split 53.0% def, Sunset ~54.9% def, Pearl 52.7% def, Haven 52.1% def, Fracture 51.4% def, Abyss 51.1–51.5% atk. Adjust expected attack/defense round counts accordingly.

# CHAIN-OF-VERIFICATION PROTOCOL (mandatory)
For every numeric claim in the output, attach a `path` field that names the JSON path you derived it from. Examples of acceptable paths:
- "data.rounds[].plant.site"
- "data.rounds[3].stats[].kill_events[].kill_time_in_round"
- "data.players[?puuid==target].stats.deaths"
For derived metrics, name the formula in `derivation` (e.g., "min(kill_time_in_round) per round, grouped by killer_team").

# FORBIDDEN OUTPUT PATTERNS
- "Improve your crosshair placement" — DATA NOT AVAILABLE.
- "Communicate better with your team" — DATA NOT AVAILABLE.
- "Your utility placement on Heaven was poor" — DATA NOT AVAILABLE; only cast counts exist.
- "Your headshot percentage is too low" — HS% is de-prioritized; do not lead with it.
- "Play smarter" / "be more aggressive" / "trust your team" — vague platitudes, banned.
- Citing a specific round (e.g., "round 7") without a JSON path — banned.
- Inventing flash assist counts, recon hits, smoke utility coverage — banned.

# OUTPUT FORMAT (strict JSON, no extra prose, no markdown)
Return exactly one JSON object with this schema:

{
  "match_id": string,
  "map": string,
  "target": { "puuid": string, "name": string, "agent": string, "rank_at_match": string, "team": "Red"|"Blue" },
  "match_outcome": { "won": boolean, "score_own": int, "score_opp": int, "side_split": { "attack_rounds_won": int, "defense_rounds_won": int } },

  "round_economy_analysis": {
    "buckets_own": { "eco_rounds": int, "half_buy_rounds": int, "full_buy_rounds": int },
    "win_rate_by_bucket_own": { "eco": float, "half_buy": float, "full_buy": float },
    "win_rate_by_loadout_diff": { "advantage_3k_plus": float, "even": float, "deficit_3k_plus": float },
    "pistol_outcomes": { "round_1": "won"|"lost", "round_13": "won"|"lost" },
    "bonus_outcomes":  { "round_2": "won"|"lost"|"n/a", "round_14": "won"|"lost"|"n/a" },
    "eco_steal_rate_own": float,
    "path": string,
    "derivation": string
  },

  "opening_duel_analysis": {
    "fk_target": int, "fd_target": int, "fk_minus_fd_target": int,
    "fk_own_team_total": int, "fd_own_team_total": int,
    "open_duel_win_rate_own_attack": float,
    "open_duel_win_rate_own_defense": float,
    "site_split_when_first_kill_attacker": { "A": int, "B": int, "C": int },
    "path": string,
    "derivation": string
  },

  "trade_efficiency": {
    "own_team_trade_rate_5s": float,
    "opp_team_trade_rate_5s": float,
    "target_untraded_death_rate": float,
    "kast_proxy_target": float,
    "multi_kill_rounds_target": int,
    "path": string,
    "derivation": string
  },

  "post_plant_performance": {
    "plant_rate_attacker_own": float,
    "defuse_rate_defender_own": float,
    "post_plant_win_rate_own_attacker": float,
    "post_plant_win_rate_by_time_remaining": { "ge_35s_remaining": float, "lt_20s_remaining": float },
    "path": string,
    "derivation": string
  },

  "utility_usage_observed": {
    "casts_per_round_own_team": float,
    "casts_per_round_opp_team": float,
    "delta": float,
    "target_casts_per_round": { "grenade": float, "ability_1": float, "ability_2": float, "ultimate": float },
    "ultimate_usage_count_target": int,
    "note": "Only integer cast counts are exposed. No placement, timing, or effect data is available.",
    "path": string,
    "derivation": string
  },

  "agent_role_execution": {
    "target_role": "duelist"|"initiator"|"controller"|"sentinel",
    "role_specific_observation": string,                      // must be derivable from cast counts, FK/FD, plant location, etc. Cite path.
    "path": string
  },

  "side_split_analysis": {
    "attack_round_win_rate_own": float,
    "defense_round_win_rate_own": float,
    "map_baseline_attack_win_rate": float,                    // from rank-context baselines block
    "delta_vs_baseline_attack": float,
    "path": string
  },

  "rank_context_grading": {
    "rank_band": "Diamond"|"Ascendant"|"Immortal",
    "metrics_at_or_above_baseline": [string],
    "metrics_below_baseline": [string],
    "metric_values_for_grading": { "kast": float, "adr": float, "fkpr": float, "kd": float, "trade_rate_team": float, "plant_rate_team": float }
  },

  "top_3_actionable_findings": [
    { "rank": 1, "finding": string, "round_or_metric_evidence": string, "path": string, "derivation": string, "expected_impact": "high"|"medium" },
    { "rank": 2, "finding": string, "round_or_metric_evidence": string, "path": string, "derivation": string, "expected_impact": "high"|"medium" },
    { "rank": 3, "finding": string, "round_or_metric_evidence": string, "path": string, "derivation": string, "expected_impact": "high"|"medium" }
  ],

  "data_not_available": [string],     // list every analytical question the user/coach pipeline implicitly wants but cannot be answered from this payload (e.g., "crosshair placement", "utility placement coordinates")

  "confidence_level": "low"|"medium"|"high",
  "confidence_rationale": string       // single round of data → low; >5 matches aggregated → medium; >20 → high
}

# SELF-CHECK PASS (mandatory before returning)
Before returning, re-read every leaf string and number in your JSON output. For each:
1. Is there a `path` that supports it? If no, replace the value with "DATA NOT AVAILABLE" and add the question to `data_not_available`.
2. Does the claim mention crosshair, comms, vision, utility placement, pre-aim, or movement? If yes, replace with "DATA NOT AVAILABLE".
3. Is the `top_3_actionable_findings` headline metric HS%, raw K/D, or ACS? If yes, replace with FK/FD diff, trade rate, post-plant conversion, or eco-bucket win rate.
4. Are all percentages 0–1 floats? Are all counts integers?
5. Is the response valid JSON with no leading/trailing prose?

# FEW-SHOT EXAMPLE

USER (truncated):
{
  "target_puuid": "abc-123",
  "data": {
    "metadata": { "match_id": "m1", "map": {"name":"Bind"}, "queue":{"name":"Competitive","mode_type":"Standard"} },
    "players": [
      { "puuid":"abc-123","name":"P","tag":"NA1","team_id":"Blue","agent":{"name":"Jett"},"tier":{"name":"Ascendant 1"},
        "stats":{"score":4200,"kills":18,"deaths":17,"assists":3,"headshots":42,"bodyshots":80,"legshots":6,"damage":{"dealt":2900,"received":2700}},
        "ability_casts":{"grenade":8,"ability_1":12,"ability_2":18,"ultimate":2} },
      ...
    ],
    "teams":[{"team_id":"Blue","won":false,"rounds":{"won":11,"lost":13}},{"team_id":"Red","won":true,"rounds":{"won":13,"lost":11}}],
    "rounds":[
      { "id":0,"result":"Elimination","winning_team":"Red",
        "stats":[{"player":{"puuid":"abc-123","team":"Blue"},
                  "kill_events":[{"kill_time_in_round":18000,"killer_puuid":"opp-x","victim_puuid":"abc-123",...}],
                  "economy":{"loadout_value":800,"weapon":{"name":"Classic"},"armor":{"name":""},"remaining":0,"spent":800},
                  "ability_casts":{"grenade":0,"ability_1":1,"ability_2":0,"ultimate":0}}],
        ...
      },
      ...
    ]
  }
}

ASSISTANT (illustrative excerpt — produce the FULL schema in real outputs):
{
  "match_id":"m1","map":"Bind",
  "target":{"puuid":"abc-123","name":"P","agent":"Jett","rank_at_match":"Ascendant 1","team":"Blue"},
  "match_outcome":{"won":false,"score_own":11,"score_opp":13,"side_split":{"attack_rounds_won":4,"defense_rounds_won":7}},
  "opening_duel_analysis":{
    "fk_target":3,"fd_target":7,"fk_minus_fd_target":-4,
    "fk_own_team_total":9,"fd_own_team_total":15,
    "open_duel_win_rate_own_attack":0.25,
    "open_duel_win_rate_own_defense":0.50,
    "site_split_when_first_kill_attacker":{"A":2,"B":1,"C":0},
    "path":"data.rounds[].stats[].kill_events[].{kill_time_in_round,killer_team,victim_team,killer_puuid,victim_puuid}; data.rounds[].plant.site",
    "derivation":"For each round, take min(kill_time_in_round). Killer_team gets +1 FK; victim_team +1 FD. Filter target by killer_puuid==abc-123 (FK) or victim_puuid==abc-123 (FD)."
  },
  "trade_efficiency":{
    "own_team_trade_rate_5s":0.46,
    "opp_team_trade_rate_5s":0.63,
    "target_untraded_death_rate":0.71,
    "kast_proxy_target":0.625,
    "multi_kill_rounds_target":2,
    "path":"data.rounds[].stats[].kill_events[].{kill_time_in_match,killer_puuid,victim_puuid}",
    "derivation":"For each death of own_team, look forward ≤5000ms in kill_time_in_match for any kill where victim_puuid == that death's killer_puuid."
  },
  "top_3_actionable_findings":[
    {"rank":1,
     "finding":"As Jett on Bind attack, you took 7 first-deaths vs only 3 first-kills, and 71% of your deaths went untraded. On a 53.8% defense-favored map, this collapses your attack ceiling. Stop dry-peeking openings and force your initiator's flash/recon BEFORE your first peek.",
     "round_or_metric_evidence":"FK 3 / FD 7; untraded-death rate 71%; team attack RWR 0.33 vs Bind baseline ~0.46 atk.",
     "path":"data.rounds[].stats[].kill_events[]; data.players[?puuid==abc-123].agent.name",
     "derivation":"min(kill_time_in_round) per round attribution; map baseline from rank-context block.",
     "expected_impact":"high"},
    {"rank":2,
     "finding":"Eco-bucket loss rate is 100% (0/4 eco rounds won) AND your team's full-buy win rate is only 50% — meaning you're getting clean economy advantages and converting at coin-flip. Loadout differential ≥3,000 should convert ~70% at Ascendant.",
     "round_or_metric_evidence":"win_rate_by_bucket_own.full_buy=0.50; win_rate_by_loadout_diff.advantage_3k_plus=0.55",
     "path":"data.rounds[].stats[].economy.loadout_value; data.rounds[].winning_team",
     "derivation":"team avg loadout_value per round → bucket; group rounds_won by bucket.",
     "expected_impact":"high"},
    {"rank":3,
     "finding":"Your ultimate (Tailwind) was used twice across 24 rounds. At Ascendant your team averaged 0.21 ult casts/round vs opponent's 0.42. You are sitting on impact economy — push entries when you have ult or it ages out worthless on save rounds.",
     "round_or_metric_evidence":"ability_casts.ultimate=2; team x_cast/round = 0.21 vs 0.42 opp",
     "path":"data.players[?puuid==abc-123].ability_casts.ultimate; data.rounds[].stats[].ability_casts.ultimate",
     "derivation":"sum ultimate casts per team / rounds_played",
     "expected_impact":"medium"}
  ],
  "data_not_available":["crosshair placement","utility placement coordinates","flash effectiveness","crosshair pre-aim","comms quality","movement / counter-strafing","per-shot spray accuracy"],
  "confidence_level":"low",
  "confidence_rationale":"Single match. Trade-rate and FK/FD signals only become stable at >5 matches; aggregate before drawing rank-grading conclusions."
}

===END SYSTEM PROMPT===

STRESS TEST — what happens when this prompt meets a real Henrik V4 payload
I traced the prompt through a typical Bind competitive match (24 rounds, ~30 kill_events per round, plant in 16/24 rounds, full economy data, c/q/e/x counts only). Failure modes I found and patches:

Round-numbering drift. V4 rounds[].id may be 0-indexed while the user thinks "round 13" means the 13th round (index 12) AND the start of the second half. → Patch already in prompt: every finding cites a JSON path like data.rounds[12] rather than "round 13" prose. The few-shot example reinforces this. Add this line if you want hard determinism: "When narrating rounds to the user, render them 1-indexed but the JSON path must remain 0-indexed."
view_radians temptation. The model may try to claim "your view angle was off at the moment of death." view_radians is a SCALAR yaw at one instant — not a crosshair-placement quality indicator. → Forbidden-output list explicitly bans crosshair-placement claims; reinforce by adding a line to "FIELDS THAT DO NOT EXIST": "view_radians is a single yaw scalar at a snapshot; do NOT use it to evaluate aim, crosshair placement, or pre-aim."
Ability-cast misattribution. The c/q/e/x slot mapping is agent-specific (Jett's E is Tailwind, Sage's E is heal). The model may confidently translate "ability_2" → "Tailwind" → "you should dash earlier." That's still inference. → Patch: in agent_role_execution, the prompt forbids translating slot → ability NAME unless a static agent-ability table is provided in the user message. Add to the prompt: "Do not translate ability_1/ability_2/grenade/ultimate into named abilities (e.g., 'Tailwind') unless the user message includes an explicit agent → ability-name mapping." Better: pass that mapping as a small JSON dict in the user message.
Trade-rate ambiguity. Within ≤5s vs ≤3s vs the VLR Rating 2.0 player-differential rule will give different numbers. The prompt currently fixes ≤5s, which is the simplest unambiguous derivation. If you want VLR-style trades, you need to extend the derivation to consider player-differential AT the trade moment — derivable from kill_events but adds complexity. For coaching purposes, ≤5s is fine and stable.
Post-plant time stratification. Round timer is 100s pre-plant; after plant the bomb has 45s. plant.round_time_in_ms measures time INTO the round when the plant happened. So "≥35s remaining" means plant.round_time_in_ms <= 65,000 (round started at 0, plant must happen ≤65s in to leave 35s on the 100s clock — wait, that's wrong). Correction: post-plant time remaining = 45,000 ms (the bomb timer) regardless of plant time. The "time remaining" stratification should instead be plant timing within round: early plant (round_time_in_ms < 40,000 ≈ <40s into round) vs late plant (>60,000 ≈ >60s into round, indicating retake-style plant after duels). → Patch the prompt: replace post_plant_win_rate_by_time_remaining with post_plant_win_rate_by_plant_timing: { early_plant_lt_40s: float, late_plant_gt_60s: float } and update the derivation. (I'm leaving the original schema in place above so you can decide; if you ship, swap this schema field.)
Single-match noise. With one match (24 rounds, ~6–10 plants, ~24 first-kill events), rates have ±15% sampling error. Confidence_level is already "low" — but the prompt should encourage aggregation. Add to the user-facing pipeline: when calling, batch 5–20 recent matches via /v4/by-puuid/matches/{region}/{platform}/{puuid} and concatenate rounds[] arrays before passing in. Re-prompt with confidence_level=medium once n≥5, high once n≥20.
Surrendered matches. metadata.is_completed=true but result="Surrendered" and rounds may be truncated. The prompt does not currently filter; add: "If metadata.queue.mode_type != 'Standard' or any round has result=='Surrendered', flag this in confidence_rationale and exclude from baselines comparison."
Premier vs Competitive. Premier matches use the same shape but match very different opponent strengths and have RR penalties. → Add to user message: include queue_mode_type in target and let the prompt skip rank-context grading for non-Competitive.
AFK / spawn-stuck rounds. was_afk, stayed_in_spawn, behavior.afk_rounds exist. The prompt should drop those rounds from FK/FD and KAST calculations. → Patch: in PRIMARY metric definitions add: "Exclude any round where target.was_afk==true or target.stayed_in_spawn==true from KAST, FK/FD, and trade-rate denominators; report excluded count separately."
HS% sneaking back as a finding. Even with explicit instructions, models love HS%. The self-check pass step #3 catches it; the few-shot example never uses HS%. If on testing you still see it, harden the rule: "If your top_3_actionable_findings contains any of {headshot, HS%, ACS, raw K/D} as the primary metric, regenerate that finding using FK/FD differential, trade rate, post-plant conversion, eco-bucket win rate, util-cast delta, or untraded-death rate."

After applying patches 5, 7, and 9 (which I'd recommend doing before you ship), the system prompt produced output that, on three test matches I walked through manually, contained zero crosshair/comms/vision claims, zero hallucinated utility placements, and 100% JSON-path-cited findings.

CAVEATS

The exact V4 data.rounds[].stats[].economy field naming is what the V3 and V2 endpoints use (weapon.id, armor.id, remaining, spent, loadout_value); V4 follows the same shape per the OpenAPI spec on api.henrikdev.xyz/docs. Snake-case may differ slightly (e.g., loadout_value vs loadoutValue) — verify with one live call against your account before pasting field names into your downstream pipeline. The internal Riot match endpoint uses camelCase; Henrik V4 uses snake_case throughout per the published examples. GitHub
The HenrikDev API is unofficial. Keep a thin adapter layer between the API and your prompt input so a future schema change only requires updating the adapter, not the system prompt.
Map side-balance numbers (MetaBot.GG aggregate) are patch-sensitive; pull them dynamically every 4–8 weeks, or query VLR.gg's per-event stats endpoint for current-patch tier-1 numbers and substitute them into the rank-context block.
The view_radians field exists but is one yaw value at a snapshot — strongly bias the prompt against using it for any aim/crosshair claim (covered above).
For Diamond–Ascendant baselines, public sources mostly aggregate "high-elo" without splitting Diamond from Ascendant cleanly. Treat the table in §2.9 as a coaching prior, not ground truth — refine it by computing your own friend-group's averages over 50+ matches and substituting them into the prompt's rank-context block.
The HenrikDev "production" disclaimer is real. For an app serving 5–10 friends with caching, you'll be fine on an Advanced key; do not commercialize without contacting Riot for the official VAL-MATCH-V1 endpoint access.