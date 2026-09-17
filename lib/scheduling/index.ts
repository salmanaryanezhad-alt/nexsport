import { generateSingleRoundRobin, generateDoubleRoundRobin } from "./roundRobin";
import { buildGroups } from "./groups";
import { buildKnockout } from "./knockout";
import {
  ScheduleInput,
  ScheduleResult,
  ScheduleValidationError,
} from "./types";

export * from "./types";

function assertUniqueNonEmptyTeams(teams: string[]) {
  const trimmed = teams.map((t) => t.trim());
  if (trimmed.some((t) => t.length === 0)) {
    throw new ScheduleValidationError("نام همه تیم‌ها باید پر شده باشد.");
  }
  const unique = new Set(trimmed.map((t) => t.toLowerCase()));
  if (unique.size !== trimmed.length) {
    throw new ScheduleValidationError("نام تیم‌ها باید یکتا باشد؛ دو تیم هم‌نام وجود دارد.");
  }
}

export function generateSchedule(input: ScheduleInput): ScheduleResult {
  assertUniqueNonEmptyTeams(input.teams);

  switch (input.format) {
    case "league":
      return { format: "league", rounds: generateSingleRoundRobin(input.teams) };

    case "double-league":
      return { format: "double-league", rounds: generateDoubleRoundRobin(input.teams) };

    case "groups": {
      const groups = buildGroups({
        teams: input.teams,
        numGroups: input.numGroups,
        seededTeams: input.seededTeams,
      });
      return { format: "groups", groups };
    }

    case "groups-knockout": {
      const groups = buildGroups({
        teams: input.teams,
        numGroups: input.numGroups,
        seededTeams: input.seededTeams,
      });
      // The knockout stage is seeded with placeholders, since the actual
      // qualifying teams are only known once the group stage is played.
      const placeholders: string[] = [];
      groups.forEach((g) => {
        for (let pos = 1; pos <= input.qualifiersPerGroup; pos++) {
          placeholders.push(`${pos === 1 ? "قهرمان" : pos === 2 ? "نایب‌قهرمان" : `تیم ${pos}`} ${g.name}`);
        }
      });
      const knockout = buildKnockout({ teams: placeholders, seededTeams: [] });
      return { format: "groups-knockout", groups, knockout };
    }

    case "knockout": {
      const knockout = buildKnockout({ teams: input.teams, seededTeams: input.seededTeams });
      return { format: "knockout", knockout };
    }

    default: {
      const _exhaustive: never = input;
      throw new ScheduleValidationError("فرمت مسابقه ناشناخته است.");
    }
  }
}
