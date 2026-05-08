import './RankCard.css';

export default function RankCard({ rank }) {
  if (!rank) return null;

  const { current, rr, lastChange, peak, peakSeason } = rank;
  const rrClamped = Math.max(0, Math.min(100, rr));

  return (
    <div className="rank-card">
      <span className="rank-card__label">RANK</span>
      <span className="rank-card__tier">{current}</span>
      <div className="rank-card__rr-row">
        <span className="rank-card__rr">{rr} RR</span>
        {lastChange !== 0 && (
          <span className={`rank-card__change ${lastChange > 0 ? 'rank-card__change--up' : 'rank-card__change--down'}`}>
            {lastChange > 0 ? `+${lastChange}` : lastChange}
          </span>
        )}
      </div>
      <div className="rank-card__bar-track" aria-label={`${rrClamped} of 100 RR`}>
        <div className="rank-card__bar-fill" style={{ width: `${rrClamped}%` }} />
      </div>
      {peak && (
        <span className="rank-card__peak">
          Peak: {peak}{peakSeason ? ` · ${peakSeason}` : ''}
        </span>
      )}
    </div>
  );
}
