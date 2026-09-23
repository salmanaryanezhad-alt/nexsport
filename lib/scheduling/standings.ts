import { Match, PointsRule, GroupResult } from "./types";

export interface TeamStanding {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export function calculateStandings(
  teams: string[],
  matches: Match[],
  scores?: Record<string, { home: number | null; away: number | null }>,
  pointsRule: PointsRule = { win: 3, draw: 1, loss: 0 }
): TeamStanding[] {
  const table: Record<string, TeamStanding> = {};

  for (const team of teams) {
    table[team] = {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    };
  }

  for (const m of matches) {
    if (m.isBye || !m.home || !m.away) continue;

    const score =
      m.id && scores && scores[m.id]
        ? scores[m.id]
        : {
            home: m.homeScore ?? null,
            away: m.awayScore ?? null,
          };

    if (
      score.home !== null &&
      score.home !== undefined &&
      score.away !== null &&
      score.away !== undefined &&
      !isNaN(Number(score.home)) &&
      !isNaN(Number(score.away))
    ) {
      const hScore = Number(score.home);
      const aScore = Number(score.away);
      const homeStats = table[m.home];
      const awayStats = table[m.away];

      if (homeStats && awayStats) {
        homeStats.played += 1;
        awayStats.played += 1;
        homeStats.goalsFor += hScore;
        homeStats.goalsAgainst += aScore;
        awayStats.goalsFor += aScore;
        awayStats.goalsAgainst += hScore;
        homeStats.goalDifference = homeStats.goalsFor - homeStats.goalsAgainst;
        awayStats.goalDifference = awayStats.goalsFor - awayStats.goalsAgainst;

        if (pointsRule.sport === "volleyball") {
          // FIVB Volleyball official rules:
          // Win 3-0 or 3-1: Winner gets 3 pts, Loser gets 0 pts
          // Win 3-2: Winner gets 2 pts, Loser gets 1 pt
          const diff = Math.abs(hScore - aScore);
          if (hScore > aScore) {
            homeStats.won += 1;
            awayStats.lost += 1;
            if (diff >= 2) {
              homeStats.points += 3;
              awayStats.points += 0;
            } else {
              homeStats.points += 2;
              awayStats.points += 1;
            }
          } else if (aScore > hScore) {
            awayStats.won += 1;
            homeStats.lost += 1;
            if (diff >= 2) {
              awayStats.points += 3;
              homeStats.points += 0;
            } else {
              awayStats.points += 2;
              homeStats.points += 1;
            }
          }
        } else if (pointsRule.sport === "beach-soccer") {
          // FIFA / BSWW Beach Soccer official rules:
          // Regular time win: 3 pts, Loser 0
          // Extra time win: 2 pts, Loser 0
          // Penalty shootout win: 1 pt, Loser 0
          if (hScore > aScore) {
            homeStats.won += 1;
            homeStats.points += pointsRule.win || 3;
            awayStats.lost += 1;
            awayStats.points += 0;
          } else if (aScore > hScore) {
            awayStats.won += 1;
            awayStats.points += pointsRule.win || 3;
            homeStats.lost += 1;
            homeStats.points += 0;
          } else {
            const fullSc = m.id && scores ? (scores[m.id] as any) : null;
            const hPen = fullSc?.homePenalty ? Number(fullSc.homePenalty) : 0;
            const aPen = fullSc?.awayPenalty ? Number(fullSc.awayPenalty) : 0;
            const winner = fullSc?.winner;

            if (hPen > aPen || winner === m.home) {
              homeStats.won += 1;
              homeStats.points += pointsRule.winPenalties ?? 1;
              awayStats.lost += 1;
              awayStats.points += 0;
            } else if (aPen > hPen || winner === m.away) {
              awayStats.won += 1;
              awayStats.points += pointsRule.winPenalties ?? 1;
              homeStats.lost += 1;
              homeStats.points += 0;
            } else {
              homeStats.drawn += 1;
              awayStats.drawn += 1;
            }
          }
        } else {
          if (hScore > aScore) {
            homeStats.won += 1;
            homeStats.points += pointsRule.win;
            awayStats.lost += 1;
            awayStats.points += pointsRule.loss;
          } else if (aScore > hScore) {
            awayStats.won += 1;
            awayStats.points += pointsRule.win;
            homeStats.lost += 1;
            homeStats.points += pointsRule.loss;
          } else {
            homeStats.drawn += 1;
            homeStats.points += pointsRule.draw;
            awayStats.drawn += 1;
            awayStats.points += pointsRule.draw;
          }
        }
      }
    }
  }

  return Object.values(table).sort((a, b) => {
    // FIVB Volleyball official rule: Priority #1 is MATCHES WON (تعداد بردها)
    if (pointsRule.rankByWinsFirst || pointsRule.sport === "volleyball") {
      if (b.won !== a.won) return b.won - a.won;
    }
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.localeCompare(b.team, "fa");
  });
}

export interface TeamClinchStatus {
  isChampion: boolean;
  isClinched: boolean;
  isAllMatchesFinished: boolean;
}

/**
 * Calculates whether a team has mathematically clinched the championship or qualification.
 * A team receives NO badge unless mathematically clinched or all matches in the group/league are finished!
 */
export function calculateClinchStatuses(
  teams: string[],
  matches: Match[],
  scores?: Record<string, { home: number | null; away: number | null }>,
  standings?: TeamStanding[],
  qualifiersCount = 1,
  pointsRule: PointsRule = { win: 3, draw: 1, loss: 0 }
): Record<string, TeamClinchStatus> {
  const result: Record<string, TeamClinchStatus> = {};
  for (const t of teams) {
    result[t] = {
      isChampion: false,
      isClinched: false,
      isAllMatchesFinished: false,
    };
  }

  const realMatches = matches.filter((m) => !m.isBye && m.home && m.away);
  if (realMatches.length === 0) {
    return result;
  }

  const currentStandings = standings || calculateStandings(teams, realMatches, scores, pointsRule);
  if (currentStandings.length === 0) {
    return result;
  }

  const playedMatches = realMatches.filter((m) => {
    const sc = m.id && scores ? scores[m.id] : null;
    return (
      sc &&
      sc.home !== null &&
      sc.home !== undefined &&
      sc.away !== null &&
      sc.away !== undefined &&
      !isNaN(Number(sc.home)) &&
      !isNaN(Number(sc.away))
    );
  });

  const isAllMatchesFinished = playedMatches.length === realMatches.length;

  // 1. If all matches in this group/league are finished:
  if (isAllMatchesFinished) {
    for (let i = 0; i < currentStandings.length; i++) {
      const s = currentStandings[i];
      if (i === 0 && qualifiersCount === 1) {
        result[s.team] = {
          isChampion: true,
          isClinched: true,
          isAllMatchesFinished: true,
        };
      } else if (i < qualifiersCount) {
        result[s.team] = {
          isChampion: false,
          isClinched: true,
          isAllMatchesFinished: true,
        };
      } else {
        result[s.team] = {
          isChampion: false,
          isClinched: false,
          isAllMatchesFinished: true,
        };
      }
    }
    return result;
  }

  // 2. If no matches played yet:
  if (playedMatches.length === 0) {
    return result;
  }

  // 3. Mathematical clinch calculation:
  const winPts = pointsRule.sport === "volleyball" ? 3 : (pointsRule.win ?? 3);
  const teamMaxPoints: Record<string, number> = {};
  const teamCurrentPoints: Record<string, number> = {};
  const teamPlayedCount: Record<string, number> = {};

  for (const s of currentStandings) {
    const totalForTeam = realMatches.filter((m) => m.home === s.team || m.away === s.team).length;
    const remaining = Math.max(0, totalForTeam - s.played);
    teamCurrentPoints[s.team] = s.points;
    teamPlayedCount[s.team] = s.played;
    teamMaxPoints[s.team] = s.points + remaining * winPts;
  }

  for (let i = 0; i < currentStandings.length; i++) {
    const teamA = currentStandings[i].team;
    const ptsA = teamCurrentPoints[teamA] ?? 0;
    const playedA = teamPlayedCount[teamA] ?? 0;

    // A team that hasn't played a game cannot have clinched anything
    if (playedA === 0) continue;

    // Other teams that could mathematically achieve >= ptsA
    const othersWhoCanCatch = currentStandings.filter(
      (s) => s.team !== teamA && (teamMaxPoints[s.team] ?? 0) >= ptsA
    );

    // If strictly fewer than qualifiersCount other teams can catch teamA:
    if (othersWhoCanCatch.length < qualifiersCount) {
      const isChamp = qualifiersCount === 1 && othersWhoCanCatch.length === 0;
      result[teamA] = {
        isChampion: isChamp,
        isClinched: true,
        isAllMatchesFinished: false,
      };
    }
  }

  return result;
}

/**
 * Returns a map of rank (1-based) to team name for ranks that are 100% mathematically locked.
 */
export function getLockedRanksForGroup(
  teams: string[],
  matches: Match[],
  scores?: Record<string, { home: number | null; away: number | null }>,
  pointsRule: PointsRule = { win: 3, draw: 1, loss: 0 }
): Map<number, string> {
  const locked = new Map<number, string>();
  const realMatches = matches.filter((m) => !m.isBye && m.home && m.away);
  if (realMatches.length === 0) return locked;

  const standings = calculateStandings(teams, realMatches, scores, pointsRule);
  if (standings.length === 0) return locked;

  const playedMatches = realMatches.filter((m) => {
    const sc = m.id && scores ? scores[m.id] : null;
    return (
      sc &&
      sc.home !== null &&
      sc.home !== undefined &&
      sc.away !== null &&
      sc.away !== undefined &&
      !isNaN(Number(sc.home)) &&
      !isNaN(Number(sc.away))
    );
  });

  const isAllPlayed = playedMatches.length === realMatches.length;

  if (isAllPlayed) {
    for (let r = 1; r <= standings.length; r++) {
      locked.set(r, standings[r - 1].team);
    }
    return locked;
  }

  if (playedMatches.length === 0) return locked;

  const winPts = pointsRule.sport === "volleyball" ? 3 : (pointsRule.win ?? 3);
  const teamMaxPoints: Record<string, number> = {};
  for (const s of standings) {
    const total = realMatches.filter((m) => m.home === s.team || m.away === s.team).length;
    const remaining = Math.max(0, total - s.played);
    teamMaxPoints[s.team] = s.points + remaining * winPts;
  }

  // Check Rank 1:
  const team1 = standings[0];
  if (team1.played > 0) {
    const cannotBeCaught = standings.slice(1).every((o) => (teamMaxPoints[o.team] ?? 0) < team1.points);
    if (cannotBeCaught) {
      locked.set(1, team1.team);
    }
  }

  // Check Rank 2:
  if (locked.has(1) && standings.length > 1) {
    const team2 = standings[1];
    if (team2.played > 0) {
      const team1Pts = standings[0].points;
      const cannotCatch1 = (teamMaxPoints[team2.team] ?? 0) < team1Pts;
      const cannotBeCaughtByLower = standings.slice(2).every((o) => (teamMaxPoints[o.team] ?? 0) < team2.points);
      if (cannotCatch1 && cannotBeCaughtByLower) {
        locked.set(2, team2.team);
      }
    }
  }

  return locked;
}

export interface BestThirdStanding {
  team: string;
  groupName: string;
  standing: TeamStanding;
}

/**
 * Ranks all 3rd-placed teams across groups according to official tournament tiebreaker rules.
 * Used for Euro-style qualification to the knockout stage and for standings comparison.
 */
export function getBestThirdsRanking(
  groups: GroupResult[],
  scores?: Record<string, { home: number | null; away: number | null }>,
  pointsRule?: PointsRule
): {
  allCompleted: boolean;
  rankedThirds: BestThirdStanding[];
} {
  let allCompleted = true;
  const thirds: BestThirdStanding[] = [];

  for (const g of groups) {
    const gMatches = g.rounds.flatMap((r) => r.matches).filter((m) => !m.isBye && m.home && m.away);
    const playedCount = gMatches.filter((m) => {
      const sc = m.id && scores ? scores[m.id] : undefined;
      return (
        sc &&
        sc.home !== null &&
        sc.home !== undefined &&
        sc.away !== null &&
        sc.away !== undefined &&
        !isNaN(Number(sc.home)) &&
        !isNaN(Number(sc.away))
      );
    }).length;

    if (playedCount < gMatches.length || gMatches.length === 0) {
      allCompleted = false;
    }

    const st = calculateStandings(g.teams, gMatches, scores, pointsRule);
    if (st.length >= 3) {
      thirds.push({
        team: st[2].team,
        groupName: g.name,
        standing: st[2],
      });
    }
  }

  thirds.sort((a, b) => {
    const sA = a.standing;
    const sB = b.standing;
    if (pointsRule?.rankByWinsFirst || pointsRule?.sport === "volleyball") {
      if (sB.won !== sA.won) return sB.won - sA.won;
    }
    if (sB.points !== sA.points) return sB.points - sA.points;
    if (sB.goalDifference !== sA.goalDifference) return sB.goalDifference - sA.goalDifference;
    if (sB.goalsFor !== sA.goalsFor) return sB.goalsFor - sA.goalsFor;
    if (sB.won !== sA.won) return sB.won - sA.won;
    return a.team.localeCompare(b.team, "fa");
  });

  return { allCompleted, rankedThirds: thirds };
}
