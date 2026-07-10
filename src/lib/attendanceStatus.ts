/**
 * Centralized Attendance Status definitions.
 * Used across the Attendance module for manual entry, filtering, and display.
 */

export type AttendanceStatus =
  | 'Present'
  | 'Day Off'
  | 'Rest Day'
  | 'Holiday'
  | 'Sick Leave'
  | 'Vacation Leave'
  | 'Official Business'
  | 'Training'
  | 'Absent';

export interface StatusMeta {
  value: AttendanceStatus;
  label: string;
  icon: string;
  badgeClass: string;
}

export const ATTENDANCE_STATUSES: StatusMeta[] = [
  { value: 'Present',          label: 'Present',          icon: '✅', badgeClass: 'border-green-500 text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950' },
  { value: 'Day Off',          label: 'Day Off',          icon: '🏖️', badgeClass: 'border-blue-400 text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950' },
  { value: 'Rest Day',         label: 'Rest Day',         icon: '😴', badgeClass: 'border-purple-400 text-purple-700 bg-purple-50 dark:text-purple-400 dark:bg-purple-950' },
  { value: 'Holiday',          label: 'Holiday',          icon: '🎉', badgeClass: 'border-yellow-400 text-yellow-700 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950' },
  { value: 'Sick Leave',       label: 'Sick Leave',       icon: '🤒', badgeClass: 'border-orange-400 text-orange-700 bg-orange-50 dark:text-orange-400 dark:bg-orange-950' },
  { value: 'Vacation Leave',   label: 'Vacation Leave',   icon: '🌴', badgeClass: 'border-teal-400 text-teal-700 bg-teal-50 dark:text-teal-400 dark:bg-teal-950' },
  { value: 'Official Business',label: 'Official Business',icon: '💼', badgeClass: 'border-indigo-400 text-indigo-700 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950' },
  { value: 'Training',         label: 'Training',         icon: '📚', badgeClass: 'border-cyan-400 text-cyan-700 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-950' },
  { value: 'Absent',           label: 'Absent',           icon: '❌', badgeClass: 'border-red-400 text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950' },
];

export function getStatusMeta(status?: AttendanceStatus | string): StatusMeta | undefined {
  if (!status) return undefined;
  return ATTENDANCE_STATUSES.find(s => s.value === status);
}
