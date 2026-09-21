import { Match, PointsRule } from "./types";

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
