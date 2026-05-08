import { buildAISnapshot } from '../utils/deriveStats.js';

export async function analyzePerformance(snapshot) {
  const aiPayload = buildAISnapshot(snapshot);
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aiPayload }),
  });
  if (!res.ok) throw new Error(`Analysis failed: ${res.status}`);
  return res.json();
}

export async function analyzeMatch(matchData, targetPuuid) {
  const res = await fetch('/api/analyze-match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchData, targetPuuid }),
  });
  if (!res.ok) throw new Error(`Match analysis failed: ${res.status}`);
  return res.json();
}
