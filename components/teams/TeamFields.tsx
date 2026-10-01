"use client";

import { TEAM_SPORTS, PLAYER_POSITIONS, PLAYER_STATUSES } from "@/lib/teams/catalog";
import { ShamsiDatePicker } from "@/components/ui/ShamsiDatePicker";
import { emptyPlayerForm, emptyTeamForm } from "./teamTypes";

type TeamForm = typeof emptyTeamForm;
type PlayerForm = typeof emptyPlayerForm;

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none";
const labelClass = "block text-xs font-bold text-slate-600 mb-1";

export function TeamFields({
  value,
  onChange,
}: {
  value: TeamForm;
  onChange: (next: TeamForm) => void;
}) {
  function set<K extends keyof TeamForm>(key: K, v: TeamForm[K]) {
    onChange({ ...value, [key]: v });
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelClass}>نام تیم *</label>
        <input className={inputClass} value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="مثلاً پرسپولیس تهران" />
      </div>
      <div>
        <label className={labelClass}>نام کوتاه</label>
        <input className={inputClass} value={value.short_name} onChange={(e) => set("short_name", e.target.value)} placeholder="مثلاً پرسپولیس" maxLength={16} />
      </div>
      <div>
        <label className={labelClass}>رشته ورزشی</label>
        <select className={inputClass} value={value.sport} onChange={(e) => set("sport", e.target.value)}>
          {TEAM_SPORTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>شهر</label>
        <input className={inputClass} value={value.city} onChange={(e) => set("city", e.target.value)} placeholder="تهران" />
      </div>
      <div>
        <label className={labelClass}>سال تأسیس (شمسی)</label>
        <input className={inputClass} value={value.founded_year} onChange={(e) => set("founded_year", e.target.value)} placeholder="۱۴۰۰" inputMode="numeric" />
      </div>
      <div>
        <label className={labelClass}>رنگ پیراهن میزبان</label>
        <input className={inputClass} value={value.kit_home} onChange={(e) => set("kit_home", e.target.value)} placeholder="قرمز" />
      </div>
      <div>
        <label className={labelClass}>رنگ پیراهن مهمان</label>
        <input className={inputClass} value={value.kit_away} onChange={(e) => set("kit_away", e.target.value)} placeholder="سفید" />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>نام مربی</label>
        <input className={inputClass} value={value.coach} onChange={(e) => set("coach", e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>یادداشت</label>
        <textarea className={inputClass} rows={3} value={value.description} onChange={(e) => set("description", e.target.value)} />
      </div>
    </div>
  );
}

export function PlayerFields({
  value,
  onChange,
}: {
  value: PlayerForm;
  onChange: (next: PlayerForm) => void;
}) {
  function set<K extends keyof PlayerForm>(key: K, v: PlayerForm[K]) {
    onChange({ ...value, [key]: v });
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelClass}>نام بازیکن *</label>
        <input className={inputClass} value={value.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>شماره پیراهن</label>
        <input className={inputClass} value={value.jersey_number} onChange={(e) => set("jersey_number", e.target.value)} inputMode="numeric" placeholder="۱۰" />
      </div>
      <div>
        <label className={labelClass}>پست</label>
        <select className={inputClass} value={value.position} onChange={(e) => set("position", e.target.value)}>
          <option value="">انتخاب پست</option>
          {PLAYER_POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>تاریخ تولد (شمسی)</label>
        <ShamsiDatePicker value={value.birth_date} onChange={(ymd) => set("birth_date", ymd)} placeholder="انتخاب تاریخ تولد" />
      </div>
      <div>
        <label className={labelClass}>موبایل</label>
        <input className={`${inputClass} dir-ltr text-right`} value={value.mobile} onChange={(e) => set("mobile", e.target.value)} inputMode="tel" placeholder="0912…" />
      </div>
      <div>
        <label className={labelClass}>کد ملی (اختیاری)</label>
        <input className={`${inputClass} dir-ltr text-right`} value={value.national_id} onChange={(e) => set("national_id", e.target.value)} inputMode="numeric" placeholder="۱۰ رقم" maxLength={10} />
      </div>
      <div>
        <label className={labelClass}>وضعیت</label>
        <select className={inputClass} value={value.status} onChange={(e) => set("status", e.target.value)}>
          {PLAYER_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
