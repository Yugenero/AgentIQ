const BASE = 'https://valorant-api.com/v1';

// Promise-level cache — multiple callers share one in-flight request
let agentPromise = null;
let rankPromise = null;

export function fetchAgentIcons() {
  if (!agentPromise) {
    agentPromise = fetch(`${BASE}/agents?isPlayableCharacter=true`)
      .then(r => r.json())
      .then(({ data }) => {
        const map = {};
        (data ?? []).forEach(a => {
          map[a.displayName.toLowerCase()] = a.displayIconSmall;
        });
        return map;
      })
      .catch(() => ({}));
  }
  return agentPromise;
}

export function fetchRankIcons() {
  if (!rankPromise) {
    rankPromise = fetch(`${BASE}/competitivetiers`)
      .then(r => r.json())
      .then(({ data }) => {
        // Last entry is the most recent episode's tier set
        const latest = data?.[data.length - 1];
        const map = {};
        (latest?.tiers ?? []).forEach(t => {
          if (t.smallIcon) map[t.tierName.toLowerCase()] = t.smallIcon;
        });
        return map;
      })
      .catch(() => ({}));
  }
  return rankPromise;
}
