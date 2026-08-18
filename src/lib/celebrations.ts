import { supabase } from "@/integrations/supabase/client";

export interface BirthdayCelebrant {
  id: string;
  name: string;
  firstName: string;
}

export interface AnniversaryCelebrant extends BirthdayCelebrant {
  years: number;
}

export interface Celebrations {
  birthdays: BirthdayCelebrant[];
  anniversaries: AnniversaryCelebrant[];
  companyName: string;
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Compare only month/day of a stored YYYY-MM-DD date against today (local). */
function isSameMonthDay(dateStr: string | null | undefined, today: Date): boolean {
  if (!dateStr) return false;
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length !== 3) return false;
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!m || !d) return false;
  return m === today.getMonth() + 1 && d === today.getDate();
}

function yearsSince(dateStr: string, today: Date): number {
  const y = Number(dateStr.slice(0, 4));
  if (!y) return 0;
  return today.getFullYear() - y;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export async function fetchTodaysCelebrations(): Promise<Celebrations> {
  const today = new Date();
  const result: Celebrations = { birthdays: [], anniversaries: [], companyName: "" };

  const [empRes, settingRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, first_name, last_name, birthdate, hire_date, employment_status")
      .eq("employment_status", "active"),
    supabase.from("system_settings").select("value").eq("key", "company_name").maybeSingle(),
  ]);

  result.companyName = settingRes.data?.value || "our company";

  for (const emp of empRes.data || []) {
    const name = `${emp.first_name} ${emp.last_name}`.trim();
    const base = { id: emp.id, name, firstName: emp.first_name };
    if (isSameMonthDay(emp.birthdate, today)) result.birthdays.push(base);
    if (emp.hire_date && isSameMonthDay(emp.hire_date, today)) {
      const years = yearsSince(emp.hire_date, today);
      if (years > 0) result.anniversaries.push({ ...base, years });
    }
  }

  return result;
}
