import { ScheduleResult, BracketRound } from "./types";

export function formatScheduleAsText(
  result: ScheduleResult,
  scores?: Record<string, { home: number | null; away: number | null }>
): string {
  const lines: string[] = [];

  const formatTitleMap: Record<string, string> = {
    league: "لیگ تک‌دور",
    "double-league": "لیگ رفت و برگشت",
    groups: "مرحله گروهی",
    "groups-knockout": "مرحله گروهی + حذفی",
    knockout: "مرحله حذفی",
  };

  lines.push("🏆 برنامه مسابقات NexSport");
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
    appendKnockoutText(lines, result.knockout.rounds, scores);
  } else if (result.format === "knockout") {
    appendKnockoutText(lines, result.knockout.rounds, scores);
  }

  lines.push("\n━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("تولید شده توسط پلتفرم ورزشی NexSport");

  return lines.join("\n");
}

function appendKnockoutText(
  lines: string[],
  rounds: BracketRound[],
  scores?: Record<string, { home: number | null; away: number | null }>
) {
  for (const round of rounds) {
    lines.push(`\n🥊 ${round.label}:`);
    for (const m of round.matches) {
      const home = m.home ?? "نامشخص";
      const away = m.away ?? "نامشخص";
      const sc = scores && scores[m.id] ? scores[m.id] : null;
      const scoreStr =
        sc && sc.home !== null && sc.away !== null
          ? ` (${sc.home} - ${sc.away})`
          : "";
      if (m.autoAdvance) {
        lines.push(`  ⚡ ${m.autoAdvance} (صعود مستقیم با استراحت Bye)`);
      } else {
        lines.push(`  ⚔️ ${home} 🆚 ${away}${scoreStr}`);
      }
    }
  }
}

export function exportScheduleToCsv(
  result: ScheduleResult,
  scores?: Record<string, { home: number | null; away: number | null }>
): string {
  const rows: string[][] = [
    ["مرحله / دور", "گروه", "تیم میزبان", "گل میزبان", "گل میهمان", "تیم میهمان", "توضیحات"],
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
          m.autoAdvance ? "صعود مستقیم Bye" : "",
        ]);
      }
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
          m.autoAdvance ? "صعود مستقیم Bye" : "",
        ]);
      }
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
