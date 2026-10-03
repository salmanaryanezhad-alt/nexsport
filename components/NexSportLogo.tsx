import React from "react";

export function NexSportIcon({
  className = "w-9 h-9",
  size,
}: {
  className?: string;
  size?: number;
}) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="NexSport Logo Emblem"
    >
      {/* Outer Squircle Shield */}
      <rect
        x="16"
        y="16"
        width="480"
        height="480"
        rx="116"
        fill="#081A12"
        stroke="#1B4332"
        strokeWidth="4"
      />
      <rect
        x="28"
        y="28"
        width="456"
        height="456"
        rx="104"
        fill="#0D2419"
        stroke="#FFB703"
        strokeWidth="3"
        strokeOpacity="0.6"
      />

      {/* Stadium Pitch Aesthetics */}
      <circle
        cx="256"
        cy="256"
        r="168"
        stroke="#2D6A4F"
        strokeWidth="2"
        strokeOpacity="0.35"
        strokeDasharray="6 8"
      />
      <circle
        cx="256"
        cy="256"
        r="64"
        stroke="#2D6A4F"
        strokeWidth="1.5"
        strokeOpacity="0.35"
      />
      <line
        x1="256"
        y1="84"
        x2="256"
        y2="428"
        stroke="#2D6A4F"
        strokeWidth="1.5"
        strokeOpacity="0.35"
      />

      {/* Left Pillar */}
      <rect x="144" y="140" width="68" height="232" rx="14" fill="#133827" />
      <rect x="147" y="143" width="62" height="226" rx="11" fill="#1B4332" />
      <path d="M150 148 L178 148 L178 364 L150 364 Z" fill="#40916C" />
      <path d="M150 148 L164 148 L164 364 L150 364 Z" fill="#52B788" />

      {/* Right Pillar */}
      <rect x="300" y="140" width="68" height="232" rx="14" fill="#133827" />
      <rect x="303" y="143" width="62" height="226" rx="11" fill="#1B4332" />
      <path d="M334 148 L362 148 L362 364 L334 364 Z" fill="#40916C" />
      <path d="M348 148 L362 148 L362 364 L348 364 Z" fill="#52B788" />

      {/* Central Dynamic Gold Diagonal Ribbon */}
      <polygon
        points="144,140 212,140 368,372 300,372"
        fill="#E07A00"
      />
      <polygon
        points="144,140 206,140 362,372 300,372"
        fill="#FFB703"
      />
      <polygon
        points="144,140 180,140 336,372 300,372"
        fill="#FFE169"
      />

      {/* Victory Star */}
      <path
        d="M398 90 L408 113 L431 123 L408 133 L398 156 L388 133 L365 123 L388 113 Z"
        fill="#FFB703"
      />
      <path
        d="M398 100 L405 116 L421 123 L405 130 L398 146 L391 130 L375 123 L391 116 Z"
        fill="#FFE885"
      />
      <circle cx="398" cy="123" r="3.5" fill="#FFFFFF" />

      {/* Tournament Nodes Arc */}
      <path
        d="M164 416 Q256 438 348 416"
        stroke="#FFB703"
        strokeWidth="4"
        strokeLinecap="round"
        strokeOpacity="0.9"
      />
      <circle cx="164" cy="416" r="6" fill="#52B788" stroke="#0D2419" strokeWidth="2" />
      <circle cx="256" cy="427" r="7.5" fill="#FFE885" stroke="#0D2419" strokeWidth="2" />
      <circle cx="348" cy="416" r="6" fill="#52B788" stroke="#0D2419" strokeWidth="2" />
    </svg>
  );
}

export function NexSportLogo({
  className = "",
  iconSize = 36,
  showTagline = false,
  theme = "light",
}: {
  className?: string;
  iconSize?: number;
  showTagline?: boolean;
  theme?: "light" | "dark";
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <NexSportIcon size={iconSize} className="shrink-0 drop-shadow-xs" />
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span
            className={`text-xl font-black tracking-tight ${
              theme === "dark" ? "text-white" : "text-ink"
            }`}
          >
            Nex<span className="text-gold">Sport</span>
          </span>
        </div>
        {showTagline && (
          <span
            className={`text-[10px] font-medium mt-0.5 ${
              theme === "dark" ? "text-white/70" : "text-ink/60"
            }`}
          >
            سامانه مدیریت و برنامه‌ریزی مسابقات
          </span>
        )}
      </div>
    </div>
  );
}
