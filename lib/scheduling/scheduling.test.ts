import {
  generateSchedule,
  ScheduleValidationError,
} from "./index";
import { generateSingleRoundRobin, generateDoubleRoundRobin } from "./roundRobin";
import { buildGroups, calculateDefaultNumGroups } from "./groups";
import { buildKnockout, computeKnockoutWithScores } from "./knockout";

type TestFn = () => void;

let passed = 0;
let failed = 0;

function test(name: string, fn: TestFn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(error instanceof Error ? error.message : error);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

function assertThrows(fn: TestFn, messageContains?: string) {
  let thrown = false;

  try {
    fn();
  } catch (error) {
    thrown = true;

    if (messageContains) {
      const message = error instanceof Error ? error.message : String(error);
      assert(
        message.includes(messageContains),
        `خطای دریافت‌شده با خطای مورد انتظار مطابقت ندارد.\nExpected to contain: ${messageContains}\nActual: ${message}`
      );
    }
  }

  assert(thrown, "انتظار داشتیم تابع خطا ایجاد کند، اما خطایی ایجاد نشد.");
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join("|||");
}

function directedPairKey(home: string, away: string) {
  return `${home}|||${away}`;
}

function allMatches(rounds: { matches: { home: string; away: string }[] }[]) {
  return rounds.flatMap((round) => round.matches);
}

/* =========================================================
   لیگ یک‌دور
   ========================================================= */

test("لیگ 4 تیمی: تعداد دورها درست است", () => {
  const rounds = generateSingleRoundRobin(["A", "B", "C", "D"]);

  assertEqual(rounds.length, 3, "برای 4 تیم باید 3 دور داشته باشیم.");
  assert(
    rounds.every((round) => round.matches.length === 2),
    "در لیگ 4 تیمی هر دور باید 2 بازی داشته باشد."
  );
});

test("لیگ 4 تیمی: هر زوج دقیقاً یک بار بازی می‌کند", () => {
  const teams = ["A", "B", "C", "D"];
  const rounds = generateSingleRoundRobin(teams);
  const matches = allMatches(rounds);

  assertEqual(matches.length, 6, "4 تیم باید مجموعاً 6 بازی داشته باشند.");

  const pairs = new Set(matches.map((m) => pairKey(m.home, m.away)));

  assertEqual(
    pairs.size,
    6,
    "نباید هیچ زوجی بیشتر از یک بار مقابل هم قرار بگیرد."
  );
});

test("لیگ 8 تیمی: هر تیم با همه تیم‌ها بازی می‌کند", () => {
  const teams = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const rounds = generateSingleRoundRobin(teams);
  const matches = allMatches(rounds);

  assertEqual(rounds.length, 7, "8 تیم باید 7 دور داشته باشند.");
  assertEqual(matches.length, 28, "8 تیم باید مجموعاً 28 بازی داشته باشند.");

  for (const team of teams) {
    const opponents = new Set<string>();

    for (const match of matches) {
      if (match.home === team) opponents.add(match.away);
      if (match.away === team) opponents.add(match.home);
    }

    assertEqual(
      opponents.size,
      7,
      `${team} باید دقیقاً مقابل 7 تیم دیگر بازی کند.`
    );
  }
});

test("لیگ 5 تیمی: استراحت به‌درستی مدیریت می‌شود", () => {
  const teams = ["A", "B", "C", "D", "E"];
  const rounds = generateSingleRoundRobin(teams);
  const matches = allMatches(rounds);

  assertEqual(rounds.length, 5, "5 تیم باید 5 دور داشته باشند.");
  assertEqual(matches.length, 10, "5 تیم باید مجموعاً 10 بازی داشته باشند.");

  const pairs = new Set(matches.map((m) => pairKey(m.home, m.away)));

  assertEqual(
    pairs.size,
    10,
    "در لیگ 5 تیمی نباید بازی تکراری وجود داشته باشد."
  );

  for (const team of teams) {
    let count = 0;

    for (const match of matches) {
      if (match.home === team || match.away === team) {
        count++;
      }
    }

    assertEqual(
      count,
      4,
      `${team} باید دقیقاً 4 بازی داشته باشد.`
    );
  }
});

/* =========================================================
   لیگ رفت و برگشت
   ========================================================= */

test("رفت‌وبرگشت 4 تیمی: تعداد بازی‌ها درست است", () => {
  const teams = ["A", "B", "C", "D"];
  const rounds = generateDoubleRoundRobin(teams);
  const matches = allMatches(rounds);

  assertEqual(rounds.length, 6, "4 تیم در رفت‌وبرگشت باید 6 دور داشته باشند.");
  assertEqual(matches.length, 12, "4 تیم باید مجموعاً 12 بازی داشته باشند.");
});

test("رفت‌وبرگشت: هر زوج دقیقاً دو بار و با میزبان متفاوت بازی می‌کند", () => {
  const teams = ["A", "B", "C", "D"];
  const rounds = generateDoubleRoundRobin(teams);
  const matches = allMatches(rounds);

  const unordered = new Map<string, number>();
  const directed = new Set<string>();

  for (const match of matches) {
    const pair = pairKey(match.home, match.away);
    unordered.set(pair, (unordered.get(pair) ?? 0) + 1);
    directed.add(directedPairKey(match.home, match.away));
  }

  assertEqual(unordered.size, 6, "باید 6 زوج منحصربه‌فرد داشته باشیم.");

  for (const [pair, count] of unordered) {
    assertEqual(
      count,
      2,
      `زوج ${pair} باید دقیقاً دو بار بازی کند.`
    );
  }

  for (const [pair] of unordered) {
    const [a, b] = pair.split("|||");

    assert(
      directed.has(directedPairKey(a, b)),
      `${a} باید یک بار میزبان ${b} باشد.`
    );

    assert(
      directed.has(directedPairKey(b, a)),
      `${b} باید یک بار میزبان ${a} باشد.`
    );
  }
});

test("رفت‌وبرگشت 5 تیمی: استراحت و تعداد بازی‌ها درست است", () => {
  const teams = ["A", "B", "C", "D", "E"];
  const rounds = generateDoubleRoundRobin(teams);
  const matches = allMatches(rounds);

  assertEqual(rounds.length, 10, "5 تیم باید 10 دور داشته باشند.");
  assertEqual(matches.length, 20, "5 تیم باید مجموعاً 20 بازی داشته باشند.");

  const pairs = new Map<string, number>();

  for (const match of matches) {
    const key = pairKey(match.home, match.away);
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  }

  assertEqual(pairs.size, 10, "باید 10 زوج منحصربه‌فرد داشته باشیم.");

  for (const [pair, count] of pairs) {
    assertEqual(count, 2, `زوج ${pair} باید دو بازی داشته باشد.`);
  }
});

/* =========================================================
   گروه‌ها
   ========================================================= */

test("گروه‌بندی 8 تیم در 2 گروه: اندازه گروه‌ها برابر است", () => {
  const teams = ["A", "B", "C", "D", "E", "F", "G", "H"];

  const groups = buildGroups({
    teams,
    numGroups: 2,
    seededTeams: [],
  });

  assertEqual(groups.length, 2, "باید 2 گروه ساخته شود.");
  assert(
    groups.every((g) => g.teams.length === 4),
    "هر گروه باید 4 تیم داشته باشد."
  );
});

test("گروه‌بندی 10 تیم در 3 گروه: اختلاف اندازه حداکثر یک است", () => {
  const teams = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

  const groups = buildGroups({
    teams,
    numGroups: 3,
    seededTeams: [],
  });

  const sizes = groups.map((g) => g.teams.length);

  assertEqual(
    Math.max(...sizes) - Math.min(...sizes),
    1,
    "اختلاف اندازه گروه‌ها نباید بیشتر از یک باشد."
  );
});

test("سیدبندی گروهی: سیدها در گروه‌های متفاوت قرار می‌گیرند", () => {
  const teams = ["A", "B", "C", "D", "E", "F", "G", "H"];

  const groups = buildGroups({
    teams,
    numGroups: 4,
    seededTeams: ["A", "B", "C", "D"],
  });

  const locations = new Map<string, string>();

  for (const group of groups) {
    for (const team of group.teams) {
      locations.set(team, group.name);
    }
  }

  const seedGroups = ["A", "B", "C", "D"].map((team) => locations.get(team));

  assertEqual(
    new Set(seedGroups).size,
    4,
    "هر چهار تیم سیدشده باید در گروه متفاوت باشند."
  );
});

test("گروه‌بندی: تیم سیدشده ناشناخته باید خطا بدهد", () => {
  assertThrows(
    () =>
      buildGroups({
        teams: ["A", "B", "C", "D"],
        numGroups: 2,
        seededTeams: ["X"],
      }),
    "یافت نشد"
  );
});

test("گروه‌بندی: تعداد سیدها نباید از تعداد گروه‌ها بیشتر باشد", () => {
  assertThrows(
    () =>
      buildGroups({
        teams: ["A", "B", "C", "D"],
        numGroups: 2,
        seededTeams: ["A", "B", "C"],
      }),
    "بیشتر از تعداد گروه‌ها"
  );
});

test("گروه‌بندی: تعداد گروه‌ها نباید از تعداد تیم‌ها بیشتر باشد", () => {
  assertThrows(
    () =>
      buildGroups({
        teams: ["A", "B"],
        numGroups: 3,
        seededTeams: [],
      }),
    "بیشتر از تعداد تیم‌ها"
  );
});

/* =========================================================
   حذفی
   ========================================================= */

test("حذفی 2 تیمی: یک بازی و یک دور", () => {
  const result = buildKnockout({
    teams: ["A", "B"],
    seededTeams: [],
  });

  assertEqual(result.bracketSize, 2, "براکت باید 2 جایگاه داشته باشد.");
  assertEqual(result.byes, 0, "نباید BYE داشته باشیم.");
  assertEqual(result.rounds.length, 1, "باید فقط یک دور وجود داشته باشد.");
  assertEqual(result.rounds[0].matches.length, 1, "فینال باید یک بازی داشته باشد.");
});

test("حذفی 4 تیمی: بدون BYE", () => {
  const result = buildKnockout({
    teams: ["A", "B", "C", "D"],
    seededTeams: [],
  });

  assertEqual(result.bracketSize, 4, "براکت باید 4 جایگاه داشته باشد.");
  assertEqual(result.byes, 0, "4 تیم نباید BYE داشته باشند.");
  assertEqual(result.rounds.length, 2, "باید نیمه‌نهایی و فینال وجود داشته باشد.");
  assertEqual(result.rounds[0].matches.length, 2, "نیمه‌نهایی باید 2 بازی داشته باشد.");
  assertEqual(result.rounds[1].matches.length, 1, "فینال باید 1 بازی داشته باشد.");
});

test("حذفی 8 تیمی: ساختار کامل براکت", () => {
  const result = buildKnockout({
    teams: ["A", "B", "C", "D", "E", "F", "G", "H"],
    seededTeams: [],
  });

  assertEqual(result.bracketSize, 8, "براکت باید 8 جایگاه داشته باشد.");
  assertEqual(result.byes, 0, "8 تیم نباید BYE داشته باشند.");
  assertEqual(result.rounds.length, 3, "باید 3 دور وجود داشته باشد.");

  assertEqual(result.rounds[0].matches.length, 4, "دور اول باید 4 بازی داشته باشد.");
  assertEqual(result.rounds[1].matches.length, 2, "دور دوم باید 2 بازی داشته باشد.");
  assertEqual(result.rounds[2].matches.length, 1, "فینال باید 1 بازی داشته باشد.");
});

test("حذفی 3 تیمی: یک BYE لازم است", () => {
  const result = buildKnockout({
    teams: ["A", "B", "C"],
    seededTeams: [],
  });

  assertEqual(result.bracketSize, 4, "براکت 3 تیم باید 4 جایگاه داشته باشد.");
  assertEqual(result.byes, 1, "3 تیم باید دقیقاً یک BYE داشته باشند.");
  assertEqual(result.rounds[0].matches.length, 2, "دور اول باید 2 جایگاه بازی داشته باشد.");

  const autoAdvances = result.rounds[0].matches.filter(
    (match) => match.autoAdvance !== null
  );

  assertEqual(
    autoAdvances.length,
    1,
    "باید دقیقاً یک تیم مستقیماً صعود کند."
  );
});

test("حذفی 5 تیمی: سه BYE لازم است", () => {
  const result = buildKnockout({
    teams: ["A", "B", "C", "D", "E"],
    seededTeams: [],
  });

  assertEqual(result.bracketSize, 8, "براکت 5 تیم باید 8 جایگاه داشته باشد.");
  assertEqual(result.byes, 3, "5 تیم باید دقیقاً 3 BYE داشته باشند.");

  const autoAdvances = result.rounds[0].matches.filter(
    (match) => match.autoAdvance !== null
  );

  assertEqual(
    autoAdvances.length,
    3,
    "باید دقیقاً 3 تیم به دلیل BYE مستقیم صعود کنند."
  );
});

test("حذفی 6 تیمی: دو BYE لازم است", () => {
  const result = buildKnockout({
    teams: ["A", "B", "C", "D", "E", "F"],
    seededTeams: [],
  });

  assertEqual(result.bracketSize, 8, "براکت 6 تیم باید 8 جایگاه داشته باشد.");
  assertEqual(result.byes, 2, "6 تیم باید دقیقاً 2 BYE داشته باشند.");
});

test("حذفی 7 تیمی: یک BYE لازم است", () => {
  const result = buildKnockout({
    teams: ["A", "B", "C", "D", "E", "F", "G"],
    seededTeams: [],
  });

  assertEqual(result.bracketSize, 8, "براکت 7 تیم باید 8 جایگاه داشته باشد.");
  assertEqual(result.byes, 1, "7 تیم باید دقیقاً یک BYE داشته باشند.");
});

test("حذفی 10 تیمی: شش BYE لازم است", () => {
  const teams = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

  const result = buildKnockout({
    teams,
    seededTeams: [],
  });

  assertEqual(result.bracketSize, 16, "براکت 10 تیم باید 16 جایگاه داشته باشد.");
  assertEqual(result.byes, 6, "10 تیم باید دقیقاً 6 BYE داشته باشند.");
});

test("حذفی: تیم سیدشده ناشناخته باید خطا بدهد", () => {
  assertThrows(
    () =>
      buildKnockout({
        teams: ["A", "B", "C", "D"],
        seededTeams: ["X"],
      }),
    "یافت نشد"
  );
});

/* =========================================================
   تست مهم سیدهای حذفی
   ========================================================= */

test("حذفی 8 تیمی: سیدهای 1 تا 4 نباید در دور اول مقابل هم قرار بگیرند", () => {
  const result = buildKnockout({
    teams: ["A", "B", "C", "D", "E", "F", "G", "H"],
    seededTeams: ["A", "B", "C", "D"],
  });

  const firstRound = result.rounds[0].matches;

  const seededPairs = firstRound
    .map((match) => [match.home, match.away])
    .filter(
      ([home, away]) =>
        home !== null &&
        away !== null &&
        ["A", "B", "C", "D"].includes(home) &&
        ["A", "B", "C", "D"].includes(away)
    );

  assertEqual(
    seededPairs.length,
    0,
    "هیچ‌کدام از چهار تیم سیدشده نباید در دور اول مقابل یکدیگر قرار بگیرند."
  );
});

/* =========================================================
   اعتبارسنجی عمومی generateSchedule
   ========================================================= */

test("generateSchedule: نام خالی تیم باید خطا بدهد", () => {
  assertThrows(
    () =>
      generateSchedule({
        format: "league",
        teams: ["A", "", "C"],
      }),
    "پر شده"
  );
});

test("generateSchedule: نام تکراری تیم باید خطا بدهد", () => {
  assertThrows(
    () =>
      generateSchedule({
        format: "league",
        teams: ["A", "B", "a"],
      }),
    "یکتا"
  );
});

test("generateSchedule: لیگ به‌درستی از API اصلی عبور می‌کند", () => {
  const result = generateSchedule({
    format: "league",
    teams: ["A", "B", "C", "D"],
  });

  assertEqual(result.format, "league", "فرمت خروجی باید league باشد.");
  if (result.format === "league") {
    assertEqual(result.rounds.length, 3, "لیگ 4 تیمی باید 3 دور داشته باشد.");
  }
});

test("generateSchedule: رفت‌وبرگشت به‌درستی از API اصلی عبور می‌کند", () => {
  const result = generateSchedule({
    format: "double-league",
    teams: ["A", "B", "C", "D"],
  });

  assertEqual(
    result.format,
    "double-league",
    "فرمت خروجی باید double-league باشد."
  );
  if (result.format === "double-league") {
    assertEqual(
      result.rounds.length,
      6,
      "رفت‌وبرگشت 4 تیمی باید 6 دور داشته باشد."
    );
  }
});

test("generateSchedule: گروهی خروجی معتبر می‌دهد", () => {
  const result = generateSchedule({
    format: "groups",
    teams: ["A", "B", "C", "D", "E", "F", "G", "H"],
    numGroups: 2,
    seededTeams: ["A", "B"],
    qualifiersPerGroup: 2,
  });

  assertEqual(result.format, "groups", "فرمت خروجی باید groups باشد.");
  if (result.format === "groups") {
    assertEqual(result.groups.length, 2, "باید 2 گروه ساخته شود.");
  }
});

test("generateSchedule: حذفی خروجی معتبر می‌دهد", () => {
  const result = generateSchedule({
    format: "knockout",
    teams: ["A", "B", "C", "D", "E"],
    seededTeams: [],
  });

  assertEqual(result.format, "knockout", "فرمت خروجی باید knockout باشد.");
  if (result.format === "knockout") {
    assertEqual(result.knockout.bracketSize, 8, "براکت باید 8 جایگاه داشته باشد.");
    assertEqual(result.knockout.byes, 3, "باید 3 BYE وجود داشته باشد.");
  }
});

/* =========================================================
   گروهی + حذفی
   ========================================================= */

test("گروهی + حذفی: تعداد جایگاه‌های حذفی برابر تعداد صعودکننده‌هاست", () => {
  const result = generateSchedule({
    format: "groups-knockout",
    teams: ["A", "B", "C", "D", "E", "F", "G", "H"],
    numGroups: 2,
    seededTeams: ["A", "B"],
    qualifiersPerGroup: 2,
  });

  assertEqual(
    result.format,
    "groups-knockout",
    "فرمت خروجی باید groups-knockout باشد."
  );
  if (result.format === "groups-knockout") {
    assertEqual(
      result.knockout.bracketSize,
      4,
      "2 گروه × 2 صعودکننده باید براکت 4 تیمی بسازد."
    );

    assertEqual(
      result.knockout.byes,
      0,
      "4 صعودکننده نباید BYE داشته باشند."
    );
  }
});

test("گروهی + حذفی: تیم‌های هم‌گروه در دور اول حذفی مقابل یکدیگر قرار نمی‌گیرند", () => {
  const result = generateSchedule({
    format: "groups-knockout",
    teams: ["A", "B", "C", "D", "E", "F", "G", "H"],
    numGroups: 2,
    seededTeams: ["A", "B"],
    qualifiersPerGroup: 2,
  });

  if (result.format === "groups-knockout") {
    const round1 = result.knockout.rounds[0].matches;
    for (const match of round1) {
      if (match.home && match.away) {
        // extract group name (e.g. "گروه A")
        const groupHome = match.home.match(/گروه [A-Z]+/)?.[0];
        const groupAway = match.away.match(/گروه [A-Z]+/)?.[0];
        assert(
          groupHome !== groupAway,
          `تیم‌های هم‌گروه (${match.home} و ${match.away}) نباید در دور اول حذفی به مصاف هم بروند.`
        );
      }
    }
  }
});

/* =========================================================
   تست‌های قابلیت‌های پیشرفته جدید
   ========================================================= */

test("گروهی: قانون عدم برخورد (avoidPairs) - دو تیم نباید در یک گروه قرار بگیرند", () => {
  const teams = ["تیم ۱", "تیم ۲", "تیم ۳", "تیم ۴", "تیم ۵", "تیم ۶"];
  const groups = buildGroups({
    teams,
    numGroups: 2,
    seededTeams: [],
    avoidPairs: [["تیم ۱", "تیم ۲"]],
  });

  assertEqual(groups.length, 2, "باید ۲ گروه تشکیل شود.");
  const g1 = groups[0].teams;
  const g2 = groups[1].teams;

  const bothInG1 = g1.includes("تیم ۱") && g1.includes("تیم ۲");
  const bothInG2 = g2.includes("تیم ۱") && g2.includes("تیم ۲");

  assert(!bothInG1 && !bothInG2, "تیم‌های قانون عدم برخورد نباید در یک گروه قرار بگیرند.");
});

test("گروهی: اگر تفکیک avoidPairs غیرممکن باشد باید خطا بدهد", () => {
  // 3 teams must avoid each other, but only 2 groups exist
  assertThrows(
    () =>
      buildGroups({
        teams: ["A", "B", "C", "D"],
        numGroups: 2,
        seededTeams: [],
        avoidPairs: [
          ["A", "B"],
          ["B", "C"],
          ["A", "C"],
        ],
      }),
    "امکان‌پذیر نیست"
  );
});

test("حذفی: مسابقه رده‌بندی برای مقام سوم (hasThirdPlace)", () => {
  const knockout = buildKnockout({
    teams: ["A", "B", "C", "D"],
    seededTeams: [],
    hasThirdPlace: true,
  });

  assert(knockout.thirdPlaceMatch !== null, "مسابقه رده‌بندی باید وجود داشته باشد.");
  assertEqual(knockout.thirdPlaceMatch?.id, "m-third-place", "شناسه بازی رده‌بندی درست است.");
});

test("حذفی: صعود با ضربات پنالتی در صورت تساوی در وقت معمول", () => {
  const knockout = buildKnockout({
    teams: ["A", "B"],
    seededTeams: ["A", "B"],
  });

  const finalMatchId = knockout.rounds[0].matches[0].id;
  const result = computeKnockoutWithScores(knockout, {
    [finalMatchId]: {
      home: 2,
      away: 2,
      homePenalty: 5,
      awayPenalty: 4,
    },
  });

  assertEqual(result.champion, "A", "تیم A با پیروزی در پنالتی باید قهرمان شود.");
});

test("تعداد گروه‌ها: پیش‌فرض بر اساس حداکثر ۴ تیم در هر گروه (calculateDefaultNumGroups)", () => {
  // تا ۴ تیم: ۱ گروه
  assertEqual(calculateDefaultNumGroups(2), 1, "2 تیم باید 1 گروه باشد");
  assertEqual(calculateDefaultNumGroups(3), 1, "3 تیم باید 1 گروه باشد");
  assertEqual(calculateDefaultNumGroups(4), 1, "4 تیم باید 1 گروه باشد");

  // تا ۸ تیم: ۲ گروه
  assertEqual(calculateDefaultNumGroups(5), 2, "5 تیم باید 2 گروه باشد");
  assertEqual(calculateDefaultNumGroups(6), 2, "6 تیم باید 2 گروه باشد");
  assertEqual(calculateDefaultNumGroups(7), 2, "7 تیم باید 2 گروه باشد");
  assertEqual(calculateDefaultNumGroups(8), 2, "8 تیم باید 2 گروه باشد");

  // تا ۱۲ تیم: ۳ گروه
  assertEqual(calculateDefaultNumGroups(9), 3, "9 تیم باید 3 گروه باشد");
  assertEqual(calculateDefaultNumGroups(12), 3, "12 تیم باید 3 گروه باشد");

  // تا ۱۶ تیم: ۴ گروه
  assertEqual(calculateDefaultNumGroups(13), 4, "13 تیم باید 4 گروه باشد");
  assertEqual(calculateDefaultNumGroups(16), 4, "16 تیم باید 4 گروه باشد");

  // مقادیر بالاتر
  assertEqual(calculateDefaultNumGroups(20), 5, "20 تیم باید 5 گروه باشد");
  assertEqual(calculateDefaultNumGroups(24), 6, "24 تیم باید 6 گروه باشد");
  assertEqual(calculateDefaultNumGroups(32), 8, "32 تیم باید 8 گروه باشد");
});

test("گروه‌بندی: شماره گروه سرگروه‌ها تصادفی است و همیشه به ترتیب ثابت نیست", () => {
  const teams = ["تیم ۱", "تیم ۲", "تیم ۳", "تیم ۴", "تیم ۵", "تیم ۶", "تیم ۷", "تیم ۸"];
  const seededTeams = ["تیم ۱", "تیم ۲"];

  const seed1Groups = new Set<string>();
  for (let i = 0; i < 25; i++) {
    const groups = buildGroups({
      teams,
      numGroups: 2,
      seededTeams,
    });
    const gForSeed1 = groups.find((g) => g.teams.includes("تیم ۱"))?.name;
    if (gForSeed1) seed1Groups.add(gForSeed1);
  }

  // سرگروه اول نباید همیشه در گروه A باشد و باید در طول چند قرعه‌کشی در هر دو گروه قرار بگیرد
  assert(
    seed1Groups.size > 1,
    "سرگروه اول باید در اجراهای مختلف در گروه‌های متفاوتی قرار گیرد."
  );
});

test("لیگ: بازی اول هر دور متعلق به یک تیم ثابت نیست", () => {
  const teams = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const rounds = generateSingleRoundRobin(teams);

  // استخراج تیم‌های مسابقه اول هر دور
  const firstMatchTeams = new Set<string>();
  for (const r of rounds) {
    if (r.matches.length > 0) {
      firstMatchTeams.add(r.matches[0].home);
      firstMatchTeams.add(r.matches[0].away);
    }
  }

  // در یک لیگ ۷ هفته‌ای نباید یک تیم خاص در بازی اول تمام هفته‌ها حضور داشته باشد
  // و باید تنوع بالایی از تیم‌ها در بازی اول هفتگی حضور داشته باشند (حداقل ۴ تیم مختلف)
  assert(
    firstMatchTeams.size >= 4,
    `تیم‌های حاضر در بازی اول هفته‌ها باید متنوع باشند (تعداد شناسایی‌شده: ${firstMatchTeams.size})`
  );
});

/* =========================================================
   نتیجه نهایی
   ========================================================= */

console.log("");
console.log("======================================");
console.log(`تست‌های موفق: ${passed}`);
console.log(`تست‌های ناموفق: ${failed}`);
console.log("======================================");

if (failed > 0) {
  process.exit(1);
}