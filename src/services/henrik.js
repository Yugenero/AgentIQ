const BASE_URL = 'https://api.henrikdev.xyz';
const API_KEY = import.meta.env.VITE_HENRIK_API_KEY;
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(endpoint) {
  return `henrik_cache:${endpoint}`;
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // localStorage quota exceeded — skip caching
  }
}

async function henrikFetch(endpoint) {
  const key = cacheKey(endpoint);
  const cached = readCache(key);
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { Authorization: API_KEY },
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('Rate limit hit — try again in a moment');
    if (res.status === 503) throw new Error('Riot API in maintenance, check back shortly');
    const body = await res.json().catch(() => ({}));
    const msg = body?.errors?.[0]?.message || body?.message || res.statusText;
    throw new Error(`API error ${res.status}: ${msg}`);
  }

  const json = await res.json();
  writeCache(key, json.data);
  return json.data;
}

export function account(name, tag) {
  return henrikFetch(`/valorant/v2/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
}

export function mmr(region, name, tag) {
  return henrikFetch(`/valorant/v3/mmr/${region}/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
}

export function matches(region, name, tag, options = {}) {
  const { mode = 'competitive', size = 10 } = options;
  return henrikFetch(
    `/valorant/v4/matches/${region}/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?mode=${mode}&size=${size}`
  );
}

export function mmrHistory(region, name, tag) {
  return henrikFetch(
    `/valorant/v2/mmr-history/${region}/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
  );
}
