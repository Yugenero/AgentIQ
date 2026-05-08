import './MatchRow.css';

export default function MatchRow({ match }) {
  const { map, agent, result, kda, acs, won } = match;
  return (
    <div className={`match-row ${won ? 'match-row--win' : 'match-row--loss'}`}>
      <span className="match-row__map">{map}</span>
      <span className="match-row__agent">{agent}</span>
      <span className={`match-row__result ${won ? 'match-row__result--win' : 'match-row__result--loss'}`}>{result}</span>
      <span className="match-row__kda">{kda}</span>
      <span className="match-row__acs">{acs} ACS</span>
    </div>
  );
}
