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
    const rawMatches: Match[] = [];

    for (let i = 0; i < half; i++) {
      const a = current[i];
      const b = current[n - 1 - i];
      if (a === BYE || b === BYE) {
        continue;
      }
      // Alternate home/away by round + position so no single team is
      // permanently stuck at home or away.
      const swap = (r + i) % 2 === 1;
      const home = swap ? b : a;
      const away = swap ? a : b;
      rawMatches.push({
        home,
        away,
      });
    }

    // Shuffle match order within each round so no team always plays the first match
    const randomizedMatches = shuffle(rawMatches).map((m, mIdx) => ({
      ...m,
      id: `r${r + 1}-m${mIdx + 1}`,
    }));

    rounds.push({ round: r + 1, matches: randomizedMatches });

    // rotate: last element of rotating moves to the front
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  return rounds;
}

/**
 * Double round-robin ("رفت و برگشت"): every pair meets twice, once at
 * each team's home.
 *
 * If `options?.independentSecondLeg === false`:
 *   Mirrored / Traditional calendar where round k + 1 repeats round 1's
 *   fixtures with inverted home/away.
 *
 * If `options?.independentSecondLeg === true` (or omitted, default):
 *   Asymmetrical calendar (European league style like Premier League/La Liga),
 *   where the second-leg calendar is an independent draw of rounds, ensuring
 *   teams don't immediately replay the same opponent back-to-back.
 */
export function generateDoubleRoundRobin(
  teamsInput: string[],
  options?: { independentSecondLeg?: boolean }
): RoundRobinRound[] {
  const firstLeg = generateSingleRoundRobin(teamsInput);
  const roundsCount = firstLeg.length;
  const independent = options?.independentSecondLeg ?? true;

  if (!independent) {
    // Mirrored / Traditional calendar
    const secondLeg: RoundRobinRound[] = firstLeg.map((round) => ({
      round: round.round + roundsCount,
      matches: round.matches.map((m, i) => ({
        ...m,
        id: `r${round.round + roundsCount}-m${i + 1}`,
        home: m.away,
        away: m.home,
      })),
    }));
    return [...firstLeg, ...secondLeg];
  }

  // Independent / Asymmetrical calendar (Top European League style)
  const invertedRounds = firstLeg.map((round, origIdx) => ({
    origIdx,
    matches: round.matches.map((m) => ({
      home: m.away,
      away: m.home,
    })),
  }));

  // Shuffle the sequence of rounds for the second leg
  let shuffledRounds = shuffle(invertedRounds);
  if (roundsCount > 1) {
    for (let attempt = 0; attempt < 25; attempt++) {
      if (shuffledRounds[0].origIdx !== roundsCount - 1) {
        break; // Good: doesn't immediately repeat the last round of first leg
      }
      shuffledRounds = shuffle(invertedRounds);
    }
  }

  const secondLeg: RoundRobinRound[] = shuffledRounds.map((r, idx) => {
    const roundNumber = roundsCount + idx + 1;
    const randomizedMatches = shuffle(r.matches).map((m, mIdx) => ({
      ...m,
      id: `r${roundNumber}-m${mIdx + 1}`,
    }));
    return {
      round: roundNumber,
      matches: randomizedMatches,
    };
  });

  return [...firstLeg, ...secondLeg];
}