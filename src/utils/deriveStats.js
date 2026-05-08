export function calcACS(score, rounds) {
  if (!rounds) return 0;
  return Math.round(score / rounds);
}

export function calcKD(kills, deaths) {
  if (!deaths) return kills || 0;
  return Math.round((kills / deaths) * 100) / 100;
}

export function calcHSPercent(head, body, leg) {
  const total = (head || 0) + (body || 0) + (leg || 0);
  if (!total) return 0;
  return Math.round((head / total) * 1000) / 10;
}

export function calcADR(damage, rounds) {
  if (!rounds) return 0;
  const dealt = typeof damage === 'object' ? (damage?.dealt ?? 0) : (damage ?? 0);
  return Math.round(dealt / rounds);
}

export function calcWinRate(wins, games) {
  if (!games) return 0;
  return Math.round((wins / games) * 1000) / 10;
}

export function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getMapName(match) {
  const map = match.metadata?.map;
  if (typeof map === 'string') return map;
  if (map?.name) return map.name;
  return 'Unknown';
}

function getTeams(match) {
  const t = match.teams || {};
  if (Array.isArray(t)) {
    return {
      red: t.find(x => x.team_id?.toLowerCase() === 'red'),
      blue: t.find(x => x.team_id?.toLowerCase() === 'blue'),
    };
  }
  // Handle both lowercase ('red') and capitalized ('Red') keys
  const red = t.red ?? t.Red ?? null;
  const blue = t.blue ?? t.Blue ?? null;
  return { red, blue };
}

function getTeamRoundsWon(team) {
  if (!team) return 0;
  if (team.rounds?.won !== undefined) return team.rounds.won;
  return team.rounds_won ?? 0;
}

function getTeamRoundsLost(team) {
  if (!team) return 0;
  if (team.rounds?.lost !== undefined) return team.rounds.lost;
  return team.rounds_lost ?? 0;
}

function teamWon(team) {
  if (!team) return false;
  if (typeof team.has_won === 'boolean') return team.has_won;
  if (typeof team.won === 'boolean') return team.won;
  return getTeamRoundsWon(team) > getTeamRoundsLost(team);
}

function getRoundsPlayed(match) {
  // v4: rounds is an array of round objects
  if (Array.isArray(match.rounds) && match.rounds.length > 0) return match.rounds.length;
  // v3/v2: metadata.rounds_played
  if (match.metadata?.rounds_played > 0) return match.metadata.rounds_played;
  // Derive from teams
  const { red, blue } = getTeams(match);
  const ref = red ?? blue;
  if (ref) return getTeamRoundsWon(ref) + getTeamRoundsLost(ref);
  return 0;
}

function getPlayerResult(match, me) {
  const { red, blue } = getTeams(match);
  const teamIdLower = me?.team_id?.toLowerCase();
  const myTeam = teamIdLower === 'red' ? red : blue;
  const oppTeam = teamIdLower === 'red' ? blue : red;
  const won = teamWon(myTeam);
  const myRW = getTeamRoundsWon(myTeam);
  const oppRW = getTeamRoundsWon(oppTeam);
  return { won, resultStr: `${won ? 'W' : 'L'} ${myRW}-${oppRW}` };
}

function getAgentName(player) {
  const c = player?.character;
  if (typeof c === 'string') return c;
  if (c?.name) return c.name;
  return player?.agent?.name ?? 'Unknown';
}

export function extractMatchSnapshot(match, puuid, playerMeta) {
  const me = match.players?.find(p => p.puuid === puuid) || match.players?.[0];
  if (!me) return null;

  const myPuuid = me.puuid;
  const stats = me.stats ?? {};
  const rounds = getRoundsPlayed(match);
  const { won, resultStr } = getPlayerResult(match, me);
  const kills = stats.kills ?? 0;
  const deaths = stats.deaths ?? 0;
  const assists = stats.assists ?? 0;
  const headshots = stats.headshots ?? 0;
  const bodyshots = stats.bodyshots ?? 0;
  const legshots = stats.legshots ?? 0;
  const damage = stats.damage?.dealt ?? stats.damage ?? 0;
  const score = stats.score ?? 0;
  const acs = rounds > 0 ? calcACS(score, rounds) : 0;
  const adr = calcADR(damage, rounds);
  const hsPct = calcHSPercent(headshots, bodyshots, legshots);
  const season = match.metadata?.season?.short ?? match.metadata?.season ?? '';

  // Build a puuid→name lookup for the kill feed
  const nameOf = {};
  (match.players ?? []).forEach(p => {
    nameOf[p.puuid] = `${p.name ?? ''}#${p.tag ?? ''}`;
  });

  // All players in the match — gives AI team context
  const allPlayers = (match.players ?? []).map(p => {
    const s = p.stats ?? {};
    const d = s.damage?.dealt ?? s.damage ?? 0;
    const r = rounds;
    return {
      name: `${p.name ?? ''}#${p.tag ?? ''}`,
      team: p.team_id ?? '',
      agent: getAgentName(p),
      is_subject: p.puuid === myPuuid,
      kills: s.kills ?? 0,
      deaths: s.deaths ?? 0,
      assists: s.assists ?? 0,
      acs: r > 0 ? calcACS(s.score ?? 0, r) : 0,
      hs_pct: calcHSPercent(s.headshots ?? 0, s.bodyshots ?? 0, s.legshots ?? 0),
      adr: calcADR(d, r),
      economy_avg_spend: p.economy?.spent?.average ?? p.economy?.average_spent ?? null,
    };
  });

  // Kill feed — every kill where subject was killer or victim
  // Handles both v3 (killer_puuid) and v4 (killer.puuid) formats
  const killFeed = (match.kills ?? [])
    .filter(k => {
      const kId = k.killer_puuid ?? k.killer?.puuid;
      const vId = k.victim_puuid ?? k.victim?.puuid;
      return kId === myPuuid || vId === myPuuid;
    })
    .map(k => {
      const kId = k.killer_puuid ?? k.killer?.puuid;
      const vId = k.victim_puuid ?? k.victim?.puuid;
      return {
        round: k.round ?? null,
        time_in_round_ms: k.kill_time_in_round ?? k.time_in_round_in_ms ?? null,
        killer: nameOf[kId] ?? kId,
        victim: nameOf[vId] ?? vId,
        weapon: k.finishing_damage?.damage_item ?? k.weapon?.name ?? null,
        is_headshot: k.finishing_damage?.is_headshot ?? false,
        assistants: (k.assistants ?? []).map(a => {
          const aId = a.assistant_puuid ?? a.puuid;
          return nameOf[aId] ?? aId;
        }),
      };
    });

  // Per-round stats for the subject player
  // v4: rd.stats[].player.puuid; v3: rd.stats[].puuid
  const perRound = (match.rounds ?? []).map((rd, idx) => {
    const myStat = (rd.stats ?? []).find(s => (s.puuid ?? s.player?.puuid) === myPuuid) ?? {};
    const eco = myStat.economy ?? {};
    return {
      round: idx + 1,
      round_result: rd.winning_team === me.team_id ? 'win' : 'loss',
      kills: myStat.kills ?? 0,
      damage: myStat.damage ?? 0,
      score: myStat.score ?? 0,
      weapon: eco.weapon?.name ?? null,
      armor: eco.armor?.name ?? null,
      loadout_value: eco.loadout_value ?? null,
      spent: eco.spent ?? null,
    };
  });

  return {
    player: { name: playerMeta?.name ?? '', tag: playerMeta?.tag ?? '' },
    match: {
      map: getMapName(match),
      agent: getAgentName(me),
      result: resultStr,
      won,
      rounds,
      kda: `${kills}/${deaths}/${assists}`,
      kills, deaths, assists,
      acs,
      hs_pct: hsPct,
      adr,
      damage_dealt: damage,
      headshots, bodyshots, legshots,
      season,
      started_at: match.metadata?.started_at ?? '',
    },
    all_players: allPlayers,
    kill_feed: killFeed,
    per_round: perRound,
  };
}

// Strips raw match data and adds derived metrics for the AI payload.
// Use this instead of passing the full snapshot to analyzePerformance.
export function buildAISnapshot(snapshot) {
  const { player, rank, career, recent, agents, lastMatches, season } = snapshot;

  // Map-level aggregates
  const mapAccum = {};
  lastMatches.forEach(m => {
    if (!mapAccum[m.map]) mapAccum[m.map] = { games: 0, wins: 0, acsSum: 0, adrSum: 0 };
    mapAccum[m.map].games++;
    if (m.won) mapAccum[m.map].wins++;
    mapAccum[m.map].acsSum += m.acs;
    mapAccum[m.map].adrSum += m.adr;
  });
  const map_stats = Object.entries(mapAccum)
    .map(([map, v]) => ({
      map,
      games: v.games,
      wins: v.wins,
      win_pct: Math.round((v.wins / v.games) * 100),
      avg_acs: Math.round(v.acsSum / v.games),
      avg_adr: Math.round(v.adrSum / v.games),
    }))
    .sort((a, b) => b.games - a.games);

  // RR trajectory
  const rrGames = lastMatches.filter(m => m.rr_change !== null && m.rr_change !== undefined);
  const winRRs = rrGames.filter(m => m.won).map(m => m.rr_change);
  const lossRRs = rrGames.filter(m => !m.won).map(m => m.rr_change);
  const netRR = rrGames.reduce((s, m) => s + m.rr_change, 0);

  let streakType = null, streakCount = 0;
  for (let i = lastMatches.length - 1; i >= 0; i--) {
    const t = lastMatches[i].won ? 'win' : 'loss';
    if (streakType === null) { streakType = t; streakCount = 1; }
    else if (t === streakType) streakCount++;
    else break;
  }

  const rr_trend = {
    net_rr: netRR,
    avg_rr_per_win: winRRs.length ? Math.round(winRRs.reduce((a, b) => a + b, 0) / winRRs.length) : null,
    avg_rr_per_loss: lossRRs.length ? Math.round(lossRRs.reduce((a, b) => a + b, 0) / lossRRs.length) : null,
    current_streak: streakType ? { type: streakType, count: streakCount } : null,
  };

  // Per-game summary with scoreboard position (ACS rank within own team)
  const recent_games = lastMatches.map((m, i) => {
    let scoreboard_rank = null, team_size = null;
    for (const side of (m.scoreboard ?? [])) {
      if (side.is_my_team) {
        const idx = side.players.findIndex(p => p.is_me);
        if (idx !== -1) { scoreboard_rank = idx + 1; team_size = side.players.length; }
      }
    }
    return {
      game: i + 1,
      map: m.map,
      agent: m.agent,
      won: m.won,
      rr_change: m.rr_change,
      kda: m.kda,
      acs: m.acs,
      adr: m.adr,
      hs_pct: m.hsPct,
      scoreboard_rank,
      team_size,
    };
  });

  return {
    player,
    rank,
    season,
    career,
    recent_avg: { kd: recent.kd, acs: recent.acsAvg, hs_pct: recent.hsPct, adr: recent.adr },
    rr_trend,
    agents,
    map_stats,
    recent_games,
  };
}

export function buildSnapshot(accountData, rankData, matchesArray, mmrHistoryData) {
  const puuid = accountData.puuid;
  const region = accountData.region || 'na';

  const player = {
    name: accountData.name,
    tag: accountData.tag,
    region,
    level: accountData.account_level ?? 0,
  };

  // v2 MMR: data.current.tier.name / data.current.rr / data.current.last_change
  const current = rankData?.current ?? {};
  const peak = rankData?.peak ?? {};
  const rank = {
    current: current.tier?.name ?? 'Unranked',
    rr: current.rr ?? 0,
    lastChange: current.last_change ?? 0,
    elo: current.elo ?? 0,
    gamesNeeded: current.games_needed_for_rating ?? 0,
    // v3: leaderboard_placement is { rank, updated_at }; v2: nullable number
    leaderboard: current.leaderboard_placement?.rank ?? current.leaderboard_placement ?? null,
    peak: peak.tier?.name ?? 'Unranked',
    peakSeason: peak.season?.short ?? '',
  };

  // Build match_id → RR info lookup from MMR history
  const rrByMatchId = {};
  const historyEntries = mmrHistoryData?.history ?? (Array.isArray(mmrHistoryData) ? mmrHistoryData : []);
  historyEntries.forEach(h => {
    if (h.match_id) {
      rrByMatchId[h.match_id] = {
        rr_change: h.last_change ?? null,
        tier_after: h.tier?.name ?? null,
        was_derank_protected: h.was_derank_protected ?? false,
        refunded_rr: h.refunded_rr ?? 0,
      };
    }
  });

  const safeMatches = Array.isArray(matchesArray) ? matchesArray : [];

  let totalKills = 0;
  let totalDeaths = 0;
  let totalRounds = 0;
  let totalHead = 0;
  let totalBody = 0;
  let totalLeg = 0;
  let totalDamage = 0;
  let wins = 0;
  let acsValues = [];
  const agentMap = {};
  const lastMatches = [];
  let latestSeason = '';

  safeMatches.forEach((match) => {
    const me = match.players?.find((p) => p.puuid === puuid);
    if (!me) return;

    const matchId = match.metadata?.match_id ?? null;
    const rounds = getRoundsPlayed(match);
    const stats = me.stats ?? {};
    const kills = stats.kills ?? 0;
    const deaths = stats.deaths ?? 0;
    const assists = stats.assists ?? 0;
    const score = stats.score ?? 0;
    const head = stats.headshots ?? 0;
    const body = stats.bodyshots ?? 0;
    const leg = stats.legshots ?? 0;
    const damage = stats.damage?.dealt ?? stats.damage ?? 0;

    const { won, resultStr } = getPlayerResult(match, me);
    const matchACS = rounds > 0 ? calcACS(score, rounds) : 0;
    const agentName = getAgentName(me);
    const mapName = getMapName(match);
    const season = match.metadata?.season?.short ?? match.metadata?.season ?? '';
    if (season && !latestSeason) latestSeason = season;

    totalKills += kills;
    totalDeaths += deaths;
    totalRounds += rounds;
    totalHead += head;
    totalBody += body;
    totalLeg += leg;
    totalDamage += damage;
    if (won) wins++;
    if (matchACS > 0) acsValues.push(matchACS);

    if (!agentMap[agentName]) {
      agentMap[agentName] = { name: agentName, games: 0, kills: 0, deaths: 0, acsSum: 0, wins: 0 };
    }
    agentMap[agentName].games++;
    agentMap[agentName].kills += kills;
    agentMap[agentName].deaths += deaths;
    agentMap[agentName].acsSum += matchACS;
    if (won) agentMap[agentName].wins++;

    // Build scoreboard: all players split by team, with stats
    const { red, blue } = getTeams(match);
    const myTeamId = me.team_id?.toLowerCase();
    const scoreboard = ['red', 'blue'].map(teamId => {
      const teamPlayers = (match.players ?? [])
        .filter(p => p.team_id?.toLowerCase() === teamId)
        .map(p => {
          const ps = p.stats ?? {};
          const pd = ps.damage?.dealt ?? ps.damage ?? 0;
          const pr = rounds > 0 ? rounds : 1;
          const rawName = `${p.name ?? ''}#${p.tag ?? ''}`;
          return {
            name: rawName === '#' ? '' : rawName,
            agent: getAgentName(p),
            tier: p.tier?.name ?? null,
            is_me: p.puuid === puuid,
            kills: ps.kills ?? 0,
            deaths: ps.deaths ?? 0,
            assists: ps.assists ?? 0,
            acs: calcACS(ps.score ?? 0, pr),
            hs_pct: calcHSPercent(ps.headshots ?? 0, ps.bodyshots ?? 0, ps.legshots ?? 0),
            adr: calcADR(pd, pr),
            eco_avg: Math.round(p.economy?.spent?.average ?? p.economy?.average_spent ?? 0) || null,
          };
        })
        .sort((a, b) => b.acs - a.acs);
      const teamObj = teamId === 'red' ? red : blue;
      const didWin = teamWon(teamObj);
      return { team: teamId, won: didWin, is_my_team: teamId === myTeamId, players: teamPlayers };
    });

    const rrInfo = matchId ? (rrByMatchId[matchId] ?? null) : null;

    lastMatches.push({
      map: mapName,
      agent: agentName,
      result: resultStr,
      won,
      kda: `${kills}/${deaths}/${assists}`,
      acs: matchACS,
      kills, deaths, assists,
      hsPct: calcHSPercent(head, body, leg),
      adr: calcADR(damage, rounds),
      started_at: match.metadata?.started_at ?? '',
      game_length_ms: match.metadata?.game_length_in_ms ?? null,
      season,
      match_id: matchId,
      rr_change: rrInfo?.rr_change ?? null,
      was_derank_protected: rrInfo?.was_derank_protected ?? false,
      scoreboard,
      matchRef: match,
    });
  });

  const games = lastMatches.length;
  const acsAvg = acsValues.length
    ? Math.round(acsValues.reduce((a, b) => a + b, 0) / acsValues.length)
    : 0;

  const agents = Object.values(agentMap)
    .sort((a, b) => b.games - a.games)
    .slice(0, 3)
    .map((a) => ({
      name: a.name,
      games: a.games,
      kd: calcKD(a.kills, a.deaths),
      acs: a.games > 0 ? Math.round(a.acsSum / a.games) : 0,
      winRate: calcWinRate(a.wins, a.games),
    }));

  return {
    player,
    rank,
    season: latestSeason,
    career: { games, wins, winrate: calcWinRate(wins, games) },
    recent: {
      games,
      kd: calcKD(totalKills, totalDeaths),
      acsAvg,
      hsPct: calcHSPercent(totalHead, totalBody, totalLeg),
      adr: calcADR(totalDamage, totalRounds),
    },
    agents,
    lastMatches,
  };
}
