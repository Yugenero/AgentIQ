import OpenAI from 'openai';

const SYSTEM_PROMPT = `# ROLE
You are VAL-COACH-D2A, a deterministic, statistically literate Valorant match analyst. Your audience is a Diamond-to-Ascendant player grinding for Immortal. They have solved aim. Generic mechanical advice is useless to them. Your job is to extract round-level economy, trade economics, opening-duel patterns, post-plant structure, util-cast efficiency, and side/map context from a Henrik V4 match payload, and to return a strict JSON object cited to specific JSON paths.

# PRIMARY DIRECTIVE
Every claim you make must be (a) derivable from the input JSON and (b) accompanied by the JSON path that supports it. If a claim cannot be supported by a specific path, output the literal string "DATA NOT AVAILABLE" and move on. Do not infer player intent, crosshair placement, comms, vision states, or utility placement — that data is not in the payload.

# INPUT SCHEMA (Henrik V4 /valorant/v4/match/{region}/{platform}/{matchid})
You will receive data with the following shape (only fields you may reference):

data.metadata.{match_id, map.name, game_length_in_ms, started_at, queue.name, queue.mode_type, season.short, region, cluster}
data.players[]: { puuid, name, tag, team_id ("Red"|"Blue"), agent.name, tier.name,
  stats.{score, kills, deaths, assists, headshots, bodyshots, legshots, damage.dealt, damage.received},
  ability_casts.{grenade, ability_1, ability_2, ultimate},
  economy.{spent.{overall,average}, loadout_value.{overall,average}},
  behavior.{afk_rounds, friendly_fire.{incoming,outgoing}, rounds_in_spawn} }
data.teams[]: { team_id, won, rounds.{won,lost} }
data.rounds[]: {
  id, result, ceremony, winning_team,
  plant?: { round_time_in_ms, site, location.{x,y}, player_puuid },
  defuse?: { round_time_in_ms, location.{x,y}, player_puuid },
  stats[]: {
    player.{puuid, team},
    ability_casts.{grenade, ability_1, ability_2, ultimate},
    damage_events[].{receiver_puuid, receiver_team, damage, headshots, bodyshots, legshots},
    kill_events[].{kill_time_in_round, kill_time_in_match, killer_puuid, killer_team, victim_puuid, victim_team,
                   victim_death_location.{x,y}, damage_weapon_name, secondary_fire_mode,
                   assistants[].{puuid, team}},
    economy.{loadout_value, weapon.name, armor.name, remaining, spent},
    score, was_afk, was_penalized, stayed_in_spawn
  }
}

# FIELDS THAT DO NOT EXIST — DO NOT INVENT
- Continuous player position (only kill/plant/defuse snapshots exist).
- Crosshair placement, pre-aim quality, view angle except view_radians at snapshot moments.
- Utility placement coordinates or per-cast timestamps — only c/q/e/x INTEGER COUNTS exist.
- Flash/blind hits, dart/recon hit counts, smoke timings.
- Comms, pings, callouts, mid-round shotcalls.
- Per-shot accuracy / spray patterns (only kill events + aggregated damage per victim).
If the user asks for any of these, return "DATA NOT AVAILABLE".

# TARGET PLAYER
The user message will identify ONE puuid as target_puuid. All "you/your" analysis is for that puuid. Treat their team as "own_team", the other as "opp_team".

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
14. Plant time distribution: median plant.round_time_in_ms for own_team, and post-plant win rate stratified by ≥35s remaining vs <20s remaining.

SECONDARY (compute when supporting a finding):
- Kill-zone clustering by victim_death_location.{x,y} for the map — describe textually only, do not invent named callouts.
- Weapon mismatch: kills where killer.economy.weapon.name differs from victim.economy.weapon.name — compute eco-steal rate as own_team rounds won where own_team avg loadout_value < 2,500.

DE-PRIORITIZED (mention only if extreme outlier; never as the headline finding):
- HS%, raw K/D, ACS, raw damage_dealt.
NEVER lead with HS%, K/D, ACS. NEVER recommend "improve aim" or "improve crosshair placement".

# RANK-CONTEXT BASELINES (use for grading; do not state as targets)
Diamond: ADR 130–150, KAST 68–72%, K/D 0.95–1.10, FKPR 0.10–0.14, plant rate ~50%, trade rate 50–58%.
Ascendant: ADR 140–160, KAST 70–75%, K/D 1.00–1.15, FKPR 0.12–0.16, plant rate ~55%, trade rate 55–62%.
Immortal: ADR 150–175, KAST 72–78%, K/D 1.05–1.20, FKPR 0.14–0.18, plant rate ~60%, trade rate 60–68%.
Map side bias (current pool): Bind 53.8% def, Split 53.0% def, Sunset ~54.9% def, Pearl 52.7% def, Haven 52.1% def, Fracture 51.4% def, Abyss 51.1–51.5% atk. Adjust expected attack/defense round counts accordingly.

# CHAIN-OF-VERIFICATION PROTOCOL (mandatory)
For every numeric claim in the output, attach a path field that names the JSON path you derived it from. For derived metrics, name the formula in derivation.

# FORBIDDEN OUTPUT PATTERNS
- "Improve your crosshair placement" — DATA NOT AVAILABLE.
- "Communicate better with your team" — DATA NOT AVAILABLE.
- "Your utility placement on Heaven was poor" — DATA NOT AVAILABLE; only cast counts exist.
- "Your headshot percentage is too low" — HS% is de-prioritized; do not lead with it.
- "Play smarter" / "be more aggressive" / "trust your team" — vague platitudes, banned.
- Citing a specific round (e.g., "round 7") without a JSON path — banned.
- Inventing flash assist counts, recon hits, smoke utility coverage — banned.

# SELF-CHECK PASS (mandatory before returning)
Before returning, re-read every leaf string and number in your JSON output. For each:
1. Is there a path that supports it? If no, replace the value with "DATA NOT AVAILABLE".
2. Does the claim mention crosshair, comms, vision, utility placement, pre-aim, or movement? If yes, replace with "DATA NOT AVAILABLE".
3. Is the top_3_actionable_findings headline metric HS%, raw K/D, or ACS? If yes, replace with FK/FD diff, trade rate, post-plant conversion, or eco-bucket win rate.
4. Are all percentages 0–1 floats? Are all counts integers?
5. Is the response valid JSON with no leading/trailing prose?`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['match_id','map','target','match_outcome','round_economy_analysis','opening_duel_analysis','trade_efficiency','post_plant_performance','utility_usage_observed','agent_role_execution','side_split_analysis','rank_context_grading','top_3_actionable_findings','data_not_available','confidence_level','confidence_rationale'],
  properties: {
    match_id: { type: 'string' },
    map: { type: 'string' },
    target: {
      type: 'object', additionalProperties: false,
      required: ['puuid','name','agent','rank_at_match','team'],
      properties: { puuid: { type: 'string' }, name: { type: 'string' }, agent: { type: 'string' }, rank_at_match: { type: 'string' }, team: { type: 'string' } },
    },
    match_outcome: {
      type: 'object', additionalProperties: false,
      required: ['won','score_own','score_opp','side_split'],
      properties: {
        won: { type: 'boolean' }, score_own: { type: 'integer' }, score_opp: { type: 'integer' },
        side_split: { type: 'object', additionalProperties: false, required: ['attack_rounds_won','defense_rounds_won'], properties: { attack_rounds_won: { type: 'integer' }, defense_rounds_won: { type: 'integer' } } },
      },
    },
    round_economy_analysis: {
      type: 'object', additionalProperties: false,
      required: ['buckets_own','win_rate_by_bucket_own','win_rate_by_loadout_diff','pistol_outcomes','bonus_outcomes','eco_steal_rate_own','path','derivation'],
      properties: {
        buckets_own: { type: 'object', additionalProperties: false, required: ['eco_rounds','half_buy_rounds','full_buy_rounds'], properties: { eco_rounds: { type: 'integer' }, half_buy_rounds: { type: 'integer' }, full_buy_rounds: { type: 'integer' } } },
        win_rate_by_bucket_own: { type: 'object', additionalProperties: false, required: ['eco','half_buy','full_buy'], properties: { eco: { type: 'number' }, half_buy: { type: 'number' }, full_buy: { type: 'number' } } },
        win_rate_by_loadout_diff: { type: 'object', additionalProperties: false, required: ['advantage_3k_plus','even','deficit_3k_plus'], properties: { advantage_3k_plus: { type: 'number' }, even: { type: 'number' }, deficit_3k_plus: { type: 'number' } } },
        pistol_outcomes: { type: 'object', additionalProperties: false, required: ['round_1','round_13'], properties: { round_1: { type: 'string' }, round_13: { type: 'string' } } },
        bonus_outcomes: { type: 'object', additionalProperties: false, required: ['round_2','round_14'], properties: { round_2: { type: 'string' }, round_14: { type: 'string' } } },
        eco_steal_rate_own: { type: 'number' }, path: { type: 'string' }, derivation: { type: 'string' },
      },
    },
    opening_duel_analysis: {
      type: 'object', additionalProperties: false,
      required: ['fk_target','fd_target','fk_minus_fd_target','fk_own_team_total','fd_own_team_total','open_duel_win_rate_own_attack','open_duel_win_rate_own_defense','site_split_when_first_kill_attacker','path','derivation'],
      properties: {
        fk_target: { type: 'integer' }, fd_target: { type: 'integer' }, fk_minus_fd_target: { type: 'integer' },
        fk_own_team_total: { type: 'integer' }, fd_own_team_total: { type: 'integer' },
        open_duel_win_rate_own_attack: { type: 'number' }, open_duel_win_rate_own_defense: { type: 'number' },
        site_split_when_first_kill_attacker: { type: 'object', additionalProperties: false, required: ['A','B','C'], properties: { A: { type: 'integer' }, B: { type: 'integer' }, C: { type: 'integer' } } },
        path: { type: 'string' }, derivation: { type: 'string' },
      },
    },
    trade_efficiency: {
      type: 'object', additionalProperties: false,
      required: ['own_team_trade_rate_5s','opp_team_trade_rate_5s','target_untraded_death_rate','kast_proxy_target','multi_kill_rounds_target','path','derivation'],
      properties: {
        own_team_trade_rate_5s: { type: 'number' }, opp_team_trade_rate_5s: { type: 'number' },
        target_untraded_death_rate: { type: 'number' }, kast_proxy_target: { type: 'number' },
        multi_kill_rounds_target: { type: 'integer' }, path: { type: 'string' }, derivation: { type: 'string' },
      },
    },
    post_plant_performance: {
      type: 'object', additionalProperties: false,
      required: ['plant_rate_attacker_own','defuse_rate_defender_own','post_plant_win_rate_own_attacker','post_plant_win_rate_by_time_remaining','path','derivation'],
      properties: {
        plant_rate_attacker_own: { type: 'number' }, defuse_rate_defender_own: { type: 'number' },
        post_plant_win_rate_own_attacker: { type: 'number' },
        post_plant_win_rate_by_time_remaining: { type: 'object', additionalProperties: false, required: ['ge_35s_remaining','lt_20s_remaining'], properties: { ge_35s_remaining: { type: 'number' }, lt_20s_remaining: { type: 'number' } } },
        path: { type: 'string' }, derivation: { type: 'string' },
      },
    },
    utility_usage_observed: {
      type: 'object', additionalProperties: false,
      required: ['casts_per_round_own_team','casts_per_round_opp_team','delta','target_casts_per_round','ultimate_usage_count_target','note','path','derivation'],
      properties: {
        casts_per_round_own_team: { type: 'number' }, casts_per_round_opp_team: { type: 'number' }, delta: { type: 'number' },
        target_casts_per_round: { type: 'object', additionalProperties: false, required: ['grenade','ability_1','ability_2','ultimate'], properties: { grenade: { type: 'number' }, ability_1: { type: 'number' }, ability_2: { type: 'number' }, ultimate: { type: 'number' } } },
        ultimate_usage_count_target: { type: 'integer' }, note: { type: 'string' }, path: { type: 'string' }, derivation: { type: 'string' },
      },
    },
    agent_role_execution: {
      type: 'object', additionalProperties: false,
      required: ['target_role','role_specific_observation','path'],
      properties: { target_role: { type: 'string' }, role_specific_observation: { type: 'string' }, path: { type: 'string' } },
    },
    side_split_analysis: {
      type: 'object', additionalProperties: false,
      required: ['attack_round_win_rate_own','defense_round_win_rate_own','map_baseline_attack_win_rate','delta_vs_baseline_attack','path'],
      properties: { attack_round_win_rate_own: { type: 'number' }, defense_round_win_rate_own: { type: 'number' }, map_baseline_attack_win_rate: { type: 'number' }, delta_vs_baseline_attack: { type: 'number' }, path: { type: 'string' } },
    },
    rank_context_grading: {
      type: 'object', additionalProperties: false,
      required: ['rank_band','metrics_at_or_above_baseline','metrics_below_baseline','metric_values_for_grading'],
      properties: {
        rank_band: { type: 'string' },
        metrics_at_or_above_baseline: { type: 'array', items: { type: 'string' } },
        metrics_below_baseline: { type: 'array', items: { type: 'string' } },
        metric_values_for_grading: { type: 'object', additionalProperties: false, required: ['kast','adr','fkpr','kd','trade_rate_team','plant_rate_team'], properties: { kast: { type: 'number' }, adr: { type: 'number' }, fkpr: { type: 'number' }, kd: { type: 'number' }, trade_rate_team: { type: 'number' }, plant_rate_team: { type: 'number' } } },
      },
    },
    top_3_actionable_findings: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['rank','finding','round_or_metric_evidence','path','derivation','expected_impact'], properties: { rank: { type: 'integer' }, finding: { type: 'string' }, round_or_metric_evidence: { type: 'string' }, path: { type: 'string' }, derivation: { type: 'string' }, expected_impact: { type: 'string' } } },
    },
    data_not_available: { type: 'array', items: { type: 'string' } },
    confidence_level: { type: 'string' },
    confidence_rationale: { type: 'string' },
  },
};

function trimMatchPayload(data) {
  if (!data?.rounds) return data;
  return {
    ...data,
    rounds: data.rounds.map(r => ({
      ...r,
      plant:  r.plant  ? { ...r.plant,  player_locations: undefined } : r.plant,
      defuse: r.defuse ? { ...r.defuse, player_locations: undefined } : r.defuse,
      stats: r.stats?.map(s => ({
        ...s,
        kill_events: s.kill_events?.map(k => ({ ...k, player_locations_on_kill: undefined })),
      })),
    })),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { matchData, targetPuuid } = req.body;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const payload = { target_puuid: targetPuuid ?? null, data: trimMatchPayload(matchData) };

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      temperature: 0.1,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'match_analysis', strict: true, schema: SCHEMA },
      },
    });

    res.json(JSON.parse(response.choices[0].message.content));
  } catch (err) {
    console.error('analyze-match error:', err);
    res.status(500).json({ error: err.message });
  }
}
