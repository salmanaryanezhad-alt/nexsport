import { Match, RoundRobinRound, ScheduleValidationError } from "./types";
import { shuffle } from "./shuffle";

const BYE = "__BYE__";

/**
 * Standard "circle method" round-robin generator.
 * Guarantees every team plays every other team exactly once, with no
 * repeated fixtures, and alternates home/away assignment across rounds
 * to keep the home/away count roughly balanced.
 *
 * Team order is shuffled first (this is the "قرعه‌کشی" / draw step), so
 * the fixture list — who plays whom in which round — is different every
 * time you generate, even for the exact same list of teams.
 */
export function generateSingleRoundRobin(teamsInput: string[]): RoundRobinRound[] {
  if (teamsInput.length < 2) {
    throw new ScheduleValidationError("برای تولید برنامه لیگ حداقل به ۲ تیم نیاز است.");
  }

  const teams = shuffle(teamsInput);
  const hasBye = teams.length % 2 !== 0;
  if (hasBye) teams.push(BYE);

  const n = teams.length;
  const totalRounds = n - 1;
  const half = n / 2;

  const fixed = teams[0];
  let rotating = teams.slice(1);

  const rounds: RoundRobinRound[] = [];

  for (let r = 0; r < totalRounds; r++) {
    const current = [fixed, ...rotating];
    const matches: Match[] = [];

    for (let i = 0; i < half; i++) {
      const a = current[i];
      const b = current[n - 1 - i];
      if (a === BYE || b === BYE) {
        continue;
      }
      // Alternate home/away by round + position so no single team is
      // permanently stuck at home or away.
      const swap = (r + i) % 2 === 1;
      matches.push(swap ? { home: b, away: a } : { home: a, away: b });
    }

    rounds.push({ round: r + 1, matches });

    // rotate: last element of rotating moves to the front
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  return rounds;
}

/**
 * Double round-robin ("رفت و برگشت"): every pair meets twice, once at
 * each team's home. The second leg mirrors the first leg's fixtures
 * with home/away swapped, appended as a second half of the calendar.
 */
export function generateDoubleRoundRobin(teamsInput: string[]): RoundRobinRound[] {
  const firstLeg = generateSingleRoundRobin(teamsInput);
  const roundsCount = firstLeg.length;

  const secondLeg: RoundRobinRound[] = firstLeg.map((round) => ({
    round: round.round + roundsCount,
    matches: round.matches.map((m) => ({ home: m.away, away: m.home })),
  }));

  return [...firstLeg, ...secondLeg];
}