import { useMemo } from 'react';
import './EconomyFlow.css';

const BUY_LABELS = { pistol: 'Pistol', eco: 'Eco', force: 'Force', full: 'Full Buy' };
const BUY_ORDER  = ['pistol', 'eco', 'force', 'full'];

function classifyBuy(avgLoadout) {
  if (avgLoadout < 1200)  return 'pistol';
  if (avgLoadout < 2500)  return 'eco';
  if (avgLoadout < 4000)  return 'force';
  return 'full';
}

function processMatch(matchRef, puuid) {
  const me = matchRef.players?.find(p => p.puuid === puuid);
  if (!me) return [];
  const myTeam = me.team_id?.toLowerCase();

  return (matchRef.rounds ?? []).map((round, idx) => {
    const teamStats = (round.stats ?? []).filter(s => {
      const t = (s.player?.team ?? s.team ?? '').toLowerCase();
      return t === myTeam;
    });
    const avgLoadout = teamStats.length
      ? teamStats.reduce((sum, s) => sum + (s.economy?.loadout_value ?? 0), 0) / teamStats.length
      : 0;

    const won = (round.winning_team ?? '').toLowerCase() === myTeam;
    const myStat = (round.stats ?? []).find(s => (s.player?.puuid ?? s.puuid) === puuid);

    return {
      round: idx + 1,
      won,
      buyType: classifyBuy(avgLoadout),
      teamAvg: Math.round(avgLoadout),
      weapon: myStat?.economy?.weapon?.name ?? null,
    };
  });
}

export default function EconomyFlow({ matches, puuid }) {
  const { aggregated, recentRounds } = useMemo(() => {
    const agg = {};
    BUY_ORDER.forEach(t => { agg[t] = { wins: 0, total: 0 }; });

    const allRounds = [];
    matches.forEach(m => {
      const rounds = processMatch(m.matchRef, puuid);
      rounds.forEach(r => {
        agg[r.buyType].total++;
        if (r.won) agg[r.buyType].wins++;
        allRounds.push({ ...r, map: m.map, won: r.won });
      });
    });

    // Most recent match rounds for the timeline
    const recentRounds = matches.length
      ? processMatch(matches[0].matchRef, puuid)
      : [];

    const aggregated = BUY_ORDER
      .map(t => ({
        type: t,
        label: BUY_LABELS[t],
        wins: agg[t].wins,
        total: agg[t].total,
        winRate: agg[t].total ? agg[t].wins / agg[t].total : null,
      }))
      .filter(r => r.total > 0);

    return { aggregated, recentRounds };
  }, [matches, puuid]);

  if (!aggregated.length) return null;

  return (
    <div className="economy-flow">
      <div className="economy-flow__header">
        <span className="economy-flow__title">Economy Decisions</span>
        <span className="economy-flow__sub">{matches.length} matches</span>
      </div>

      <div className="economy-flow__rates">
        {aggregated.map(({ type, label, wins, total, winRate }) => (
          <div key={type} className="economy-flow__rate-row">
            <span className={`economy-flow__buy-badge economy-flow__buy-badge--${type}`}>{label}</span>
            <div className="economy-flow__bar-track">
              <div
                className={`economy-flow__bar-fill economy-flow__bar-fill--${type}`}
                style={{ width: winRate !== null ? `${winRate * 100}%` : '0%' }}
              />
            </div>
            <span className="economy-flow__rate-val">
              {winRate !== null ? `${Math.round(winRate * 100)}%` : '—'}
              <span className="economy-flow__rate-count"> ({wins}/{total})</span>
            </span>
          </div>
        ))}
      </div>

      {recentRounds.length > 0 && (
        <div className="economy-flow__timeline">
          <span className="economy-flow__timeline-label">Last match · round by round</span>
          <div className="economy-flow__rounds">
            {recentRounds.map(r => (
              <div
                key={r.round}
                className={`economy-flow__round economy-flow__round--${r.buyType} ${r.won ? 'economy-flow__round--win' : 'economy-flow__round--loss'}`}
                title={`R${r.round} · ${BUY_LABELS[r.buyType]} · ¤${r.teamAvg.toLocaleString()}${r.weapon ? ` · ${r.weapon}` : ''} · ${r.won ? 'WIN' : 'LOSS'}`}
              >
                <span className="economy-flow__round-num">{r.round}</span>
                <span className={`economy-flow__round-dot ${r.won ? 'economy-flow__round-dot--win' : 'economy-flow__round-dot--loss'}`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
