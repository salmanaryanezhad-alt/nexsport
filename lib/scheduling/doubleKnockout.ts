import {
  BracketMatch,
  BracketRound,
  DoubleKnockoutResult,
  ScheduleValidationError,
} from "./types";
import { shuffle } from "./shuffle";
import { nextPowerOfTwo, seedOrder, MatchScore, resolveWinner } from "./knockout";

const BYE = null;

export interface BuildDoubleKnockoutParams {
  teams: string[];
  seededTeams?: string[];
  hasResetFinal?: boolean;
}

export function buildDoubleKnockout({
  teams,
  seededTeams = [],
  hasResetFinal = false,
}: BuildDoubleKnockoutParams): DoubleKnockoutResult {
  if (teams.length < 3) {
    throw new ScheduleValidationError("برای تورنمنت دو حذفی حداقل به ۳ تیم نیاز است.");
  }

  const trimmed = teams.map((t) => t.trim());
  if (trimmed.some((t) => t.length === 0)) {
    throw new ScheduleValidationError("نام همه تیم‌ها باید پر شده باشد.");
  }
  const unique = new Set(trimmed.map((t) => t.toLowerCase()));
  if (unique.size !== trimmed.length) {
    throw new ScheduleValidationError("نام تیم‌ها باید یکتا باشد؛ دو تیم هم‌نام وجود دارد.");
  }

  const unknownSeed = seededTeams.find((t) => !teams.includes(t));
  if (unknownSeed) {
    throw new ScheduleValidationError(`تیم شاخص «${unknownSeed}» در لیست تیم‌ها یافت نشد.`);
  }

  const bracketSize = nextPowerOfTwo(teams.length);
  const byes = bracketSize - teams.length;
  const k = Math.round(Math.log2(bracketSize));

  // Seed allocation
  const rest = shuffle(teams.filter((t) => !seededTeams.includes(t)));
  const seedToTeam = new Map<number, string | null>();
  const orderedTeams = [...seededTeams, ...rest];
  for (let i = 0; i < bracketSize; i++) {
    seedToTeam.set(i + 1, orderedTeams[i] ?? null);
  }

  const order = seedOrder(bracketSize);
  const slotTeams: (string | null)[] = order.map((seed) => seedToTeam.get(seed) ?? BYE);

  // 1. Build Winners Bracket (WB)
  const winnersRounds: BracketRound[] = [];
  let currentMatchCount = bracketSize / 2;
  let wbMatchCounter = 1;

  for (let r = 0; r < k; r++) {
    const roundsFromWbFinal = k - 1 - r;
    let label = `دور ${r + 1} جدول برندگان`;
    if (roundsFromWbFinal === 0) label = "فینال جدول برندگان";
    else if (roundsFromWbFinal === 1) label = "نیمه‌نهایی جدول برندگان";
    else if (roundsFromWbFinal === 2) label = "یک‌چهارم نهایی جدول برندگان";
    else if (roundsFromWbFinal === 3) label = "یک‌هشتم نهایی جدول برندگان";

    const matches: BracketMatch[] = [];

    for (let m = 0; m < currentMatchCount; m++) {
      const matchId = `wb-r${r + 1}-m${m + 1}`;
      const isWbFinal = roundsFromWbFinal === 0;
      const matchCode = isWbFinal ? "W-Final" : `W${wbMatchCounter++}`;

      if (r === 0) {
        const home = slotTeams[m * 2] ?? null;
        const away = slotTeams[m * 2 + 1] ?? null;
        const autoAdvance =
          home === BYE && away !== BYE
            ? away
            : away === BYE && home !== BYE
            ? home
            : null;

        const isBye =
          (home === BYE && away !== BYE) || (away === BYE && home !== BYE);

        matches.push({
          id: matchId,
          round: r + 1,
          slot: m + 1,
          matchCode,
          home,
          away,
          homePlaceholder: home ?? (isBye ? "قرعه استراحت (Bye)" : `تیم ${m * 2 + 1}`),
          awayPlaceholder: away ?? (isBye ? "قرعه استراحت (Bye)" : `تیم ${m * 2 + 2}`),
          isBye,
          autoAdvance,
          nextMatchWinnerCode: isWbFinal ? "صعود به فینال بزرگ (GF)" : "صعود به دور بعد برندگان",
          nextMatchLoserCode: isBye ? "بدون باخت (استراحت)" : "انتقال به جدول شانس مجدد (دور ۱)",
        });
      } else {
        const feederHomeId = `wb-r${r}-m${m * 2 + 1}`;
        const feederAwayId = `wb-r${r}-m${m * 2 + 2}`;

        matches.push({
          id: matchId,
          round: r + 1,
          slot: m + 1,
          matchCode,
          home: null,
          away: null,
          homePlaceholder: `برنده بازی قبلی (${feederHomeId.toUpperCase()})`,
          awayPlaceholder: `برنده بازی قبلی (${feederAwayId.toUpperCase()})`,
          sourceMatchHomeId: feederHomeId,
          sourceMatchAwayId: feederAwayId,
          nextMatchWinnerCode: isWbFinal ? "صعود به فینال بزرگ (GF)" : "صعود به دور بعد برندگان",
          nextMatchLoserCode: "انتقال به جدول شانس مجدد",
        });
      }
    }

    winnersRounds.push({
      round: r + 1,
      label,
      matches,
    });

    currentMatchCount = Math.max(1, Math.floor(currentMatchCount / 2));
  }

  // 2. Build Losers Bracket (LB)
  const losersRounds: BracketRound[] = [];
  const totalLbRounds = Math.max(1, 2 * (k - 1));
  let lbMatchCounter = 1;

  if (k > 1) {
    let lbMatchCount = bracketSize / 4;

    for (let r = 0; r < totalLbRounds; r++) {
      const roundNum = r + 1;
      const isLbFinal = roundNum === totalLbRounds;
      const isLbSemi = roundNum === totalLbRounds - 1;

      let label = `دور ${roundNum} شانس مجدد`;
      if (isLbFinal) label = "فینال جدول بازندگان (تعیین فینالیست دوم)";
      else if (isLbSemi && totalLbRounds > 2) label = "نیمه‌نهایی جدول بازندگان";

      const matches: BracketMatch[] = [];

      if (roundNum === 1) {
        // Round 1: takes losers of WB Round 1
        for (let m = 0; m < lbMatchCount; m++) {
          const feederHomeId = `wb-r1-m${m * 2 + 1}`;
          const feederAwayId = `wb-r1-m${m * 2 + 2}`;
          const matchCode = isLbFinal ? "L-Final" : `L${lbMatchCounter++}`;

          matches.push({
            id: `lb-r1-m${m + 1}`,
            round: 1,
            slot: m + 1,
            matchCode,
            home: null,
            away: null,
            homePlaceholder: `بازنده بازی W${m * 2 + 1}`,
            awayPlaceholder: `بازنده بازی W${m * 2 + 2}`,
            sourceMatchHomeId: feederHomeId,
            sourceMatchAwayId: feederAwayId,
            nextMatchWinnerCode: isLbFinal ? "صعود به فینال بزرگ (GF)" : "صعود به دور بعد شانس مجدد",
            nextMatchLoserCode: "❌ حذف قطعی از مسابقات",
          });
        }
      } else if (roundNum % 2 === 0) {
        // Even round: winners of previous LB round meet drop-down losers from corresponding WB round
        const wbRound = Math.floor(roundNum / 2) + 1;
        const wbMatchesCount = winnersRounds[wbRound - 1]?.matches.length ?? lbMatchCount;

        for (let m = 0; m < lbMatchCount; m++) {
          const feederHomeId = `lb-r${roundNum - 1}-m${m + 1}`;
          const wbMatchSlot = wbMatchesCount - m;
          const feederAwayId = `wb-r${wbRound}-m${wbMatchSlot}`;
          const matchCode = isLbFinal ? "L-Final" : `L${lbMatchCounter++}`;

          matches.push({
            id: `lb-r${roundNum}-m${m + 1}`,
            round: roundNum,
            slot: m + 1,
            matchCode,
            home: null,
            away: null,
            homePlaceholder: `برنده دور قبل شانس مجدد`,
            awayPlaceholder: `بازنده دور ${wbRound} برندگان`,
            sourceMatchHomeId: feederHomeId,
            sourceMatchAwayId: feederAwayId,
            nextMatchWinnerCode: isLbFinal ? "صعود به فینال بزرگ (GF)" : "صعود به دور بعد شانس مجدد",
            nextMatchLoserCode: "❌ حذف قطعی از مسابقات",
          });
        }
      } else {
        // Odd round (> 1): winners of previous LB round play each other
        for (let m = 0; m < lbMatchCount; m++) {
          const feederHomeId = `lb-r${roundNum - 1}-m${m * 2 + 1}`;
          const feederAwayId = `lb-r${roundNum - 1}-m${m * 2 + 2}`;
          const matchCode = isLbFinal ? "L-Final" : `L${lbMatchCounter++}`;

          matches.push({
            id: `lb-r${roundNum}-m${m + 1}`,
            round: roundNum,
            slot: m + 1,
            matchCode,
            home: null,
            away: null,
            homePlaceholder: `برنده دور قبل شانس مجدد`,
            awayPlaceholder: `برنده دور قبل شانس مجدد`,
            sourceMatchHomeId: feederHomeId,
            sourceMatchAwayId: feederAwayId,
            nextMatchWinnerCode: isLbFinal ? "صعود به فینال بزرگ (GF)" : "صعود به دور بعد شانس مجدد",
            nextMatchLoserCode: "❌ حذف قطعی از مسابقات",
          });
        }
      }

      losersRounds.push({
        round: roundNum,
        label,
        matches,
      });

      if (roundNum % 2 === 0) {
        lbMatchCount = Math.max(1, Math.floor(lbMatchCount / 2));
      }
    }
  }

  // 3. Build Grand Final
  const wbFinal = winnersRounds[winnersRounds.length - 1]?.matches[0];
  const lbFinal = losersRounds[losersRounds.length - 1]?.matches[0];
  const wbFinalId = wbFinal?.id ?? "wb-r1-m1";
  const lbFinalId = lbFinal?.id ?? wbFinalId;

  const grandFinal: BracketMatch = {
    id: "gf-m1",
    round: 1,
    slot: 1,
    matchCode: "فینال کل (GF)",
    home: null,
    away: null,
    homePlaceholder: "قهرمان جدول برندگان",
    awayPlaceholder: "قهرمان جدول شانس مجدد",
    sourceMatchHomeId: wbFinalId,
    sourceMatchAwayId: lbFinalId,
    nextMatchWinnerCode: "👑 قهرمان نهایی مسابقات",
    nextMatchLoserCode: hasResetFinal
      ? "در صورت شکست قهرمان برندگان ⬅️ فینال دوم"
      : "🥈 نایب‌قهرمان مسابقات",
  };

  const bracketResetMatch: BracketMatch | null = hasResetFinal
    ? {
        id: "gf-reset",
        round: 2,
        slot: 1,
        matchCode: "فینال مجدد (GF2)",
        home: null,
        away: null,
        homePlaceholder: "قهرمان جدول برندگان",
        awayPlaceholder: "قهرمان جدول بازندگان",
        sourceMatchHomeId: "gf-m1",
        sourceMatchAwayId: "gf-m1",
        nextMatchWinnerCode: "👑 قهرمان قطعی تورنمنت",
        nextMatchLoserCode: "🥈 نایب‌قهرمان مسابقات",
      }
    : null;

  return {
    bracketSize,
    byes,
    winnersBracket: winnersRounds,
    losersBracket: losersRounds,
    grandFinal,
    bracketResetMatch,
  };
}

export function computeDoubleKnockoutWithScores(
  doubleKnockout: DoubleKnockoutResult,
  scores: Record<string, MatchScore>
): {
  doubleKnockout: DoubleKnockoutResult;
  champion: string | null;
  runnerUp: string | null;
  thirdPlace: string | null;
} {
  const matchWinners = new Map<string, string | null>();
  const matchLosers = new Map<string, string | null>();
  const matchCodes = new Map<string, string>();

  // Collect all matchCodes for friendly placeholder formatting
  for (const r of doubleKnockout.winnersBracket) {
    for (const m of r.matches) {
      if (m.matchCode) matchCodes.set(m.id, m.matchCode);
    }
  }
  for (const r of doubleKnockout.losersBracket) {
    for (const m of r.matches) {
      if (m.matchCode) matchCodes.set(m.id, m.matchCode);
    }
  }

  // 1. Process Winners Bracket
  const winnersBracket: BracketRound[] = doubleKnockout.winnersBracket.map((round) => ({
    round: round.round,
    label: round.label,
    matches: round.matches.map((m) => ({ ...m })),
  }));

  for (let r = 0; r < winnersBracket.length; r++) {
    const round = winnersBracket[r];

    for (const match of round.matches) {
      if (r > 0 && match.sourceMatchHomeId && match.sourceMatchAwayId) {
        match.home = matchWinners.get(match.sourceMatchHomeId) ?? null;
        match.away = matchWinners.get(match.sourceMatchAwayId) ?? null;

        const homeFeederCode = matchCodes.get(match.sourceMatchHomeId) || match.sourceMatchHomeId.toUpperCase();
        const awayFeederCode = matchCodes.get(match.sourceMatchAwayId) || match.sourceMatchAwayId.toUpperCase();
        match.homePlaceholder = match.home ?? `برنده بازی ${homeFeederCode}`;
        match.awayPlaceholder = match.away ?? `برنده بازی ${awayFeederCode}`;
      }

      const sc = scores[match.id];
      if (sc) {
        match.homeScore = sc.home;
        match.awayScore = sc.away;
        match.homePenalty = sc.homePenalty;
        match.awayPenalty = sc.awayPenalty;
      }

      match.winner = resolveWinner(match.home, match.away, sc, match.autoAdvance);

      if (match.winner) {
        matchWinners.set(match.id, match.winner);
        if (match.home && match.away && match.home !== "BYE" && match.away !== "BYE" && !match.isBye) {
          const loser = match.winner === match.home ? match.away : match.home;
          matchLosers.set(match.id, loser);
        } else {
          // If match had a BYE, no actual loser dropped!
          matchLosers.set(match.id, null);
        }
      }
    }
  }

  // 2. Process Losers Bracket
  const losersBracket: BracketRound[] = doubleKnockout.losersBracket.map((round) => ({
    round: round.round,
    label: round.label,
    matches: round.matches.map((m) => ({ ...m })),
  }));

  for (let r = 0; r < losersBracket.length; r++) {
    const round = losersBracket[r];

    for (const match of round.matches) {
      let homeFeederCode = "";
      let awayFeederCode = "";

      // Resolve home participant
      if (match.sourceMatchHomeId) {
        const isFromWb = match.sourceMatchHomeId.startsWith("wb-");
        homeFeederCode = matchCodes.get(match.sourceMatchHomeId) || match.sourceMatchHomeId.toUpperCase();

        if (isFromWb) {
          match.home = matchLosers.get(match.sourceMatchHomeId) ?? null;
          match.homePlaceholder = match.home ?? `بازنده بازی ${homeFeederCode}`;
        } else {
          match.home = matchWinners.get(match.sourceMatchHomeId) ?? null;
          match.homePlaceholder = match.home ?? `برنده بازی ${homeFeederCode}`;
        }
      }

      // Resolve away participant
      if (match.sourceMatchAwayId) {
        const isFromWb = match.sourceMatchAwayId.startsWith("wb-");
        awayFeederCode = matchCodes.get(match.sourceMatchAwayId) || match.sourceMatchAwayId.toUpperCase();

        if (isFromWb) {
          match.away = matchLosers.get(match.sourceMatchAwayId) ?? null;
          match.awayPlaceholder = match.away ?? `بازنده بازی ${awayFeederCode}`;
        } else {
          match.away = matchWinners.get(match.sourceMatchAwayId) ?? null;
          match.awayPlaceholder = match.away ?? `برنده بازی ${awayFeederCode}`;
        }
      }

      // Handle automatic advance in Losers Bracket ONLY when one side was an actual Bye in WB
      let autoAdvance: string | null = null;
      let isBye = false;

      // Case 1: Away slot was a Bye in WB (match finished with no loser)
      if (match.sourceMatchAwayId?.startsWith("wb-")) {
        const wbAwayFinished = matchWinners.has(match.sourceMatchAwayId);
        const wbAwayLoser = matchLosers.get(match.sourceMatchAwayId);
        if (wbAwayFinished && wbAwayLoser === null) {
          // Away slot is a Bye!
          match.awayPlaceholder = `استراحت (بدون بازنده در بازی ${awayFeederCode})`;
          if (match.home) {
            autoAdvance = match.home;
            isBye = true;
          }
        }
      }

      // Case 2: Home slot was a Bye in WB
      if (match.sourceMatchHomeId?.startsWith("wb-")) {
        const wbHomeFinished = matchWinners.has(match.sourceMatchHomeId);
        const wbHomeLoser = matchLosers.get(match.sourceMatchHomeId);
        if (wbHomeFinished && wbHomeLoser === null) {
          match.homePlaceholder = `استراحت (بدون بازنده در بازی ${homeFeederCode})`;
          if (match.away) {
            autoAdvance = match.away;
            isBye = true;
          }
        }
      }

      match.isBye = isBye;
      match.autoAdvance = autoAdvance;

      const sc = scores[match.id];
      if (sc) {
        match.homeScore = sc.home;
        match.awayScore = sc.away;
        match.homePenalty = sc.homePenalty;
        match.awayPenalty = sc.awayPenalty;
      }

      match.winner = resolveWinner(match.home, match.away, sc, autoAdvance);

      if (match.winner) {
        matchWinners.set(match.id, match.winner);
        if (match.home && match.away && !isBye) {
          const loser = match.winner === match.home ? match.away : match.home;
          matchLosers.set(match.id, loser);
        }
      }
    }
  }

  // 3. Process Grand Final
  const wbFinalId = winnersBracket[winnersBracket.length - 1]?.matches[0]?.id;
  const lbFinalId = losersBracket[losersBracket.length - 1]?.matches[0]?.id;

  const grandFinal: BracketMatch = { ...doubleKnockout.grandFinal };
  if (wbFinalId) {
    grandFinal.home = matchWinners.get(wbFinalId) ?? null;
    grandFinal.homePlaceholder = grandFinal.home ?? "قهرمان جدول برندگان";
  }
  if (lbFinalId) {
    grandFinal.away = matchWinners.get(lbFinalId) ?? null;
    grandFinal.awayPlaceholder = grandFinal.away ?? "قهرمان جدول شانس مجدد";
  }

  const gfSc = scores[grandFinal.id];
  if (gfSc) {
    grandFinal.homeScore = gfSc.home;
    grandFinal.awayScore = gfSc.away;
    grandFinal.homePenalty = gfSc.homePenalty;
    grandFinal.awayPenalty = gfSc.awayPenalty;
  }
  grandFinal.winner = resolveWinner(grandFinal.home, grandFinal.away, gfSc, null);

  // 4. Process Bracket Reset Match (if applicable)
  let bracketResetMatch: BracketMatch | null = null;
  let champion: string | null = null;
  let runnerUp: string | null = null;

  if (doubleKnockout.bracketResetMatch) {
    bracketResetMatch = { ...doubleKnockout.bracketResetMatch };
    const lbChampion = grandFinal.away;
    const wbChampion = grandFinal.home;

    // Reset match is ONLY required if the Losers Bracket winner won the Grand Final match
    if (grandFinal.winner && lbChampion && grandFinal.winner === lbChampion) {
      bracketResetMatch.home = wbChampion;
      bracketResetMatch.away = lbChampion;
      bracketResetMatch.homePlaceholder = wbChampion ?? "قهرمان جدول برندگان";
      bracketResetMatch.awayPlaceholder = lbChampion ?? "قهرمان جدول بازندگان";

      const resetSc = scores[bracketResetMatch.id];
      if (resetSc) {
        bracketResetMatch.homeScore = resetSc.home;
        bracketResetMatch.awayScore = resetSc.away;
        bracketResetMatch.homePenalty = resetSc.homePenalty;
        bracketResetMatch.awayPenalty = resetSc.awayPenalty;
      }
      bracketResetMatch.winner = resolveWinner(
        bracketResetMatch.home,
        bracketResetMatch.away,
        resetSc,
        null
      );

      if (bracketResetMatch.winner) {
        champion = bracketResetMatch.winner;
        runnerUp =
          champion === bracketResetMatch.home
            ? bracketResetMatch.away
            : bracketResetMatch.home;
      }
    } else if (grandFinal.winner && wbChampion && grandFinal.winner === wbChampion) {
      // Winners bracket champion won Grand Final! Tournament over, no reset needed.
      champion = wbChampion;
      runnerUp = lbChampion;
    }
  } else {
    // Single Grand Final mode
    if (grandFinal.winner) {
      champion = grandFinal.winner;
      runnerUp =
        champion === grandFinal.home ? grandFinal.away : grandFinal.home;
    }
  }

  // Third place is the team that lost the Losers Bracket Final
  const thirdPlace = lbFinalId ? matchLosers.get(lbFinalId) ?? null : null;

  return {
    doubleKnockout: {
      bracketSize: doubleKnockout.bracketSize,
      byes: doubleKnockout.byes,
      winnersBracket,
      losersBracket,
      grandFinal,
      bracketResetMatch,
    },
    champion,
    runnerUp,
    thirdPlace,
  };
}
