export function Stepper({ labels, current }: { labels: string[]; current: number }) {
  return (
    <nav aria-label="مراحل برنامه‌ریزی مسابقات" className="w-full">
      <ol className="flex items-center justify-between gap-1 sm:gap-2 bg-white/80 p-1.5 sm:p-2 rounded-2xl border border-line/80 shadow-xs backdrop-blur-sm">
        {labels.map((label, i) => {
          const isDone = i < current;
          const isActive = i === current;
          return (
            <li
              key={label}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-1 sm:px-3 rounded-xl transition-all ${
                isActive
                  ? "bg-pitch text-chalk font-bold shadow-sm"
                  : isDone
                  ? "bg-pitch/5 text-pitch font-semibold"
                  : "text-ink/40 font-medium"
              }`}
            >
              <span
                className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold shrink-0 transition-colors ${
                  isActive
                    ? "bg-gold text-ink"
                    : isDone
                    ? "bg-pitch text-chalk"
                    : "bg-line/60 text-ink/50"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </span>
              <span className="text-[11px] sm:text-xs truncate">{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
