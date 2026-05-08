import { useMemo } from 'react';
import './RoleRadar.css';

const ROLE_MAP = {
  jett: 'duelist', reyna: 'duelist', neon: 'duelist', yoru: 'duelist',
  phoenix: 'duelist', iso: 'duelist', waylay: 'duelist',
  sova: 'initiator', breach: 'initiator', fade: 'initiator',
  'kay/o': 'initiator', kayo: 'initiator', gekko: 'initiator', skye: 'initiator',
  omen: 'controller', viper: 'controller', brimstone: 'controller',
  astra: 'controller', harbor: 'controller', clove: 'controller',
  killjoy: 'sentinel', cypher: 'sentinel', sage: 'sentinel',
  chamber: 'sentinel', deadlock: 'sentinel', vyse: 'sentinel',
};

const ROLE_AXES = {
  duelist: [
    { label: 'Kill Rate',    key: 'killRate',    benchmark: 1.10 },
    { label: 'Multi-Kill%', key: 'multiKill',   benchmark: 0.22 },
    { label: 'KAST',         key: 'kast',        benchmark: 0.70 },
    { label: 'Survival%',   key: 'survivalRate', benchmark: 0.43 },
    { label: 'ACS',          key: 'acsNorm',     benchmark: 1.00 },
  ],
  initiator: [
    { label: 'Assist Rate',  key: 'assistRate',  benchmark: 0.42 },
    { label: 'KAST',         key: 'kast',        benchmark: 0.73 },
    { label: 'Util/Round',   key: 'utilRate',    benchmark: 1.00 },
    { label: 'Kill Rate',    key: 'killRate',    benchmark: 0.90 },
    { label: 'Survival%',   key: 'survivalRate', benchmark: 0.48 },
  ],
  controller: [
    { label: 'Util/Round',   key: 'utilRate',    benchmark: 1.00 },
    { label: 'Assist Rate',  key: 'assistRate',  benchmark: 0.40 },
    { label: 'KAST',         key: 'kast',        benchmark: 0.71 },
    { label: 'Survival%',   key: 'survivalRate', benchmark: 0.50 },
    { label: 'ADR',          key: 'adrNorm',     benchmark: 1.00 },
  ],
  sentinel: [
    { label: 'Survival%',   key: 'survivalRate', benchmark: 0.55 },
    { label: 'KAST',         key: 'kast',        benchmark: 0.72 },
    { label: 'Util/Round',   key: 'utilRate',    benchmark: 1.00 },
    { label: 'Assist Rate',  key: 'assistRate',  benchmark: 0.38 },
    { label: 'Kill Rate',    key: 'killRate',    benchmark: 0.85 },
  ],
};

// Normalization caps per metric so all axes share a 0–1 scale
const METRIC_CAPS = {
  killRate:    2.0,
  multiKill:   0.50,
  kast:        1.00,
  survivalRate:1.00,
  acsNorm:     2.00,   // actual/benchmark, cap at 2×
  assistRate:  1.00,
  utilRate:    2.00,   // actual/benchmark, cap at 2×
  adrNorm:     2.00,
};

function computeKAST(matchRef, puuid, teamId) {
  let kast = 0;
  const rounds = matchRef.rounds ?? [];
  for (const round of rounds) {
    const kills = round.stats?.flatMap(s => s.kill_events ?? []) ?? [];
    const hadKill    = kills.some(k => (k.killer_puuid ?? k.killer?.puuid) === puuid);
    const hadAssist  = kills.some(k => (k.assistants ?? []).some(a => (a.puuid ?? a.assistant_puuid) === puuid));
    const died       = kills.some(k => (k.victim_puuid ?? k.victim?.puuid) === puuid);
    let wasTraded = false;
    if (died) {
      const myDeath = kills.find(k => (k.victim_puuid ?? k.victim?.puuid) === puuid);
      if (myDeath) {
        const killerId = myDeath.killer_puuid ?? myDeath.killer?.puuid;
        wasTraded = kills.some(k =>
          (k.victim_puuid ?? k.victim?.puuid) === killerId &&
          Math.abs((k.kill_time_in_match ?? 0) - (myDeath.kill_time_in_match ?? 0)) <= 5000
        );
      }
    }
    if (hadKill || hadAssist || !died || wasTraded) kast++;
  }
  return rounds.length ? kast / rounds.length : 0;
}

function computeMetrics(agentMatches, puuid, role) {
  let totalKills = 0, totalDeaths = 0, totalAssists = 0, totalRounds = 0;
  let totalACS = 0, totalADR = 0;
  let multiKillRounds = 0, totalCasts = 0, kastSum = 0;
  let matchCount = 0;

  for (const m of agentMatches) {
    const ref = m.matchRef;
    if (!ref) continue;
    const me = ref.players?.find(p => p.puuid === puuid);
    if (!me) continue;

    const rounds = (ref.rounds ?? []).length || 1;
    totalKills   += m.kills ?? 0;
    totalDeaths  += m.deaths ?? 0;
    totalAssists += m.assists ?? 0;
    totalRounds  += rounds;
    totalACS     += m.acs ?? 0;
    totalADR     += m.adr ?? 0;
    matchCount++;

    // Ability casts from player-level totals
    const casts = me.ability_casts ?? {};
    totalCasts += ((casts.grenade ?? 0) + (casts.ability_1 ?? 0) + (casts.ability_2 ?? 0) + (casts.ultimate ?? 0));

    // Per-round multi-kill count and KAST
    for (const round of ref.rounds ?? []) {
      const myKills = (round.stats ?? [])
        .flatMap(s => s.kill_events ?? [])
        .filter(k => (k.killer_puuid ?? k.killer?.puuid) === puuid).length;
      if (myKills >= 2) multiKillRounds++;
    }
    kastSum += computeKAST(ref, puuid, me.team_id);
  }

  if (!totalRounds) return null;

  const killRate    = totalKills / totalRounds;
  const survivalRate= Math.max(0, (totalRounds - totalDeaths) / totalRounds);
  const assistRate  = totalAssists / totalRounds;
  const multiKill   = multiKillRounds / totalRounds;
  const kast        = matchCount ? kastSum / matchCount : 0;
  const acsAvg      = matchCount ? totalACS / matchCount : 0;
  const adrAvg      = matchCount ? totalADR / matchCount : 0;
  const castsPerRound = totalCasts / totalRounds;

  // Role-specific normalization benchmarks for util/ACS/ADR
  const benchmarks = {
    duelist:    { acsRef: 240, adrRef: 155, utilRef: 1.5 },
    initiator:  { acsRef: 210, adrRef: 145, utilRef: 2.5 },
    controller: { acsRef: 200, adrRef: 140, utilRef: 3.5 },
    sentinel:   { acsRef: 205, adrRef: 135, utilRef: 2.0 },
  };
  const b = benchmarks[role] ?? benchmarks.duelist;

  return {
    killRate,
    multiKill,
    kast,
    survivalRate,
    acsNorm:    acsAvg / b.acsRef,
    assistRate,
    utilRate:   castsPerRound / b.utilRef,
    adrNorm:    adrAvg / b.adrRef,
  };
}

function radarPoints(values, axes, cx, cy, R) {
  return axes.map((_, i) => {
    const angle = (i / axes.length) * 2 * Math.PI - Math.PI / 2;
    const v = Math.min(values[i] ?? 0, 1);
    return [cx + v * R * Math.cos(angle), cy + v * R * Math.sin(angle)];
  });
}

function gridPoints(level, axes, cx, cy, R) {
  return radarPoints(axes.map(() => level), axes, cx, cy, R);
}

export default function RoleRadar({ matches, puuid }) {
  const { role, agent, axes, actual, benchmark } = useMemo(() => {
    if (!matches?.length) return {};

    // Primary agent = most played
    const agentCount = {};
    matches.forEach(m => { agentCount[m.agent] = (agentCount[m.agent] ?? 0) + 1; });
    const agent = Object.entries(agentCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const role  = ROLE_MAP[agent?.toLowerCase()] ?? 'duelist';
    const axes  = ROLE_AXES[role];

    const agentMatches = matches.filter(m => m.agent === agent);
    const metrics = computeMetrics(agentMatches, puuid, role);
    if (!metrics) return { role, agent, axes };

    // Normalize actual metrics to 0–1
    const actual = axes.map(({ key }) => {
      const raw = metrics[key] ?? 0;
      return Math.min(raw / (METRIC_CAPS[key] ?? 1), 1);
    });

    // Benchmark polygon: benchmark value normalized by same cap
    const benchmark = axes.map(({ benchmark: bv, key }) =>
      Math.min(bv / (METRIC_CAPS[key] ?? 1), 1)
    );

    return { role, agent, axes, actual, benchmark };
  }, [matches, puuid]);

  if (!axes || !actual) return null;

  const W = 220, H = 220, cx = W / 2, cy = H / 2, R = 82;
  const GRIDS = [0.25, 0.5, 0.75, 1.0];

  const toPath = pts => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z';

  const actualPts    = radarPoints(actual, axes, cx, cy, R);
  const benchmarkPts = radarPoints(benchmark, axes, cx, cy, R);

  return (
    <div className="role-radar">
      <div className="role-radar__header">
        <span className="role-radar__title">Role Fulfillment</span>
        <span className={`role-radar__badge role-radar__badge--${role}`}>{agent} · {role}</span>
      </div>

      <svg width={W} height={H} className="role-radar__svg">
        {/* Grid rings */}
        {GRIDS.map(g => (
          <path
            key={g}
            d={toPath(gridPoints(g, axes, cx, cy, R))}
            className={`role-radar__grid ${g === 1 ? 'role-radar__grid--outer' : ''}`}
          />
        ))}

        {/* Axis spokes */}
        {axes.map((_, i) => {
          const angle = (i / axes.length) * 2 * Math.PI - Math.PI / 2;
          return (
            <line
              key={i}
              x1={cx} y1={cy}
              x2={cx + R * Math.cos(angle)}
              y2={cy + R * Math.sin(angle)}
              className="role-radar__spoke"
            />
          );
        })}

        {/* Benchmark polygon */}
        <path d={toPath(benchmarkPts)} className="role-radar__benchmark" />

        {/* Actual polygon */}
        <path d={toPath(actualPts)} className="role-radar__actual" />

        {/* Actual dots */}
        {actualPts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} className="role-radar__dot" />
        ))}

        {/* Axis labels */}
        {axes.map(({ label }, i) => {
          const angle = (i / axes.length) * 2 * Math.PI - Math.PI / 2;
          const lx = cx + (R + 16) * Math.cos(angle);
          const ly = cy + (R + 16) * Math.sin(angle);
          const anchor = Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
          return (
            <text
              key={i}
              x={lx.toFixed(1)}
              y={(ly + (Math.sin(angle) > 0.3 ? 4 : Math.sin(angle) < -0.3 ? -2 : 1)).toFixed(1)}
              textAnchor={anchor}
              className="role-radar__label"
            >
              {label}
            </text>
          );
        })}
      </svg>

      <div className="role-radar__legend">
        <span className="role-radar__legend-item role-radar__legend-item--actual">You</span>
        <span className="role-radar__legend-item role-radar__legend-item--benchmark">Role baseline</span>
      </div>
    </div>
  );
}
