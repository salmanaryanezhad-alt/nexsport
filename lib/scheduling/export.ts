import { ScheduleResult, BracketRound, BracketMatch } from "./types";
import { MatchScore } from "./knockout";

export function formatScheduleAsText(
  result: ScheduleResult,
  scores?: Record<string, MatchScore>
): string {
  const lines: string[] = [];

  const formatTitleMap: Record<string, string> = {
    league: "لیگ تک‌دور",
    "double-league": "لیگ رفت و برگشت",
    groups: "مرحله گروهی",
    "groups-knockout": "مرحله گروهی + حذفی",
    knockout: "مرحله حذفی",
  };

  const title = result.metadata?.title || "برنامه مسابقات NexSport";
  lines.push(`🏆 ${title}`);
  if (result.metadata?.venue) {
    lines.push(`📍 محل برگزاری: ${result.metadata.venue}`);
  }
  lines.push(`فرمت مسابقه: ${formatTitleMap[result.format] || result.format}`);
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (result.format === "league" || result.format === "double-league") {
    for (const round of result.rounds) {
      lines.push(`\n📅 هفته ${round.round}:`);
      for (const m of round.matches) {
        const sc = m.id && scores && scores[m.id] ? scores[m.id] : null;
        const scoreStr =
          sc && sc.home !== null && sc.away !== null
            ? ` (${sc.home} - ${sc.away})`
            : "";
        lines.push(`  ⚽ ${m.home} 🆚 ${m.away}${scoreStr}`);
      }
    }
  } else if (result.format === "groups") {
    for (const g of result.groups) {
      lines.push(`\n📌 ${g.name}: [${g.teams.join("، ")}]`);
      for (const round of g.rounds) {
        lines.push(`  📅 هفته ${round.round}:`);
        for (const m of round.matches) {
          const sc = m.id && scores && scores[m.id] ? scores[m.id] : null;
          const scoreStr =
            sc && sc.home !== null && sc.away !== null
              ? ` (${sc.home} - ${sc.away})`
              : "";
          lines.push(`    ⚽ ${m.home} 🆚 ${m.away}${scoreStr}`);
        }
      }
    }
  } else if (result.format === "groups-knockout") {
    lines.push("\n🚩 بخش اول: مرحله گروهی");
    for (const g of result.groups) {
      lines.push(`\n📌 ${g.name}: [${g.teams.join("، ")}]`);
      for (const round of g.rounds) {
        lines.push(`  📅 هفته ${round.round}:`);
        for (const m of round.matches) {
          const sc = m.id && scores && scores[m.id] ? scores[m.id] : null;
          const scoreStr =
            sc && sc.home !== null && sc.away !== null
              ? ` (${sc.home} - ${sc.away})`
              : "";
          lines.push(`    ⚽ ${m.home} 🆚 ${m.away}${scoreStr}`);
        }
      }
    }
    lines.push("\n🚩 بخش دوم: براکت مرحله حذفی");
    appendKnockoutText(lines, result.knockout.rounds, result.knockout.thirdPlaceMatch, scores);
  } else if (result.format === "knockout") {
    appendKnockoutText(lines, result.knockout.rounds, result.knockout.thirdPlaceMatch, scores);
  }

  lines.push("\n━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("تولید شده توسط پلتفرم ورزشی NexSport");

  return lines.join("\n");
}

function formatMatchScoreString(sc?: MatchScore | null): string {
  if (!sc || sc.home === null || sc.away === null) return "";
  let s = ` (${sc.home} - ${sc.away}`;
  if (
    sc.homePenalty !== null &&
    sc.awayPenalty !== null &&
    sc.homePenalty !== undefined &&
    sc.awayPenalty !== undefined
  ) {
    s += ` | پنالتی: ${sc.homePenalty} - ${sc.awayPenalty}`;
  }
  s += ")";
  return s;
}

function appendKnockoutText(
  lines: string[],
  rounds: BracketRound[],
  thirdPlaceMatch?: BracketMatch | null,
  scores?: Record<string, MatchScore>
) {
  for (const round of rounds) {
    lines.push(`\n🥊 ${round.label}:`);
    for (const m of round.matches) {
      const home = m.home ?? "نامشخص";
      const away = m.away ?? "نامشخص";
      const sc = scores && scores[m.id] ? scores[m.id] : null;
      const scoreStr = formatMatchScoreString(sc);
      if (m.autoAdvance) {
        lines.push(`  ⚡ ${m.autoAdvance} (صعود مستقیم با استراحت Bye)`);
      } else {
        lines.push(`  ⚔️ ${home} 🆚 ${away}${scoreStr}`);
      }
    }
  }

  if (thirdPlaceMatch) {
    lines.push("\n🥉 دیدار رده‌بندی (مقام سوم):");
    const home = thirdPlaceMatch.home ?? "بازنده نیمه‌نهایی ۱";
    const away = thirdPlaceMatch.away ?? "بازنده نیمه‌نهایی ۲";
    const sc = scores && scores[thirdPlaceMatch.id] ? scores[thirdPlaceMatch.id] : null;
    const scoreStr = formatMatchScoreString(sc);
    lines.push(`  ⚔️ ${home} 🆚 ${away}${scoreStr}`);
  }
}

export function exportScheduleToCsv(
  result: ScheduleResult,
  scores?: Record<string, MatchScore>
): string {
  const rows: string[][] = [
    [
      "مرحله / دور",
      "گروه",
      "تیم میزبان",
      "گل میزبان",
      "گل میهمان",
      "تیم میهمان",
      "پنالتی میزبان",
      "پنالتی میهمان",
      "برنده",
      "توضیحات",
    ],
  ];

  if (result.format === "league" || result.format === "double-league") {
    for (const round of result.rounds) {
      for (const m of round.matches) {
        const sc = m.id && scores && scores[m.id] ? scores[m.id] : null;
        rows.push([
          `هفته ${round.round}`,
          "-",
          m.home,
          sc && sc.home !== null ? String(sc.home) : "",
          sc && sc.away !== null ? String(sc.away) : "",
          m.away,
          "",
          "",
          sc?.winner ?? "",
          "",
        ]);
      }
    }
  } else if (result.format === "groups") {
    for (const g of result.groups) {
      for (const round of g.rounds) {
        for (const m of round.matches) {
          const sc = m.id && scores && scores[m.id] ? scores[m.id] : null;
          rows.push([
            `هفته ${round.round}`,
            g.name,
            m.home,
            sc && sc.home !== null ? String(sc.home) : "",
            sc && sc.away !== null ? String(sc.away) : "",
            m.away,
            "",
            "",
            sc?.winner ?? "",
            "",
          ]);
        }
      }
    }
  } else if (result.format === "groups-knockout") {
    for (const g of result.groups) {
      for (const round of g.rounds) {
        for (const m of round.matches) {
          const sc = m.id && scores && scores[m.id] ? scores[m.id] : null;
          rows.push([
            `هفته ${round.round}`,
            g.name,
            m.home,
            sc && sc.home !== null ? String(sc.home) : "",
            sc && sc.away !== null ? String(sc.away) : "",
            m.away,
            "",
            "",
            sc?.winner ?? "",
            "مرحله گروهی",
          ]);
        }
      }
    }
    for (const round of result.knockout.rounds) {
      for (const m of round.matches) {
        const sc = scores && scores[m.id] ? scores[m.id] : null;
        rows.push([
          round.label,
          "حذفی",
          m.home ?? "نامشخص",
          sc && sc.home !== null ? String(sc.home) : "",
          sc && sc.away !== null ? String(sc.away) : "",
          m.away ?? "نامشخص",
          sc?.homePenalty !== null && sc?.homePenalty !== undefined ? String(sc.homePenalty) : "",
          sc?.awayPenalty !== null && sc?.awayPenalty !== undefined ? String(sc.awayPenalty) : "",
          sc?.winner ?? (m.autoAdvance ? m.autoAdvance : ""),
          m.autoAdvance ? "صعود مستقیم Bye" : "",
        ]);
      }
    }
    if (result.knockout.thirdPlaceMatch) {
      const m = result.knockout.thirdPlaceMatch;
      const sc = scores && scores[m.id] ? scores[m.id] : null;
      rows.push([
        "رده‌بندی (مقام سوم)",
        "حذفی",
        m.home ?? "بازنده نیمه‌نهایی ۱",
        sc && sc.home !== null ? String(sc.home) : "",
        sc && sc.away !== null ? String(sc.away) : "",
        m.away ?? "بازنده نیمه‌نهایی ۲",
        sc?.homePenalty !== null && sc?.homePenalty !== undefined ? String(sc.homePenalty) : "",
        sc?.awayPenalty !== null && sc?.awayPenalty !== undefined ? String(sc.awayPenalty) : "",
        sc?.winner ?? "",
        "مقام سوم و چهارم",
      ]);
    }
  } else if (result.format === "knockout") {
    for (const round of result.knockout.rounds) {
      for (const m of round.matches) {
        const sc = scores && scores[m.id] ? scores[m.id] : null;
        rows.push([
          round.label,
          "-",
          m.home ?? "نامشخص",
          sc && sc.home !== null ? String(sc.home) : "",
          sc && sc.away !== null ? String(sc.away) : "",
          m.away ?? "نامشخص",
          sc?.homePenalty !== null && sc?.homePenalty !== undefined ? String(sc.homePenalty) : "",
          sc?.awayPenalty !== null && sc?.awayPenalty !== undefined ? String(sc.awayPenalty) : "",
          sc?.winner ?? (m.autoAdvance ? m.autoAdvance : ""),
          m.autoAdvance ? "صعود مستقیم Bye" : "",
        ]);
      }
    }
    if (result.knockout.thirdPlaceMatch) {
      const m = result.knockout.thirdPlaceMatch;
      const sc = scores && scores[m.id] ? scores[m.id] : null;
      rows.push([
        "رده‌بندی (مقام سوم)",
        "-",
        m.home ?? "بازنده نیمه‌نهایی ۱",
        sc && sc.home !== null ? String(sc.home) : "",
        sc && sc.away !== null ? String(sc.away) : "",
        m.away ?? "بازنده نیمه‌نهایی ۲",
        sc?.homePenalty !== null && sc?.homePenalty !== undefined ? String(sc.homePenalty) : "",
        sc?.awayPenalty !== null && sc?.awayPenalty !== undefined ? String(sc.awayPenalty) : "",
        sc?.winner ?? "",
        "مقام سوم و چهارم",
      ]);
    }
  }

  // UTF-8 BOM + CSV escaping
  const csvBody = rows
    .map((row) =>
      row
        .map((cell) => {
          const escaped = cell.replace(/"/g, '""');
          return cell.includes(",") || cell.includes('"') || cell.includes("\n")
            ? `"${escaped}"`
            : escaped;
        })
        .join(",")
    )
    .join("\r\n");

  return "\uFEFF" + csvBody;
}

export function downloadCsvFile(csvContent: string, filename = "nexsport-schedule.csv") {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
