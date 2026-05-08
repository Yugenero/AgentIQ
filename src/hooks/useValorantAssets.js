import { useState, useEffect } from 'react';
import { fetchAgentIcons, fetchRankIcons } from '../services/valorantAssets.js';

export function useAgentIcons() {
  const [icons, setIcons] = useState({});
  useEffect(() => { fetchAgentIcons().then(setIcons); }, []);
  return icons;
}

export function useRankIcons() {
  const [icons, setIcons] = useState({});
  useEffect(() => { fetchRankIcons().then(setIcons); }, []);
  return icons;
}

export function useValorantAssets() {
  const agentIcons = useAgentIcons();
  const rankIcons = useRankIcons();
  return { agentIcons, rankIcons };
}
