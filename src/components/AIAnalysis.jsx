import './AIAnalysis.css';

function SkeletonAnalysis() {
  return (
    <div className="ai-analysis ai-analysis--skeleton">
      <div className="skeleton-bar" style={{ height: '0.7rem', width: '30%', marginBottom: '16px' }} />
      <div className="skeleton-bar" style={{ height: '1rem', width: '100%', marginBottom: '8px' }} />
      <div className="skeleton-bar" style={{ height: '1rem', width: '90%', marginBottom: '8px' }} />
      <div className="skeleton-bar" style={{ height: '1rem', width: '80%', marginBottom: '24px' }} />
      <div className="skeleton-bar" style={{ height: '0.7rem', width: '25%', marginBottom: '12px' }} />
      <div className="skeleton-bar" style={{ height: '0.9rem', width: '85%', marginBottom: '8px' }} />
      <div className="skeleton-bar" style={{ height: '0.9rem', width: '70%', marginBottom: '8px' }} />
      <div className="skeleton-bar" style={{ height: '0.9rem', width: '75%', marginBottom: '24px' }} />
      <div className="skeleton-bar" style={{ height: '0.7rem', width: '28%', marginBottom: '12px' }} />
      <div className="skeleton-bar" style={{ height: '0.9rem', width: '80%', marginBottom: '8px' }} />
      <div className="skeleton-bar" style={{ height: '0.9rem', width: '65%' }} />
    </div>
  );
}

export default function AIAnalysis({ analysis, loading, error, onRetry }) {
  if (loading) return <SkeletonAnalysis />;

  if (error) {
    return (
      <div className="ai-analysis">
        <p className="ai-analysis__error">{error}</p>
        {onRetry && (
          <button className="ai-analysis__retry" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!analysis) return null;

  const { summary, strengths, weaknesses, focus } = analysis;

  return (
    <div className="ai-analysis">
      <h3 className="ai-analysis__section-header">Analysis</h3>

      <p className="ai-analysis__summary">{summary}</p>

      {strengths?.length > 0 && (
        <section className="ai-analysis__section">
          <h4 className="ai-analysis__section-header">Strengths</h4>
          <ul className="ai-analysis__list">
            {strengths.map((s, i) => (
              <li key={i} className="ai-analysis__list-item">{s}</li>
            ))}
          </ul>
        </section>
      )}

      {weaknesses?.length > 0 && (
        <section className="ai-analysis__section">
          <h4 className="ai-analysis__section-header">Weaknesses</h4>
          <ul className="ai-analysis__list">
            {weaknesses.map((w, i) => (
              <li key={i} className="ai-analysis__list-item">{w}</li>
            ))}
          </ul>
        </section>
      )}

      {focus?.length > 0 && (
        <section className="ai-analysis__section">
          <h4 className="ai-analysis__section-header">Focus</h4>
          <ul className="ai-analysis__list">
            {focus.map((f, i) => (
              <li key={i} className="ai-analysis__list-item">{f}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
