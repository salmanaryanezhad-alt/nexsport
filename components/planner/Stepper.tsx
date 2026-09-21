export function Stepper({ labels, current }: { labels: string[]; current: number }) {
  return (
    <nav aria-label="مراحل برنامه‌ریزی مسابقات" className="w-full">
      <ol className="grid grid-cols-6 sm:grid-cols-5 gap-1.5 sm:gap-2 bg-white/80 p-1.5 sm:p-2 rounded-2xl border border-line/80 shadow-xs backdrop-blur-sm">
        {labels.map((label, i) => {
          const isDone = i < current;
          const isActive = i === current;
          // In mobile (5 steps): 3 items in first row (col-span-2 each), 2 items in second row (col-span-3 each)
          const mobileSpan = labels.length === 5
            ? i < 3 ? "col-span-2" : "col-span-3"
            : "col-span-3";

          return (
            <li
              key={label}
              className={`${mobileSpan} sm:col-span-1 flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 px-1 sm:px-3 rounded-xl transition-all ${
                isActive
                  ? "bg-pitch text-chalk font-bold shadow-sm"
                  : isDone
                  ? "bg-pitch/5 text-pitch font-semibold"
                  : "text-ink/40 font-medium"
              }`}
            >
              <span
                className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[10px] sm:text-xs font-bold shrink-0 transition-colors ${
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
