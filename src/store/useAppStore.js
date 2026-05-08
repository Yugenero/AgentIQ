import { create } from 'zustand';
import * as henrik from '../services/henrik.js';
import { buildSnapshot } from '../utils/deriveStats.js';

export const useAppStore = create((set) => ({
  player: null,
  rank: null,
  matches: [],
  snapshot: null,
  loading: false,
  error: null,
  theme: localStorage.getItem('theme') || 'dark',

  setTheme(t) {
    localStorage.setItem('theme', t);
    document.documentElement.dataset.theme = t;
    set({ theme: t });
  },

  reset() {
    set({ player: null, rank: null, matches: [], snapshot: null, error: null });
  },

  async loadPlayer(name, tag) {
    set({ loading: true, error: null, player: null, rank: null, matches: [], snapshot: null });
    try {
      const accountData = await henrik.account(name, tag);
      const region = accountData.region || 'na';

      const [rankData, matchesData, mmrHistoryData] = await Promise.all([
        henrik.mmr(region, name, tag),
        henrik.matches(region, name, tag, { mode: 'competitive', size: 10 }),
        henrik.mmrHistory(region, name, tag).catch(() => null),
      ]);

      const safeMatches = Array.isArray(matchesData) ? matchesData : [];
      const snap = buildSnapshot(accountData, rankData, safeMatches, mmrHistoryData);
      snap.player.puuid = accountData.puuid;

      set({ player: accountData, rank: rankData, matches: safeMatches, snapshot: snap, loading: false });
    } catch (e) {
      set({ error: e.message || 'An unexpected error occurred', loading: false });
    }
  },
}));
