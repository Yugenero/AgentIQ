import './StatCard.css';

export default function StatCard({ label, value, delta, unit }) {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">
        {value}
        {unit && <span className="stat-card__unit">{unit}</span>}
      </span>
      {delta !== undefined && delta !== null && delta !== 0 && (
        <span className={`stat-card__delta ${delta > 0 ? 'stat-card__delta--up' : 'stat-card__delta--down'}`}>
          {delta > 0 ? '▲' : '▼'} {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
    </div>
  );
}
