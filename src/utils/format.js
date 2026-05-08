export function formatKD(kd) {
  return Number(kd).toFixed(2);
}

export function formatPercent(val) {
  return `${Number(val).toFixed(1)}%`;
}

export function formatRR(rr) {
  return `${rr} RR`;
}

export function formatDelta(val) {
  if (val > 0) return `+${val}`;
  return String(val);
}

export function formatACS(val) {
  return Math.round(val).toString();
}

const ROMAN = { '1': 'I', '2': 'II', '3': 'III' };

export function formatRank(tierName) {
  if (!tierName) return tierName;
  return tierName.replace(/\b([123])\b/, n => ROMAN[n] ?? n);
}

export function formatDuration(ms) {
  if (!ms) return null;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function getRankColor(tierName) {
  if (!tierName) return null;
  const n = tierName.toLowerCase();
  if (n.includes('iron'))       return '#8d8d8d';
  if (n.includes('bronze'))     return '#a07540';
  if (n.includes('silver'))     return '#c4c4c4';
  if (n.includes('gold'))       return '#e8b43a';
  if (n.includes('platinum'))   return '#3dbbbb';
  if (n.includes('diamond'))    return '#b973e0';
  if (n.includes('ascendant'))  return '#3ecc6f';
  if (n.includes('immortal'))   return '#e84040';
  if (n.includes('radiant'))    return '#c9a84c';
  return null;
}
