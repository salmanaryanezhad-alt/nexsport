export function Stepper({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3 text-sm">
      {labels.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "upcoming";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
                (state === "done"
                  ? "bg-pitch text-chalk"
                  : state === "active"
                  ? "bg-gold text-ink"
                  : "bg-line text-ink/40")
              }
            >
              {i + 1}
            </span>
            <span className={state === "upcoming" ? "text-ink/40" : "text-ink"}>{label}</span>
            {i < labels.length - 1 && <span className="mx-1 text-ink/20">←</span>}
          </li>
        );
      })}
    </ol>
  );
}
