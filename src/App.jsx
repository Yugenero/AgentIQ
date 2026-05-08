import { useState } from 'react';
import { useAppStore } from './store/useAppStore.js';
import { useAuth } from './context/AuthContext.jsx';
import SearchBar from './components/SearchBar.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import NavMenu from './components/NavMenu.jsx';
import StatCard from './components/StatCard.jsx';
import MatchCard from './components/MatchCard.jsx';
import AgentBreakdown from './components/AgentBreakdown.jsx';
import RRTrendline from './components/RRTrendline.jsx';
import EconomyFlow from './components/EconomyFlow.jsx';
import RoleRadar from './components/RoleRadar.jsx';
import PlayerCard from './components/PlayerCard.jsx';
import AuthModal from './components/AuthModal.jsx';
import ProfilePage from './components/ProfilePage.jsx';
import { ReactTyped } from 'react-typed';
import { getRankColor } from './utils/format.js';
import './styles/theme.css';
import './styles/global.css';
import './styles/animations.css';
import './App.css';

function SkeletonMatchRow() {
  return (
    <div className="match-skeleton-row">
      <div className="skeleton-bar" style={{ height: '0.75rem', width: '12%' }} />
      <div className="skeleton-bar" style={{ height: '0.75rem', width: '20%' }} />
      <div className="skeleton-bar" style={{ height: '0.75rem', width: '15%' }} />
      <div className="skeleton-bar" style={{ height: '0.75rem', width: '10%' }} />
      <div className="skeleton-bar" style={{ height: '0.75rem', width: '10%' }} />
    </div>
  );
}

function SkeletonStatCard() {
  return (
    <div className="stat-card skeleton-card">
      <div className="skeleton-bar" style={{ height: '0.6rem', width: '55%' }} />
      <div className="skeleton-bar" style={{ height: '1.4rem', width: '65%', marginTop: '4px' }} />
    </div>
  );
}

const TAGLINES = [
  '"rdy" — "Gimme 10"',
  'where tf is ENT3RPRI5E',
  'nice cock, now queue up',
  'be on in an hour (it has been 3 hours)',
  'gig finished, monitor mounted, notes learned — now play',
  '@ENT3RPRI5E whats ur eta whats ur eta',
  'too much grass, nerd',
  'i can later (i cannot later)',
  'GAM. I AM ON. I can be on in a little over 30.',
  'calling a bomb threat so we can play',
];

export default function App() {
  const { snapshot, loading, error, reset } = useAppStore();
  const { user } = useAuth();
  const hasData = Boolean(snapshot);

  const [page, setPage] = useState('home');
  const [showAuthModal, setShowAuthModal] = useState(false);

  function handleSelectPage(id) {
    if (id === 'profile') {
      if (!user) {
        setShowAuthModal(true);
      } else {
        setPage('profile');
      }
    }
  }

  function handleAuthClose() {
    setShowAuthModal(false);
    if (user) setPage('profile');
  }

  const header = (onLogoClick) => (
    <div className="app__header">
      <NavMenu onSelectPage={handleSelectPage} />
      <button className="app-logo app-logo--sm app-logo--btn" onClick={onLogoClick}>AgentIQ</button>
      <div className="app__header-search"><SearchBar /></div>
      <ThemeToggle />
    </div>
  );

  // ── Profile page ──
  if (page === 'profile') {
    return (
      <div className="app app-enter">
        {header(() => { setPage('home'); reset(); })}
        <div key="accent-line" className="accent-line" />
        <ProfilePage onBack={() => setPage('home')} />
        {showAuthModal && <AuthModal onClose={handleAuthClose} />}
      </div>
    );
  }

  // ── Pre-search ──
  if (!hasData && !loading) {
    return (
      <div className="app app--pre-search app-enter">
        <div className="app__topbar--left"><NavMenu onSelectPage={handleSelectPage} /></div>
        <div className="app__topbar--right"><ThemeToggle /></div>
        <div className="pre-search__center">
          <div className="hero stagger">
            <h1 className="app-logo">RR Mitigation Intelligence (AgentIQ)</h1>
            <ReactTyped
              className="app-tagline"
              strings={TAGLINES}
              typeSpeed={40}
              backSpeed={20}
              backDelay={2500}
              loop
            />
            <SearchBar />
            {error && <p className="app-error">{error}</p>}
          </div>
        </div>
        {showAuthModal && <AuthModal onClose={handleAuthClose} />}
      </div>
    );
  }

  // ── Loading skeleton ──
  if (!hasData && loading) {
    return (
      <div className="app app--loading">
        {header(reset)}
        <div key="accent-line" className="accent-line" />
        <div className="dashboard stagger">
          <div className="panel">
            <div className="panel__header">
              <div className="skeleton-bar" style={{ height: '0.65rem', width: '180px' }} />
            </div>
            {[...Array(10)].map((_, i) => <SkeletonMatchRow key={i} />)}
          </div>
          <div className="kpi-row">
            {[...Array(5)].map((_, i) => <SkeletonStatCard key={i} />)}
          </div>
          <div className="bottom-row">
            <div className="skeleton-bar" style={{ height: '100px', borderRadius: '12px', flex: 1 }} />
            <div className="skeleton-bar" style={{ height: '100px', borderRadius: '12px', flex: 1 }} />
          </div>
        </div>
        {showAuthModal && <AuthModal onClose={handleAuthClose} />}
      </div>
    );
  }

  const { player, rank, season, recent, agents, lastMatches, career } = snapshot;

  // ── Dashboard ──
  return (
    <div className="app app-enter">
      {header(reset)}
      <div className="accent-line" />
      {error && <p className="app-error app-error--inline">{error}</p>}
      <div className="dashboard stagger">
        <PlayerCard player={player} rank={rank} />
        <div className="panel-row">
          <div className="panel">
            <div className="panel__header">
              <span className="panel__title">Last {lastMatches.length} Competitive Games</span>
              <div className="panel__meta">
                {season && <span className="panel__badge">{season}</span>}
                <span className="panel__badge">{career.wins}W {career.games - career.wins}L · {Number(career.winrate).toFixed(0)}% WR</span>
              </div>
            </div>
            <div className="match-list-header">
              <span>#</span><span>Map</span><span>Agent</span>
              <span>Result</span><span>KDA</span><span>ACS</span>
              <span>HS%</span><span>RR</span><span>When</span><span>AI</span>
            </div>
            {lastMatches.length === 0 ? (
              <p className="panel__empty">No competitive matches found.</p>
            ) : (
              lastMatches.map((m, i) => (
                <MatchCard key={i} match={m} playerMeta={{ ...player, puuid: snapshot.player?.puuid }} index={i} />
              ))
            )}
          </div>
          <RRTrendline matches={lastMatches} />
        </div>
        <div className="viz-pair">
          <EconomyFlow matches={lastMatches} puuid={snapshot.player?.puuid} />
          <RoleRadar   matches={lastMatches} puuid={snapshot.player?.puuid} />
        </div>
        <div className="kpi-row">
          <StatCard label="K/D" value={Number(recent.kd).toFixed(2)} />
          <StatCard label="Avg ACS" value={recent.acsAvg} />
          <StatCard label="HS%" value={`${Number(recent.hsPct).toFixed(1)}%`} />
          <StatCard label="Win Rate" value={`${Number(career.winrate).toFixed(1)}%`} />
          <StatCard label="ADR" value={recent.adr} />
        </div>
        <AgentBreakdown agents={agents} />
      </div>
      {showAuthModal && <AuthModal onClose={handleAuthClose} />}
    </div>
  );
}
