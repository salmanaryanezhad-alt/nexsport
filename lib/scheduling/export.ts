import { ScheduleResult, BracketRound, BracketMatch, MatchScheduleDetail } from "./types";
import { MatchScore } from "./knockout";

function formatScheduleDetail(dt?: MatchScheduleDetail): string {
  if (!dt) return "";
  const parts: string[] = [];
  if (dt.date) parts.push(`تاریخ: ${dt.date}`);
  if (dt.time) parts.push(`ساعت ${dt.time}`);
  if (dt.pitch) parts.push(`زمین/سالن: ${dt.pitch}`);
  return parts.length > 0 ? ` [${parts.join(" | ")}]` : "";
}

export function formatScheduleAsText(
  result: ScheduleResult,
  scores?: Record<string, MatchScore>,
  matchDetails?: Record<string, MatchScheduleDetail>
): string {
  const lines: string[] = [];

  const formatTitleMap: Record<string, string> = {
    league: "لیگ تک‌دور",
    "double-league": "لیگ رفت و برگشت",
    groups: "مرحله گروهی",
    "groups-knockout": "مرحله گروهی + حذفی",
    knockout: "مرحله حذفی",
    "double-knockout": "تورنمنت دو حذفی (Double Elimination)",
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
        const dt = m.id && matchDetails && matchDetails[m.id] ? matchDetails[m.id] : undefined;
        const scoreStr =
          sc && sc.home !== null && sc.away !== null
            ? ` (${sc.home} - ${sc.away})`
            : "";
        lines.push(`  ⚽ ${m.home} 🆚 ${m.away}${scoreStr}${formatScheduleDetail(dt)}`);
      }
    }
  } else if (result.format === "groups") {
    for (const g of result.groups) {
      lines.push(`\n📌 ${g.name}: [${g.teams.join("، ")}]`);
      for (const round of g.rounds) {
        lines.push(`  📅 هفته ${round.round}:`);
        for (const m of round.matches) {
          const sc = m.id && scores && scores[m.id] ? scores[m.id] : null;
          const dt = m.id && matchDetails && matchDetails[m.id] ? matchDetails[m.id] : undefined;
          const scoreStr =
            sc && sc.home !== null && sc.away !== null
              ? ` (${sc.home} - ${sc.away})`
              : "";
          lines.push(`    ⚽ ${m.home} 🆚 ${m.away}${scoreStr}${formatScheduleDetail(dt)}`);
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
          const dt = m.id && matchDetails && matchDetails[m.id] ? matchDetails[m.id] : undefined;
          const scoreStr =
            sc && sc.home !== null && sc.away !== null
              ? ` (${sc.home} - ${sc.away})`
              : "";
          lines.push(`    ⚽ ${m.home} 🆚 ${m.away}${scoreStr}${formatScheduleDetail(dt)}`);
        }
      }
    }
    lines.push("\n🚩 بخش دوم: براکت مرحله حذفی");
    appendKnockoutText(lines, result.knockout.rounds, result.knockout.thirdPlaceMatch, scores, matchDetails);
  } else if (result.format === "knockout") {
    appendKnockoutText(lines, result.knockout.rounds, result.knockout.thirdPlaceMatch, scores, matchDetails);
  } else if (result.format === "double-knockout") {
    lines.push("\n🏆 بخش اول: جدول برندگان (Winners Bracket)");
    appendKnockoutText(lines, result.doubleKnockout.winnersBracket, null, scores, matchDetails);
    lines.push("\n🛡️ بخش دوم: جدول شانس مجدد (Losers Bracket)");
    appendKnockoutText(lines, result.doubleKnockout.losersBracket, null, scores, matchDetails);
    lines.push("\n👑 فینال بزرگ نهایی (Grand Final):");
    const gf = result.doubleKnockout.grandFinal;
    const gfSc = scores && scores[gf.id] ? scores[gf.id] : null;
    const gfDt = matchDetails && matchDetails[gf.id] ? matchDetails[gf.id] : undefined;
    lines.push(`  ⚔️ ${gf.home ?? "قهرمان برندگان"} 🆚 ${gf.away ?? "قهرمان بازندگان"}${formatMatchScoreString(gfSc)}${formatScheduleDetail(gfDt)}`);
    if (result.doubleKnockout.bracketResetMatch) {
      const rst = result.doubleKnockout.bracketResetMatch;
      const rstSc = scores && scores[rst.id] ? scores[rst.id] : null;
      const rstDt = matchDetails && matchDetails[rst.id] ? matchDetails[rst.id] : undefined;
      lines.push(`  🔄 فینال مجدد (در صورت باخت برندگان): ${rst.home ?? "قهرمان برندگان"} 🆚 ${rst.away ?? "قهرمان بازندگان"}${formatMatchScoreString(rstSc)}${formatScheduleDetail(rstDt)}`);
    }
  }

  lines.push("\n━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("سامانه آنلاین و رایگان برنامه‌ریزی مسابقات ورزشی: https://nexsport.ir");

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
  scores?: Record<string, MatchScore>,
  matchDetails?: Record<string, MatchScheduleDetail>
) {
  for (const round of rounds) {
    lines.push(`\n🏆 ${round.label}:`);
    for (const m of round.matches) {
      const home = m.home ?? "نامشخص";
      const away = m.away ?? "نامشخص";
      const sc = scores && scores[m.id] ? scores[m.id] : null;
      const dt = matchDetails && matchDetails[m.id] ? matchDetails[m.id] : undefined;
      const scoreStr = formatMatchScoreString(sc);
      if (m.autoAdvance) {
        lines.push(`  ⚡ ${m.autoAdvance} (صعود مستقیم با استراحت Bye)`);
      } else {
        lines.push(`  ⚔️ ${home} 🆚 ${away}${scoreStr}${formatScheduleDetail(dt)}`);
      }
    }
  }

  if (thirdPlaceMatch) {
    lines.push("\n🥉 دیدار رده‌بندی (مقام سوم):");
    const home = thirdPlaceMatch.home ?? "بازنده نیمه‌نهایی ۱";
    const away = thirdPlaceMatch.away ?? "بازنده نیمه‌نهایی ۲";
    const sc = scores && scores[thirdPlaceMatch.id] ? scores[thirdPlaceMatch.id] : null;
    const dt = matchDetails && matchDetails[thirdPlaceMatch.id] ? matchDetails[thirdPlaceMatch.id] : undefined;
    const scoreStr = formatMatchScoreString(sc);
    lines.push(`  ⚔️ ${home} 🆚 ${away}${scoreStr}${formatScheduleDetail(dt)}`);
  }
}

export function exportScheduleToCsv(
  result: ScheduleResult,
  scores?: Record<string, MatchScore>,
  matchDetails?: Record<string, MatchScheduleDetail>
): string {
  const rows: string[][] = [
    [
      "مرحله / دور",
      "گروه / بخش",
      "تیم میزبان",
      "گل میزبان",
      "گل میهمان",
      "تیم میهمان",
      "پنالتی میزبان",
      "پنالتی میهمان",
      "برنده",
      "تاریخ",
      "ساعت",
      "زمین / سالن",
      "توضیحات",
    ],
  ];

  if (result.format === "league" || result.format === "double-league") {
    for (const round of result.rounds) {
      for (const m of round.matches) {
        const sc = m.id && scores && scores[m.id] ? scores[m.id] : null;
        const dt = m.id && matchDetails && matchDetails[m.id] ? matchDetails[m.id] : undefined;
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
          dt?.date ?? "",
          dt?.time ?? "",
          dt?.pitch ?? "",
          "",
        ]);
      }
    }
  } else if (result.format === "groups") {
    for (const g of result.groups) {
      for (const round of g.rounds) {
        for (const m of round.matches) {
          const sc = m.id && scores && scores[m.id] ? scores[m.id] : null;
          const dt = m.id && matchDetails && matchDetails[m.id] ? matchDetails[m.id] : undefined;
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
            dt?.date ?? "",
            dt?.time ?? "",
            dt?.pitch ?? "",
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
          const dt = m.id && matchDetails && matchDetails[m.id] ? matchDetails[m.id] : undefined;
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
            dt?.date ?? "",
            dt?.time ?? "",
            dt?.pitch ?? "",
            "مرحله گروهی",
          ]);
        }
      }
    }
    for (const round of result.knockout.rounds) {
      for (const m of round.matches) {
        const sc = scores && scores[m.id] ? scores[m.id] : null;
        const dt = matchDetails && matchDetails[m.id] ? matchDetails[m.id] : undefined;
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
          dt?.date ?? "",
          dt?.time ?? "",
          dt?.pitch ?? "",
          m.autoAdvance ? "صعود مستقیم Bye" : "",
        ]);
      }
    }
    if (result.knockout.thirdPlaceMatch) {
      const m = result.knockout.thirdPlaceMatch;
      const sc = scores && scores[m.id] ? scores[m.id] : null;
      const dt = matchDetails && matchDetails[m.id] ? matchDetails[m.id] : undefined;
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
        dt?.date ?? "",
        dt?.time ?? "",
        dt?.pitch ?? "",
        "مقام سوم و چهارم",
      ]);
    }
  } else if (result.format === "knockout") {
    for (const round of result.knockout.rounds) {
      for (const m of round.matches) {
        const sc = scores && scores[m.id] ? scores[m.id] : null;
        const dt = matchDetails && matchDetails[m.id] ? matchDetails[m.id] : undefined;
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
          dt?.date ?? "",
          dt?.time ?? "",
          dt?.pitch ?? "",
          m.autoAdvance ? "صعود مستقیم Bye" : "",
        ]);
      }
    }
    if (result.knockout.thirdPlaceMatch) {
      const m = result.knockout.thirdPlaceMatch;
      const sc = scores && scores[m.id] ? scores[m.id] : null;
      const dt = matchDetails && matchDetails[m.id] ? matchDetails[m.id] : undefined;
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
        dt?.date ?? "",
        dt?.time ?? "",
        dt?.pitch ?? "",
        "مقام سوم و چهارم",
      ]);
    }
  } else if (result.format === "double-knockout") {
    for (const round of result.doubleKnockout.winnersBracket) {
      for (const m of round.matches) {
        const sc = scores && scores[m.id] ? scores[m.id] : null;
        const dt = matchDetails && matchDetails[m.id] ? matchDetails[m.id] : undefined;
        rows.push([
          round.label,
          "جدول برندگان",
          m.home ?? "نامشخص",
          sc && sc.home !== null ? String(sc.home) : "",
          sc && sc.away !== null ? String(sc.away) : "",
          m.away ?? "نامشخص",
          sc?.homePenalty !== null && sc?.homePenalty !== undefined ? String(sc.homePenalty) : "",
          sc?.awayPenalty !== null && sc?.awayPenalty !== undefined ? String(sc.awayPenalty) : "",
          sc?.winner ?? (m.autoAdvance ? m.autoAdvance : ""),
          dt?.date ?? "",
          dt?.time ?? "",
          dt?.pitch ?? "",
          m.autoAdvance ? "صعود مستقیم Bye" : "",
        ]);
      }
    }
    for (const round of result.doubleKnockout.losersBracket) {
      for (const m of round.matches) {
        const sc = scores && scores[m.id] ? scores[m.id] : null;
        const dt = matchDetails && matchDetails[m.id] ? matchDetails[m.id] : undefined;
        rows.push([
          round.label,
          "جدول بازندگان",
          m.home ?? "نامشخص",
          sc && sc.home !== null ? String(sc.home) : "",
          sc && sc.away !== null ? String(sc.away) : "",
          m.away ?? "نامشخص",
          sc?.homePenalty !== null && sc?.homePenalty !== undefined ? String(sc.homePenalty) : "",
          sc?.awayPenalty !== null && sc?.awayPenalty !== undefined ? String(sc.awayPenalty) : "",
          sc?.winner ?? (m.autoAdvance ? m.autoAdvance : ""),
          dt?.date ?? "",
          dt?.time ?? "",
          dt?.pitch ?? "",
          m.autoAdvance ? "صعود مستقیم Bye" : "",
        ]);
      }
    }
    const gf = result.doubleKnockout.grandFinal;
    const gfSc = scores && scores[gf.id] ? scores[gf.id] : null;
    const gfDt = matchDetails && matchDetails[gf.id] ? matchDetails[gf.id] : undefined;
    rows.push([
      "فینال نهایی (Grand Final)",
      "فینال کل",
      gf.home ?? "قهرمان برندگان",
      gfSc && gfSc.home !== null ? String(gfSc.home) : "",
      gfSc && gfSc.away !== null ? String(gfSc.away) : "",
      gf.away ?? "قهرمان بازندگان",
      gfSc?.homePenalty !== null && gfSc?.homePenalty !== undefined ? String(gfSc.homePenalty) : "",
      gfSc?.awayPenalty !== null && gfSc?.awayPenalty !== undefined ? String(gfSc.awayPenalty) : "",
      gfSc?.winner ?? "",
      gfDt?.date ?? "",
      gfDt?.time ?? "",
      gfDt?.pitch ?? "",
      "تعیین قهرمان تورنمنت",
    ]);
    if (result.doubleKnockout.bracketResetMatch) {
      const rst = result.doubleKnockout.bracketResetMatch;
      const rstSc = scores && scores[rst.id] ? scores[rst.id] : null;
      const rstDt = matchDetails && matchDetails[rst.id] ? matchDetails[rst.id] : undefined;
      rows.push([
        "فینال مجدد (Bracket Reset)",
        "فینال کل",
        rst.home ?? "قهرمان برندگان",
        rstSc && rstSc.home !== null ? String(rstSc.home) : "",
        rstSc && rstSc.away !== null ? String(rstSc.away) : "",
        rst.away ?? "قهرمان بازندگان",
        rstSc?.homePenalty !== null && rstSc?.homePenalty !== undefined ? String(rstSc.homePenalty) : "",
        rstSc?.awayPenalty !== null && rstSc?.awayPenalty !== undefined ? String(rstSc.awayPenalty) : "",
        rstSc?.winner ?? "",
        rstDt?.date ?? "",
        rstDt?.time ?? "",
        rstDt?.pitch ?? "",
        "در صورت باخت قهرمان برندگان در فینال اول",
      ]);
    }
  }

  rows.push([]);
  rows.push(["تولید شده توسط سامانه ورزشی نکس‌اسپورت", "https://nexsport.ir"]);

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

export const formatScheduleAsCsv = exportScheduleToCsv;

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
