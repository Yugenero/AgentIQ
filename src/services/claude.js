import { buildAISnapshot } from '../utils/deriveStats.js';

function trimMatchPayload(data) {
  if (!data?.rounds) return data;
  return {
    ...data,
    rounds: data.rounds.map(r => ({
      ...r,
      plant:  r.plant  ? { ...r.plant,  player_locations: undefined } : r.plant,
      defuse: r.defuse ? { ...r.defuse, player_locations: undefined } : r.defuse,
      stats: r.stats?.map(s => ({
        ...s,
        kill_events: s.kill_events?.map(k => ({
          ...k,
          player_locations_on_kill: undefined,
        })),
      })),
    })),
  };
}

export async function analyzePerformance(snapshot) {
  const aiPayload = buildAISnapshot(snapshot);
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aiPayload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Analysis failed: ${res.status}`);
  }
  return res.json();
}

export async function analyzeMatch(matchData, targetPuuid) {
  const trimmed = trimMatchPayload(matchData);
  const res = await fetch('/api/analyze-match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchData: trimmed, targetPuuid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Match analysis failed: ${res.status}`);
  }
  return res.json();
}
