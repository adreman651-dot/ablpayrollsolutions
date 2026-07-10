// Enterprise Attendance Status catalog + colored-badge classes.
// Keep this in sync with Payroll rules; see recalculatePayrollForDate.

export type AttendanceStatus =
  | "Present"
  | "Day Off"
  | "Rest Day"
  | "Holiday"
  | "Sick Leave"
  | "Vacation Leave"
  | "Official Business"
  | "Training"
  | "Absent";

export interface AttendanceStatusMeta {
  value: AttendanceStatus;
  label: string;
  icon: string;
  /** Tailwind classes for a colored Badge */
  badgeClass: string;
  /** Whether payroll treats this as a paid working day */
  countsAsWorkDay: boolean;
  /** Whether payroll should skip late / undertime / overtime for this day */
  skipTimeMetrics: boolean;
}

export const ATTENDANCE_STATUSES: AttendanceStatusMeta[] = [
  { value: "Present",           label: "Present",           icon: "✅", badgeClass: "bg-green-100 text-green-800 hover:bg-green-100 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",   countsAsWorkDay: true,  skipTimeMetrics: false },
  { value: "Day Off",           label: "Day Off",           icon: "🌴", badgeClass: "bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",         countsAsWorkDay: false, skipTimeMetrics: true  },
  { value: "Rest Day",          label: "Rest Day",          icon: "🏖", badgeClass: "bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800", countsAsWorkDay: false, skipTimeMetrics: true  },
  { value: "Holiday",           label: "Holiday",           icon: "🎉", badgeClass: "bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800", countsAsWorkDay: true,  skipTimeMetrics: true  },
  { value: "Sick Leave",        label: "Sick Leave",        icon: "🏥", badgeClass: "bg-red-100 text-red-800 hover:bg-red-100 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",                 countsAsWorkDay: true,  skipTimeMetrics: true  },
  { value: "Vacation Leave",    label: "Vacation Leave",    icon: "🌴", badgeClass: "bg-teal-100 text-teal-800 hover:bg-teal-100 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",            countsAsWorkDay: true,  skipTimeMetrics: true  },
  { value: "Official Business", label: "Official Business", icon: "💼", badgeClass: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800", countsAsWorkDay: true,  skipTimeMetrics: false },
  { value: "Training",          label: "Training",          icon: "📚", badgeClass: "bg-cyan-100 text-cyan-800 hover:bg-cyan-100 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800",            countsAsWorkDay: true,  skipTimeMetrics: false },
  { value: "Absent",            label: "Absent",            icon: "❌", badgeClass: "bg-gray-200 text-gray-800 hover:bg-gray-200 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",           countsAsWorkDay: false, skipTimeMetrics: true  },
];

const MAP = new Map(ATTENDANCE_STATUSES.map((s) => [s.value, s]));

export function getStatusMeta(status?: string | null): AttendanceStatusMeta | undefined {
  if (!status) return undefined;
  return MAP.get(status as AttendanceStatus);
}

export function isAttendanceStatus(value: string | null | undefined): value is AttendanceStatus {
  return !!value && MAP.has(value as AttendanceStatus);
}
