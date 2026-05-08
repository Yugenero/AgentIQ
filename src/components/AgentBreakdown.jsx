import { useAgentIcons } from '../hooks/useValorantAssets.js';
import './AgentBreakdown.css';

export default function AgentBreakdown({ agents }) {
  const agentIcons = useAgentIcons();
  if (!agents?.length) return null;

  return (
    <div className="agent-breakdown">
      {agents.map((agent) => {
        const icon = agentIcons[agent.name.toLowerCase()];
        return (
        <div key={agent.name} className="agent-card">
          <div className="agent-card__header">
            {icon && <img src={icon} alt={agent.name} className="agent-card__icon" />}
            <span className="agent-card__name">{agent.name}</span>
          </div>
          <div className="agent-card__stats">
            <div className="agent-card__stat">
              <span className="agent-card__stat-label">Games</span>
              <span className="agent-card__stat-value">{agent.games}</span>
            </div>
            <div className="agent-card__stat">
              <span className="agent-card__stat-label">K/D</span>
              <span className="agent-card__stat-value">{Number(agent.kd).toFixed(2)}</span>
            </div>
            <div className="agent-card__stat">
              <span className="agent-card__stat-label">ACS</span>
              <span className="agent-card__stat-value">{agent.acs}</span>
            </div>
            <div className="agent-card__stat">
              <span className="agent-card__stat-label">Win%</span>
              <span className="agent-card__stat-value">{Number(agent.winRate).toFixed(1)}%</span>
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}
