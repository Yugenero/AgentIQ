import { getRankColor, formatRank } from '../utils/format.js';
import { useRankIcons } from '../hooks/useValorantAssets.js';
import './PlayerCard.css';

export default function PlayerCard({ player, rank }) {
  const rankIcons = useRankIcons();
  const rankColor = getRankColor(rank.current);
  const peakColor = getRankColor(rank.peak);
  const currentIcon = rankIcons[rank.current?.toLowerCase()];
  const peakIcon = rankIcons[rank.peak?.toLowerCase()];

  return (
    <div className="player-card">
      <div className="player-card__left">
        <h2 className="player-card__name">
          {player.name}
          <span className="player-card__tag">#{player.tag}</span>
        </h2>
        <span className="player-card__level">Level {player.level}</span>
      </div>

      <div className="player-card__right">
        <div className="player-card__rank-block">
          <span className="player-card__rank-label">Current</span>
          <div className="player-card__rank-row">
            {currentIcon && <img src={currentIcon} alt={rank.current} className="player-card__rank-icon" />}
            <span className="player-card__rank-value" style={{ color: rankColor ?? 'var(--fg)' }}>
              {formatRank(rank.current)}
              <span className="player-card__rr">{rank.rr} RR</span>
              {rank.leaderboard && (
                <span className="player-card__leaderboard">#{rank.leaderboard}</span>
              )}
            </span>
          </div>
          {rank.gamesNeeded > 0 && (!rank.current || rank.current === 'Unranked') && (
            <span className="player-card__sub">{rank.gamesNeeded} placements left</span>
          )}
        </div>

        {rank.peak && rank.peak !== 'Unranked' && (
          <div className="player-card__rank-block">
            <span className="player-card__rank-label">Peak</span>
            <div className="player-card__rank-row">
              {peakIcon && <img src={peakIcon} alt={rank.peak} className="player-card__rank-icon" />}
              <span className="player-card__rank-value" style={{ color: peakColor ?? 'var(--muted)' }}>
                {formatRank(rank.peak)}
                {rank.peakSeason && (
                  <span className="player-card__peak-season">{rank.peakSeason}</span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
