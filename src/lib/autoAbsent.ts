/**
 * Automatic ABSENT attendance engine.
 *
 * An employee is automatically considered ABSENT for a date when:
 *  - the employee is active and already hired on that date
 *  - the date is a scheduled working day
 *  - the date has already passed (never future dates, never today)
 *  - no attendance record exists for that employee/date
 *  - no approved leave covers that date
 *
 * Existing attendance records ALWAYS take priority (Present, Day Off,
 * Rest Day, Holiday, Leave, OB, Training, ...). The generated rows are
 * virtual — they are not written to the database until an Admin/HR user
 * overrides them, which keeps `employee_id + date` unique.
 */

import { supabase } from "@/integrations/supabase/client";

export const VIRTUAL_ABSENT_PREFIX = "virtual-absent:";

export const isVirtualAbsent = (id: string | undefined | null) =>
  !!id && id.startsWith(VIRTUAL_ABSENT_PREFIX);

export interface VirtualAbsentRow {
  id: string;
  is_virtual: true;
  employee_id: string;
  date: string;
  time_in: null;
  time_out: null;
  photo_in_url: null;
  photo_out_url: null;
  latitude_in: null;
  longitude_in: null;
  latitude_out: null;
  longitude_out: null;
  location_label_in: null;
  location_label_out: null;
  gps_accuracy_in: null;
  gps_accuracy_out: null;
  status: string;
  attendance_status: "Absent";
  status_reason: null;
  total_hours: null;
  late_minutes: number;
  employee_code: string | null;
  employee_name: string | null;
  device_type: null;
  locked: false;
  employees?: { first_name: string; last_name: string; employee_code: string; department?: string | null };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local (device timezone) YYYY-MM-DD for today. */
export const localToday = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const eachDate = (from: string, to: string): string[] => {
  const out: string[] = [];
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const cur = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  let guard = 0;
  while (cur <= end && guard++ < 800) {
    out.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

const weekdayOf = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=Sun .. 6=Sat
};

const CUTOFF_CACHE_KEY = "abl_cutoff_time";
export const DEFAULT_CUTOFF_TIME = "10:00";

/** Normalise "10:00", "10:00:00", "10:00 AM" -> "HH:MM" (24h). */
export function normalizeCutoff(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_CUTOFF_TIME;
  const v = String(raw).replace(/["[\]]/g, "").trim();
  const ampm = v.match(/^(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?$/);
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (ampm[3].toLowerCase() === "p") h += 12;
    return `${pad(h)}:${ampm[2]}`;
  }
  const hm = v.match(/^(\d{1,2}):(\d{2})/);
  if (hm) return `${pad(Number(hm[1]))}:${hm[2]}`;
  return DEFAULT_CUTOFF_TIME;
}

/** Configurable Time-In cutoff (system_settings.cutoff_time). Cached for offline use. */
export async function getCutoffTime(): Promise<string> {
  try {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "cutoff_time")
      .maybeSingle();
    if (data?.value) {
      const v = normalizeCutoff(data.value);
      try { localStorage.setItem(CUTOFF_CACHE_KEY, v); } catch { /* ignore */ }
      return v;
    }
  } catch {
    /* offline — fall back to cached value */
  }
  try {
    const cached = localStorage.getItem(CUTOFF_CACHE_KEY);
    if (cached) return normalizeCutoff(cached);
  } catch { /* ignore */ }
  return DEFAULT_CUTOFF_TIME;
}

/** Local device time as HH:MM. */
export const localNowHHMM = (): string => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** True when the device local clock has reached/passed the configured cutoff. */
export const cutoffReached = (cutoff: string): boolean => localNowHHMM() >= normalizeCutoff(cutoff);

/** Working days configured in system_settings (`work_days`), default Mon–Sat. */
export async function getWorkDays(): Promise<number[]> {
  try {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "work_days")
      .maybeSingle();
    if (data?.value) {
      const raw = String(data.value).replace(/[[\]"]/g, "");
      const nums = raw.split(",").map(s => Number(s.trim())).filter(n => !isNaN(n) && n >= 0 && n <= 6);
      if (nums.length) return nums;
    }
  } catch {
    /* offline / not configured — fall back to default */
  }
  return [1, 2, 3, 4, 5, 6];
}

export interface ExistingKeyed {
  employee_id: string;
  date: string;
}

/**
 * Build the virtual ABSENT rows for a date range.
 * `existing` are the attendance records already loaded for the same range.
 */
export async function buildAutoAbsentRows(opts: {
  from: string;
  to: string;
  existing: ExistingKeyed[];
  employees?: any[];
  employeeId?: string | null;
  department?: string | null;
}): Promise<VirtualAbsentRow[]> {
  const { from, to, existing } = opts;
  if (!from || !to || from > to) return [];

  const today = localToday();
  // Never generate for today or future dates.
  const effectiveTo = to >= today ? addDays(today, -1) : to;
  if (from > effectiveTo) return [];

  let employees = opts.employees;
  if (!employees) {
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name, employee_code, department, hire_date, employment_status")
      .eq("employment_status", "active");
    employees = data || [];
  }
  employees = (employees || []).filter(e => (e.employment_status ?? "active") === "active");
  if (opts.employeeId && opts.employeeId !== "all") employees = employees.filter(e => e.id === opts.employeeId);
  if (opts.department && opts.department !== "all") employees = employees.filter(e => e.department === opts.department);
  if (!employees.length) return [];

  const workDays = await getWorkDays();
  const dates = eachDate(from, effectiveTo).filter(d => workDays.includes(weekdayOf(d)));
  if (!dates.length) return [];

  const existingKeys = new Set(existing.map(r => `${r.employee_id}_${r.date}`));

  // Approved leaves overlapping the range block automatic ABSENT.
  const leaveKeys = new Set<string>();
  try {
    const { data: leaves } = await supabase
      .from("leaves")
      .select("employee_id, start_date, end_date, status")
      .lte("start_date", effectiveTo)
      .gte("end_date", from);
    for (const l of leaves || []) {
      if (String(l.status).toLowerCase() !== "approved") continue;
      for (const d of eachDate(l.start_date, l.end_date)) leaveKeys.add(`${l.employee_id}_${d}`);
    }
  } catch {
    /* offline — leaves cannot be checked, existing records still win */
  }

  const rows: VirtualAbsentRow[] = [];
  for (const emp of employees) {
    const hire = emp.hire_date ? String(emp.hire_date).slice(0, 10) : null;
    for (const date of dates) {
      if (hire && date < hire) continue;
      const key = `${emp.id}_${date}`;
      if (existingKeys.has(key) || leaveKeys.has(key)) continue;
      rows.push({
        id: `${VIRTUAL_ABSENT_PREFIX}${emp.id}:${date}`,
        is_virtual: true,
        employee_id: emp.id,
        date,
        time_in: null,
        time_out: null,
        photo_in_url: null,
        photo_out_url: null,
        latitude_in: null,
        longitude_in: null,
        latitude_out: null,
        longitude_out: null,
        location_label_in: null,
        location_label_out: null,
        gps_accuracy_in: null,
        gps_accuracy_out: null,
        status: "ABSENT",
        attendance_status: "Absent",
        status_reason: null,
        total_hours: null,
        late_minutes: 0,
        employee_code: emp.employee_code ?? null,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        device_type: null,
        locked: false,
        employees: {
          first_name: emp.first_name,
          last_name: emp.last_name,
          employee_code: emp.employee_code,
          department: emp.department ?? null,
        },
      });
    }
  }
  return rows;
}

export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/**
 * Materialise a virtual ABSENT row into a real attendance record so it can be
 * overridden / audited. Uses employee_id + date as the logical key, so calling
 * it repeatedly never creates duplicates.
 */
export async function materializeAbsent(employeeId: string, date: string): Promise<string> {
  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("date", date)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("attendance")
    .insert([{
      employee_id: employeeId,
      date,
      status: "ABSENT",
      attendance_status: "Absent",
      total_hours: 0,
      late_minutes: 0,
    }])
    .select("id")
    .single();
  if (error) {
    // Unique-index race: fetch the winning row instead of failing.
    const { data: again } = await supabase
      .from("attendance").select("id").eq("employee_id", employeeId).eq("date", date).maybeSingle();
    if (again?.id) return again.id;
    throw error;
  }
  return data.id;
}
