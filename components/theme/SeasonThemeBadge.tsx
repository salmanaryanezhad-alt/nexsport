import { resolveNexSportTheme } from "@/lib/theme/nexsportTheme";

export function SeasonThemeBadge({
  className = "",
}: {
  className?: string;
}) {
  const theme = resolveNexSportTheme();
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold shadow-inner backdrop-blur-md ${className}`.trim()}
      style={{
        borderColor: "color-mix(in srgb, var(--ns-accent) 45%, transparent)",
        background: "color-mix(in srgb, var(--ns-accent) 16%, rgba(2, 16, 12, 0.55))",
        color: "var(--ns-accent-light)",
      }}
      title={theme.label}
    >
      <span aria-hidden>{theme.emoji}</span>
      <span>{theme.badge}</span>
    </div>
  );
}
