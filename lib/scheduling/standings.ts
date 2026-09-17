import { Match } from "./types";

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
  scores?: Record<string, { home: number | null; away: number | null }>
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

        if (hScore > aScore) {
          homeStats.won += 1;
          homeStats.points += 3;
          awayStats.lost += 1;
        } else if (aScore > hScore) {
          awayStats.won += 1;
          awayStats.points += 3;
          homeStats.lost += 1;
        } else {
          homeStats.drawn += 1;
          homeStats.points += 1;
          awayStats.drawn += 1;
          awayStats.points += 1;
        }
      }
    }
  }

  return Object.values(table).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.localeCompare(b.team, "fa");
  });
}
