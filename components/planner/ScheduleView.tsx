import { ScheduleResult, RoundRobinRound, KnockoutResult, GroupResult } from "@/lib/scheduling";

function RoundsTable({ rounds, title }: { rounds: RoundRobinRound[]; title?: string }) {
  return (
    <div>
      {title && <h3 className="font-semibold text-pitch mb-3">{title}</h3>}
      <div className="space-y-5">
        {rounds.map((round) => (
          <div key={round.round}>
            <p className="text-xs text-ink/50 mb-1.5">هفته {round.round}</p>
            <div className="overflow-hidden rounded-md border border-line">
              <table className="w-full text-sm">
                <tbody>
                  {round.matches.map((m, i) => (
                    <tr key={i} className="border-t border-line first:border-t-0">
                      <td className="px-4 py-2.5 text-left">{m.home}</td>
                      <td className="px-3 py-2.5 text-center text-ink/40 w-10">-</td>
                      <td className="px-4 py-2.5 text-right">{m.away}</td>
                    </tr>
                  ))}
                  {round.matches.length === 0 && (
                    <tr>
                      <td className="px-4 py-2.5 text-ink/40 text-sm">استراحت (Bye)</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupsView({ groups }: { groups: GroupResult[] }) {
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {groups.map((g) => (
        <div key={g.name}>
          <h3 className="font-semibold text-pitch mb-1">{g.name}</h3>
          <p className="text-xs text-ink/50 mb-3">{g.teams.join(" · ")}</p>
          <RoundsTable rounds={g.rounds} />
        </div>
      ))}
    </div>
  );
}

function bracketSlotLabel(value: string | null): string {
  if (value === null) return "TBD";
  if (value === "BYE") return "استراحت (Bye)";
  return value;
}

function BracketView({ knockout }: { knockout: KnockoutResult }) {
  return (
    <div>
      {knockout.byes > 0 && (
        <p className="text-xs text-ink/50 mb-4">
          چون تعداد تیم‌ها به توان ۲ نمی‌رسید، {knockout.byes} تیم برتر در دور اول استراحت
          (Bye) دارند و مستقیم به دور بعد صعود می‌کنند.
        </p>
      )}
      <div className="flex gap-8 overflow-x-auto pb-2">
        {knockout.rounds.map((round) => (
          <div key={round.round} className="flex min-w-[220px] flex-col justify-around gap-6">
            <p className="text-xs text-ink/50">{round.label}</p>
            {round.matches.map((m) => (
              <div key={m.id} className="rounded-md border border-line overflow-hidden text-sm">
                <div className="px-3 py-2 border-b border-line bg-chalk">{bracketSlotLabel(m.home)}</div>
                <div className="px-3 py-2">{bracketSlotLabel(m.away)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScheduleView({ result }: { result: ScheduleResult }) {
  return (
    <div id="print-area">
      {(result.format === "league" || result.format === "double-league") && (
        <RoundsTable rounds={result.rounds} />
      )}
      {result.format === "groups" && <GroupsView groups={result.groups} />}
      {result.format === "groups-knockout" && (
        <div className="space-y-10">
          <GroupsView groups={result.groups} />
          <div>
            <h3 className="font-semibold text-pitch mb-3">مرحله حذفی</h3>
            <p className="text-xs text-ink/50 mb-4">
              جای تیم‌های صعودکننده تا پایان مرحله گروهی مشخص نیست؛ این براکت با عنوان
              جایگاه هر گروه ساخته شده و بعداً می‌توانید نام تیم‌های واقعی را جایگزین کنید.
            </p>
            <BracketView knockout={result.knockout} />
          </div>
        </div>
      )}
      {result.format === "knockout" && <BracketView knockout={result.knockout} />}
    </div>
  );
}
