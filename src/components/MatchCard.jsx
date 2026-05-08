import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { analyzeMatch } from '../services/claude.js';
import { timeAgo } from '../utils/deriveStats.js';
import { formatRank, getRankColor, formatDuration } from '../utils/format.js';
import { useValorantAssets } from '../hooks/useValorantAssets.js';
import { useAppStore } from '../store/useAppStore.js';
import './MatchCard.css';

function Scoreboard({ scoreboard, agentIcons, rankIcons, onLoadPlayer }) {
  const tipRef = useRef(null);

  if (!scoreboard?.length) return null;

  function showTip(e) {
    const el = tipRef.current;
    if (!el) return;
    el.style.opacity = '1';
    el.style.left = (e.clientX + 14) + 'px';
    el.style.top = (e.clientY - 10) + 'px';
  }
  function moveTip(e) {
    const el = tipRef.current;
    if (!el) return;
    el.style.left = (e.clientX + 14) + 'px';
    el.style.top = (e.clientY - 10) + 'px';
  }
  function hideTip() {
    if (tipRef.current) tipRef.current.style.opacity = '0';
  }

  return (
    <>
      {createPortal(
        <div ref={tipRef} className="scoreboard__cursor-tip" style={{ opacity: 0 }}>
          View stats →
        </div>,
        document.body
      )}
      <div className="scoreboard">
        {scoreboard.map(team => (
          <div key={team.team} className="scoreboard__team">
            <div className="scoreboard__team-header">
              <span className={`scoreboard__team-label ${team.won ? 'scoreboard__team-label--win' : 'scoreboard__team-label--loss'}`}>
                {team.is_my_team ? 'Your Team' : 'Enemy Team'} · {team.won ? 'WIN' : 'LOSS'}
              </span>
              <div className="scoreboard__cols-header">
                <span>Agent</span><span>Player</span><span>K/D/A</span><span>ACS</span><span>HS%</span><span>ADR</span>
              </div>
            </div>
            {team.players.map((p, i) => {
              const agentIcon = agentIcons[p.agent?.toLowerCase()];
              const rankIcon = p.tier ? rankIcons[p.tier.toLowerCase()] : null;
              const [pName, pTag] = (p.name || '').split('#');
              const isClickable = !p.is_me && pName && pTag;
              return (
                <div
                  key={i}
                  className={`scoreboard__row ${p.is_me ? 'scoreboard__row--me' : ''} ${isClickable ? 'scoreboard__row--clickable' : ''}`}
                  onClick={isClickable ? () => onLoadPlayer(pName, pTag) : undefined}
                  onMouseEnter={isClickable ? showTip : undefined}
                  onMouseMove={isClickable ? moveTip : undefined}
                  onMouseLeave={isClickable ? hideTip : undefined}
                >
                <div className="scoreboard__agent-cell">
                  {agentIcon && <img src={agentIcon} alt={p.agent} className="scoreboard__agent-icon" />}
                  <span className="scoreboard__agent">{p.agent}</span>
                </div>
                <div className="scoreboard__player">
                  <span className="scoreboard__player-name">{p.name || '—'}</span>
                  {p.tier && (
                    <div className="scoreboard__player-rank-row">
                      {rankIcon && <img src={rankIcon} alt={p.tier} className="scoreboard__rank-icon" />}
                      <span
                        className="scoreboard__player-rank"
                        style={{ color: getRankColor(p.tier) || 'var(--muted)' }}
                      >
                        {formatRank(p.tier)}
                      </span>
                    </div>
                  )}
                </div>
                <span className="scoreboard__kda">{p.kills}/{p.deaths}/{p.assists}</span>
                <span className="scoreboard__acs">{p.acs}</span>
                <span className="scoreboard__hs">{Number(p.hs_pct).toFixed(0)}%</span>
                <span className="scoreboard__adr">{p.adr}</span>
              </div>
            );
          })}
        </div>
        ))}
      </div>
    </>
  );
}

function MetricPill({ label, value }) {
  return (
    <span className="match-analysis__pill">
      <span className="match-analysis__pill-label">{label}</span>
      <span className="match-analysis__pill-value">{value}</span>
    </span>
  );
}

function MatchAnalysisPanel({ analysis, loading, error }) {
  if (loading) {
    return (
      <div className="match-analysis">
        <div className="skeleton-bar" style={{ height: '0.65rem', width: '30%', marginBottom: '12px' }} />
        <div className="skeleton-bar" style={{ height: '0.85rem', width: '100%', marginBottom: '6px' }} />
        <div className="skeleton-bar" style={{ height: '0.85rem', width: '92%', marginBottom: '6px' }} />
        <div className="skeleton-bar" style={{ height: '0.85rem', width: '78%', marginBottom: '14px' }} />
        <div className="skeleton-bar" style={{ height: '0.85rem', width: '100%', marginBottom: '6px' }} />
        <div className="skeleton-bar" style={{ height: '0.85rem', width: '85%' }} />
      </div>
    );
  }
  if (error) {
    return <div className="match-analysis"><p className="match-analysis__error">{error}</p></div>;
  }
  if (!analysis) return null;

  const te = analysis.trade_efficiency;
  const od = analysis.opening_duel_analysis;
  const pp = analysis.post_plant_performance;

  const pct = v => typeof v === 'number' ? `${Math.round(v * 100)}%` : '—';
  const fmtFkFd = () => {
    if (typeof od?.fk_minus_fd_target !== 'number') return '—';
    const n = od.fk_minus_fd_target;
    return n > 0 ? `+${n}` : `${n}`;
  };

  return (
    <div className="match-analysis">
      <div className="match-analysis__pills">
        <MetricPill label="KAST" value={pct(te?.kast_proxy_target)} />
        <MetricPill label="FK±" value={fmtFkFd()} />
        <MetricPill label="Trade%" value={pct(te?.own_team_trade_rate_5s)} />
        <MetricPill label="Plant%" value={pct(pp?.plant_rate_attacker_own)} />
        <MetricPill label="Post-plant W%" value={pct(pp?.post_plant_win_rate_own_attacker)} />
      </div>

      {analysis.top_3_actionable_findings?.length > 0 && (
        <div className="match-analysis__section">
          <span className="match-analysis__label">Actionable Findings</span>
          <ol className="match-analysis__findings">
            {analysis.top_3_actionable_findings.map(f => (
              <li key={f.rank} className={`match-analysis__finding match-analysis__finding--${f.expected_impact}`}>
                <span className="match-analysis__finding-rank">#{f.rank}</span>
                <span className="match-analysis__finding-text">{f.finding}</span>
                <span className="match-analysis__finding-evidence">{f.round_or_metric_evidence}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {analysis.confidence_level && (
        <span className="match-analysis__confidence">
          Confidence: {analysis.confidence_level} — {analysis.confidence_rationale}
        </span>
      )}
    </div>
  );
}

export default function MatchCard({ match, playerMeta, index }) {
  const { agentIcons, rankIcons } = useValorantAssets();
  const loadPlayer = useAppStore(s => s.loadPlayer);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleRowClick(e) {
    // Don't toggle scoreboard if clicking the AI button
    if (e.target.closest('.match-card__ai-btn')) return;
    setScoreboardOpen(o => !o);
  }

  async function handleAI(e) {
    e.stopPropagation();
    if (aiOpen) { setAiOpen(false); return; }
    setAiOpen(true);
    if (analysis || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeMatch(match.matchRef, playerMeta?.puuid);
      setAnalysis(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const rrChange = match.rr_change;
  const hasRR = rrChange !== null && rrChange !== undefined;
  const rrPositive = hasRR && rrChange > 0;
  const rrNegative = hasRR && rrChange < 0;

  const isExpanded = scoreboardOpen || aiOpen;

  return (
    <div className={`match-card ${match.won ? 'match-card--win' : 'match-card--loss'} ${isExpanded ? 'match-card--open' : ''}`}>
      <div className="match-card__row" onClick={handleRowClick} style={{ cursor: 'pointer' }}>
        <span className="match-card__index">{String(index + 1).padStart(2, '0')}</span>
        <span className="match-card__map">{match.map}</span>
        <span className="match-card__agent">
          {agentIcons[match.agent?.toLowerCase()] && (
            <img src={agentIcons[match.agent.toLowerCase()]} alt={match.agent} className="match-card__agent-icon" />
          )}
          {match.agent}
        </span>
        <span className={`match-card__result ${match.won ? 'match-card__result--win' : 'match-card__result--loss'}`}>
          {match.result}
        </span>
        <span className="match-card__kda">{match.kda}</span>
        <span className="match-card__acs">{match.acs}</span>
        <span className="match-card__hs">{match.hsPct != null ? `${Number(match.hsPct).toFixed(0)}%` : '—'}</span>
        <span
          className={`match-card__rr ${rrPositive ? 'match-card__rr--up' : rrNegative ? 'match-card__rr--down' : ''}`}
        >
          {hasRR ? (rrPositive ? `+${rrChange}` : `${rrChange}`) : '—'}
          {match.was_derank_protected && <span className="match-card__rr-shield" title="Derank protected">🛡</span>}
        </span>
        <span className="match-card__time">
          {timeAgo(match.started_at)}
          {match.game_length_ms && <span className="match-card__duration"> · {formatDuration(match.game_length_ms)}</span>}
        </span>
        <button
          className={`match-card__ai-btn ${aiOpen ? 'match-card__ai-btn--active' : ''}`}
          onClick={handleAI}
          aria-label="AI analysis"
          title="AI analysis"
        >
          <span className="match-card__ai-icon">▶</span>
        </button>
      </div>

      {scoreboardOpen && <Scoreboard scoreboard={match.scoreboard} agentIcons={agentIcons} rankIcons={rankIcons} onLoadPlayer={loadPlayer} />}
      {aiOpen && <MatchAnalysisPanel analysis={analysis} loading={loading} error={error} />}
    </div>
  );
}
