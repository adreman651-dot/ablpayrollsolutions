import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MapPin, Image as ImageIcon, Pencil, X, Lock, ZoomIn, ZoomOut, ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { offlineExecute } from "@/lib/offlineDb";
import { recalculatePayrollForDate } from "@/lib/payroll-recalc";
import { getSelfieUrl } from "@/lib/selfieUrl";
import { Capacitor } from "@capacitor/core";
import { ATTENDANCE_STATUSES, getStatusMeta, type AttendanceStatus } from "@/lib/attendanceStatus";

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  photo_in_url: string | null;
  photo_out_url: string | null;
  latitude_in: number | null;
  longitude_in: number | null;
  latitude_out: number | null;
  longitude_out: number | null;
  location_label_in: string | null;
  location_label_out: string | null;
  gps_accuracy_in: number | null;
  gps_accuracy_out: number | null;
  status: string | null;
  attendance_status: string | null;
  status_reason: string | null;
  total_hours: number | null;
  employee_code: string | null;
  employee_name: string | null;
  device_type: string | null;
  locked?: boolean | null;
  employees?: { first_name: string; last_name: string; employee_code: string };
}

/** Lazy-loaded selfie thumbnail (signed URL when needed). */
function SelfieThumb({ src, alt, onClick, className = "" }: { src: string | null; alt: string; onClick?: () => void; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    let alive = true;
    setErrored(false);
    setUrl(null);
    if (!src) return;
    getSelfieUrl(src).then(u => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [src]);
  if (!src || errored) {
    return (
      <div className={`flex items-center justify-center text-[10px] text-muted-foreground bg-muted rounded ${className}`}>
        No Selfie Available
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`overflow-hidden rounded bg-muted border hover:ring-2 ring-primary/50 transition-all ${className}`}
      type="button"
    >
      {url ? (
        <img src={url} alt={alt} loading="lazy" className="w-full h-full object-cover" onError={() => setErrored(true)} />
      ) : (
        <div className="w-full h-full animate-pulse bg-muted" />
      )}
    </button>
  );
}

/** Full-size selfie with zoom & pan for preview dialog. */
function SelfieViewer({ src, label }: { src: string | null; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);
  const [resolution, setResolution] = useState<string>("");

  useEffect(() => {
    let alive = true;
    setErrored(false); setUrl(null); setZoom(1); setOffset({ x: 0, y: 0 }); setResolution("");
    if (!src) return;
    getSelfieUrl(src).then(u => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [src]);

  if (!src || errored) {
    return (
      <div className="aspect-[3/4] rounded-xl bg-muted flex flex-col items-center justify-center text-muted-foreground">
        <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
        <span className="text-sm">No Selfie Available</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{label}</span>
        <span>{resolution || "—"}</span>
      </div>
      <div
        className="relative aspect-[3/4] overflow-hidden rounded-xl bg-black select-none touch-none"
        onMouseDown={(e) => setDragging({ x: e.clientX - offset.x, y: e.clientY - offset.y })}
        onMouseMove={(e) => { if (dragging) setOffset({ x: e.clientX - dragging.x, y: e.clientY - dragging.y }); }}
        onMouseUp={() => setDragging(null)}
        onMouseLeave={() => setDragging(null)}
      >
        {url ? (
          <img
            src={url}
            alt={label}
            draggable={false}
            onLoad={(e) => setResolution(`${e.currentTarget.naturalWidth}×${e.currentTarget.naturalHeight}`)}
            onError={() => setErrored(true)}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: dragging ? "none" : "transform 0.15s",
            }}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full animate-pulse bg-muted" />
        )}
        <div className="absolute bottom-2 right-2 flex gap-1">
          <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => setZoom(z => Math.min(z + 0.25, 4))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => { setZoom(z => Math.max(z - 0.25, 1)); if (zoom <= 1.25) setOffset({ x: 0, y: 0 }); }}>
            <ZoomOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Attendance() {
  const { hasRole, user, roles } = useAuth();
  const isAdminOrHR = hasRole('admin') || hasRole('hr');
  const isManager = hasRole('payroll_officer'); // manager-style view-only
  const canChangeStatus = isAdminOrHR;
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<"day" | "month" | "range">("day");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [employees, setEmployees] = useState<any[]>([]);

  const [selfieModal, setSelfieModal] = useState<{ record: AttendanceRecord; type: 'in' | 'out' } | null>(null);
  const [editModal, setEditModal] = useState<AttendanceRecord | null>(null);
  const [statusModal, setStatusModal] = useState<{ record: AttendanceRecord; newStatus: AttendanceStatus } | null>(null);
  const [statusReason, setStatusReason] = useState<string>("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    date: '', time_in: '', time_out: '',
    location_label_in: '', location_label_out: '',
    latitude_in: '', longitude_in: '', latitude_out: '', longitude_out: '',
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchAttendance = async () => {
    setLoading(true);
    let query = supabase.from("attendance").select("*, employees(first_name, last_name, employee_code, department)").order("date", { ascending: false }).order("time_in", { ascending: false });
    if (filterMode === "day") query = query.eq("date", dateFilter);
    else if (filterMode === "month") {
      const [y, m] = monthFilter.split("-").map(Number);
      const start = `${monthFilter}-01`;
      const endDate = new Date(y, m, 0).toISOString().split("T")[0];
      query = query.gte("date", start).lte("date", endDate);
    } else query = query.gte("date", dateFrom).lte("date", dateTo);
    if (employeeFilter !== "all") query = query.eq("employee_id", employeeFilter);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else {
      let rows = (data || []) as any[];
      if (departmentFilter !== "all") rows = rows.filter(r => r.employees?.department === departmentFilter);
      setRecords(rows as any);
    }
    setLoading(false);
  };

  const openEditModal = (r: AttendanceRecord) => {
    setEditModal(r);
    const toLocalInput = (iso: string | null) => {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setEditForm({
      date: r.date || '',
      time_in: toLocalInput(r.time_in),
      time_out: toLocalInput(r.time_out),
      location_label_in: r.location_label_in || '',
      location_label_out: r.location_label_out || '',
      latitude_in: r.latitude_in != null ? String(r.latitude_in) : '',
      longitude_in: r.longitude_in != null ? String(r.longitude_in) : '',
      latitude_out: r.latitude_out != null ? String(r.latitude_out) : '',
      longitude_out: r.longitude_out != null ? String(r.longitude_out) : '',
      reason: '',
    });
  };

  const performSave = async () => {
    if (!editModal) return;
    if (!editForm.reason.trim()) {
      toast.error("Reason for Override is required.");
      return;
    }
    setSaving(true);
    try {
      const timeInISO = editForm.time_in ? new Date(editForm.time_in).toISOString() : null;
      const timeOutISO = editForm.time_out ? new Date(editForm.time_out).toISOString() : null;

      let hoursWorked: number | null = null;
      if (timeInISO && timeOutISO) {
        const diff = (new Date(timeOutISO).getTime() - new Date(timeInISO).getTime()) / 3600000;
        hoursWorked = Math.round(diff * 100) / 100;
      }
      let lateMinutes = 0;
      if (timeInISO) {
        const tIn = new Date(timeInISO);
        const cutoff = new Date(tIn); cutoff.setHours(8, 0, 0, 0);
        if (tIn > cutoff) lateMinutes = Math.round((tIn.getTime() - cutoff.getTime()) / 60000);
      }
      const parseNum = (v: string) => v.trim() === '' ? null : (isNaN(Number(v)) ? null : Number(v));

      const updates: any = {
        date: editForm.date,
        time_in: timeInISO,
        time_out: timeOutISO,
        location_label_in: editForm.location_label_in || null,
        location_label_out: editForm.location_label_out || null,
        latitude_in: parseNum(editForm.latitude_in),
        longitude_in: parseNum(editForm.longitude_in),
        latitude_out: parseNum(editForm.latitude_out),
        longitude_out: parseNum(editForm.longitude_out),
        late_minutes: lateMinutes,
        status: timeOutISO ? 'COMPLETED' : (lateMinutes > 0 ? 'Late' : (timeInISO ? 'On Time' : editModal.status)),
        locked: !!timeOutISO,
      };
      if (hoursWorked !== null) updates.total_hours = hoursWorked;

      const { error } = await supabase.from('attendance').update(updates).eq('id', editModal.id);
      if (error) throw error;

      // Cloud override audit trail
      const platform = Capacitor.isNativePlatform() ? "Android" : (window.electronAPI ? "Desktop" : "Web");
      const role = roles?.[0] || (isAdminOrHR ? 'admin' : 'user');
      try {
        await supabase.from('attendance_overrides').insert({
          attendance_id: editModal.id,
          employee_id: editModal.employee_id,
          employee_name: editModal.employees
            ? `${editModal.employees.first_name} ${editModal.employees.last_name}`
            : editModal.employee_name,
          original_time_in: editModal.time_in,
          new_time_in: timeInISO,
          original_time_out: editModal.time_out,
          new_time_out: timeOutISO,
          original_date: editModal.date,
          new_date: editForm.date,
          original_latitude: editModal.latitude_in,
          original_longitude: editModal.longitude_in,
          new_latitude: parseNum(editForm.latitude_in),
          new_longitude: parseNum(editForm.longitude_in),
          original_address: editModal.location_label_in,
          new_address: editForm.location_label_in,
          original_selfie_in: editModal.photo_in_url,
          new_selfie_in: editModal.photo_in_url,
          original_selfie_out: editModal.photo_out_url,
          new_selfie_out: editModal.photo_out_url,
          reason: editForm.reason.trim(),
          modified_by: user?.id,
          modified_by_email: user?.email,
          modified_by_role: role,
          device: navigator.userAgent.substring(0, 200),
          platform,
        });
      } catch (auditCloudErr) {
        console.warn('Override cloud audit write failed:', auditCloudErr);
      }

      // Local audit log
      try {
        await offlineExecute(
          `INSERT INTO audit_logs (user_id, user_email, action, table_name, record_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            user?.id ?? null,
            user?.email ?? null,
            'OVERRIDE',
            'attendance',
            editModal.id,
            JSON.stringify({ reason: editForm.reason, old: editModal, new: editForm }),
            new Date().toISOString(),
          ]
        );
      } catch (auditErr) {
        console.warn('Audit log write failed:', auditErr);
      }

      try { await recalculatePayrollForDate(editForm.date); }
      catch (recalcErr) { console.warn('Payroll recalc failed:', recalcErr); }

      toast.success('Attendance override saved.');
      setEditModal(null); setConfirmOpen(false);
      await fetchAttendance();
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { fetchAttendance(); }, [filterMode, dateFilter, monthFilter, dateFrom, dateTo, employeeFilter, departmentFilter]);
  useEffect(() => {
    supabase.from("employees").select("id, first_name, last_name, employee_code, department").order("last_name").then(({ data }) => setEmployees(data || []));
  }, []);

  const empLabel = (r: AttendanceRecord) =>
    r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : (r.employee_name || "—");

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter !== "all") {
        const eff = r.attendance_status || (r.status === "COMPLETED" || r.status === "On Time" || r.status === "Late" || r.status === "present" || r.status === "late" ? "Present" : null);
        if (eff !== statusFilter) return false;
      }
      if (q) {
        const hay = [
          empLabel(r),
          r.employees?.employee_code,
          r.employee_code,
          r.attendance_status,
          r.status,
          r.status_reason,
          r.date,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, statusFilter, searchQuery]);

  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));
  const totals = {
    days: new Set(filteredRecords.map(r => `${r.employee_id}_${r.date}`)).size,
    hours: filteredRecords.reduce((s, r: any) => s + (r.total_hours || 0), 0),
    late: filteredRecords.filter((r: any) => (r.late_minutes || 0) > 0).length,
    undertime: filteredRecords.filter((r: any) => (r.undertime_minutes || 0) > 0).length,
  };

  const performStatusChange = async () => {
    if (!statusModal) return;
    if (!canChangeStatus) { toast.error("You don't have permission to change attendance status."); return; }
    setStatusSaving(true);
    try {
      const nowISO = new Date().toISOString();
      const role = roles?.[0] || 'admin';
      const platform = Capacitor.isNativePlatform() ? "Android" : (window.electronAPI ? "Desktop" : "Web");
      const oldStatus = statusModal.record.attendance_status || statusModal.record.status || null;

      const { error } = await supabase.from('attendance').update({
        attendance_status: statusModal.newStatus,
        status_reason: statusReason.trim() || null,
        status_modified_by: user?.id ?? null,
        status_modified_by_email: user?.email ?? null,
        status_modified_by_role: role,
        status_modified_at: nowISO,
      }).eq('id', statusModal.record.id);
      if (error) throw error;

      try {
        await supabase.from('attendance_status_logs').insert({
          attendance_id: statusModal.record.id,
          employee_id: statusModal.record.employee_id,
          employee_name: empLabel(statusModal.record),
          attendance_date: statusModal.record.date,
          old_status: oldStatus,
          new_status: statusModal.newStatus,
          reason: statusReason.trim() || null,
          modified_by: user?.id ?? null,
          modified_by_email: user?.email ?? null,
          modified_by_role: role,
          platform,
          device: navigator.userAgent.substring(0, 200),
        });
      } catch (e) { console.warn('status log cloud write failed', e); }

      try {
        await offlineExecute(
          `INSERT INTO audit_logs (user_id, user_email, action, table_name, record_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            user?.id ?? null, user?.email ?? null, 'ATTENDANCE_STATUS_CHANGE', 'attendance', statusModal.record.id,
            JSON.stringify({ old: oldStatus, new: statusModal.newStatus, reason: statusReason, date: statusModal.record.date }),
            nowISO,
          ]
        );
      } catch (e) { console.warn('local audit failed', e); }

      try { await recalculatePayrollForDate(statusModal.record.date); }
      catch (e) { console.warn('payroll recalc failed', e); }

      toast.success(`Status set to ${statusModal.newStatus}`);
      setStatusModal(null);
      setStatusReason("");
      await fetchAttendance();
    } catch (err: any) {
      toast.error('Failed to update status: ' + err.message);
    } finally {
      setStatusSaving(false);
    }
  };


  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Daily Logs</h1>
        <p className="page-description">Track daily time-in and time-out with GPS and selfies</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-3"><div className="text-xs text-muted-foreground">Days Worked</div><div className="text-xl font-semibold">{totals.days}</div></div>
        <div className="bg-card border border-border rounded-xl p-3"><div className="text-xs text-muted-foreground">Total Hours</div><div className="text-xl font-semibold">{totals.hours.toFixed(2)}</div></div>
        <div className="bg-card border border-border rounded-xl p-3"><div className="text-xs text-muted-foreground">Late</div><div className="text-xl font-semibold">{totals.late}</div></div>
        <div className="bg-card border border-border rounded-xl p-3"><div className="text-xs text-muted-foreground">Undertime</div><div className="text-xl font-semibold">{totals.undertime}</div></div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={filterMode} onChange={e => setFilterMode(e.target.value as any)} className="h-10 px-3 rounded-md border border-border bg-background text-sm">
          <option value="day">Daily</option>
          <option value="month">Monthly</option>
          <option value="range">Date Range</option>
        </select>
        {filterMode === "day" && (
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-48" />
        )}
        {filterMode === "month" && (
          <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-48" />
        )}
        {filterMode === "range" && (
          <>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
          </>
        )}
        <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} className="h-10 px-3 rounded-md border border-border bg-background text-sm min-w-[180px]">
          <option value="all">All Employees</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.employee_code} — {e.last_name}, {e.first_name}</option>)}
        </select>
        <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="h-10 px-3 rounded-md border border-border bg-background text-sm min-w-[160px]">
          <option value="all">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 px-3 rounded-md border border-border bg-background text-sm min-w-[180px]">
          <option value="all">All Statuses</option>
          {ATTENDANCE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
        </select>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search name, code, status, reason…" className="pl-8 h-10" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee ID</TableHead>
              <TableHead>Employee Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time In</TableHead>
              <TableHead>Time Out</TableHead>
              <TableHead className="text-center w-28">Time In Selfie</TableHead>
              <TableHead className="text-center w-28">Time Out Selfie</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="min-w-[200px]">Attendance Status</TableHead>
              {isAdminOrHR && <TableHead className="w-20">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filteredRecords.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">No records for the selected filters</TableCell></TableRow>
            ) : (
              filteredRecords.map(r => {
                const isLocked = r.locked || r.status === 'COMPLETED' || (!!r.time_in && !!r.time_out);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.employees?.employee_code || r.employee_code || "—"}</TableCell>
                    <TableCell className="font-medium">{empLabel(r)}</TableCell>
                    <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {r.time_in ? new Date(r.time_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : "—"}
                      {(r.latitude_in != null && r.longitude_in != null) && (
                        <div className="text-[10px] mt-0.5 text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {r.latitude_in.toFixed(5)}, {r.longitude_in.toFixed(5)}
                          {r.gps_accuracy_in != null && ` · ±${Math.round(r.gps_accuracy_in)}m`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.time_out ? new Date(r.time_out).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : "—"}
                      {(r.latitude_out != null && r.longitude_out != null) && (
                        <div className="text-[10px] mt-0.5 text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {r.latitude_out.toFixed(5)}, {r.longitude_out.toFixed(5)}
                          {r.gps_accuracy_out != null && ` · ±${Math.round(r.gps_accuracy_out)}m`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <SelfieThumb
                        src={r.photo_in_url || (r as any).selfie_url || (r as any).selfie_image_path}
                        alt="Time In Selfie"
                        onClick={() => setSelfieModal({ record: r, type: 'in' })}
                        className="w-12 h-12 mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <SelfieThumb
                        src={r.photo_out_url || ((r.time_out && !r.photo_out_url && !r.photo_in_url) ? ((r as any).selfie_url || (r as any).selfie_image_path) : null)}
                        alt="Time Out Selfie"
                        onClick={() => setSelfieModal({ record: r, type: 'out' })}
                        className="w-12 h-12 mx-auto"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant={
                          r.status === 'COMPLETED' ? 'default'
                            : r.status === 'On Time' || r.status === 'present' ? 'default'
                              : r.status === 'Late' || r.status === 'late' ? 'secondary'
                                : 'destructive'
                        }>
                          {r.status || "—"}
                        </Badge>
                        {isLocked && <Lock className="w-3 h-3 text-muted-foreground" aria-label="Locked" />}
                      </div>
                    </TableCell>
                    {isAdminOrHR && (
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => openEditModal(r)} className="h-8 w-8 p-0" title={isLocked ? "Override Attendance" : "Edit Record"}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Selfie Preview Dialog */}
      <Dialog open={!!selfieModal} onOpenChange={(o) => { if (!o) setSelfieModal(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {selfieModal ? empLabel(selfieModal.record) : ''}
              {selfieModal && (
                <span className="ml-2 text-sm font-normal text-primary">
                  — {selfieModal.type === 'in' ? 'Time In Selfie' : 'Time Out Selfie'}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {selfieModal ? new Date(selfieModal.record.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
              {selfieModal?.type === 'in' && selfieModal.record.time_in && (
                <> · In {new Date(selfieModal.record.time_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</>
              )}
              {selfieModal?.type === 'out' && selfieModal.record.time_out && (
                <> · Out {new Date(selfieModal.record.time_out).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</>
              )}
            </DialogDescription>
          </DialogHeader>
          {selfieModal && (
            <div className="space-y-3">
              <SelfieViewer
                src={selfieModal.type === 'in' 
                  ? (selfieModal.record.photo_in_url || (selfieModal.record as any).selfie_url || (selfieModal.record as any).selfie_image_path)
                  : (selfieModal.record.photo_out_url || ((selfieModal.record.time_out && !selfieModal.record.photo_out_url && !selfieModal.record.photo_in_url) ? ((selfieModal.record as any).selfie_url || (selfieModal.record as any).selfie_image_path) : null))}
                label={selfieModal.type === 'in' ? 'TIME IN' : 'TIME OUT'}
              />
              <div className="text-[11px] text-muted-foreground p-2 bg-muted/50 rounded space-y-1">
                <div className="flex items-start gap-1">
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{(selfieModal.type === 'in' ? selfieModal.record.location_label_in : selfieModal.record.location_label_out) || "No location recorded"}</span>
                </div>
                {selfieModal.type === 'in' && selfieModal.record.gps_accuracy_in != null && (
                  <div>GPS Accuracy: ±{Math.round(selfieModal.record.gps_accuracy_in)}m</div>
                )}
                {selfieModal.type === 'out' && selfieModal.record.gps_accuracy_out != null && (
                  <div>GPS Accuracy: ±{Math.round(selfieModal.record.gps_accuracy_out)}m</div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelfieModal(null)}><X className="w-4 h-4 mr-1" /> Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override / Edit Modal */}
      {isAdminOrHR && (
        <Dialog open={!!editModal} onOpenChange={(open) => { if (!open) { setEditModal(null); setConfirmOpen(false); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {(editModal?.locked || editModal?.status === 'COMPLETED' || (!!editModal?.time_in && !!editModal?.time_out)) && <Lock className="w-4 h-4" />}
                Override Attendance
              </DialogTitle>
              <DialogDescription>
                Only Administrator or HR may modify a locked attendance record. A reason is required.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {editModal && (
                <p className="text-sm text-muted-foreground">{empLabel(editModal)}</p>
              )}
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Time In</Label>
                  <Input type="datetime-local" value={editForm.time_in} onChange={e => setEditForm(f => ({ ...f, time_in: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Time Out</Label>
                  <Input type="datetime-local" value={editForm.time_out} onChange={e => setEditForm(f => ({ ...f, time_out: e.target.value }))} />
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Time In Location</div>
                <Input value={editForm.location_label_in} onChange={e => setEditForm(f => ({ ...f, location_label_in: e.target.value }))} placeholder="Address (In)" />
                <div className="grid grid-cols-2 gap-3">
                  <Input value={editForm.latitude_in} onChange={e => setEditForm(f => ({ ...f, latitude_in: e.target.value }))} placeholder="Latitude" />
                  <Input value={editForm.longitude_in} onChange={e => setEditForm(f => ({ ...f, longitude_in: e.target.value }))} placeholder="Longitude" />
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Time Out Location</div>
                <Input value={editForm.location_label_out} onChange={e => setEditForm(f => ({ ...f, location_label_out: e.target.value }))} placeholder="Address (Out)" />
                <div className="grid grid-cols-2 gap-3">
                  <Input value={editForm.latitude_out} onChange={e => setEditForm(f => ({ ...f, latitude_out: e.target.value }))} placeholder="Latitude" />
                  <Input value={editForm.longitude_out} onChange={e => setEditForm(f => ({ ...f, longitude_out: e.target.value }))} placeholder="Longitude" />
                </div>
              </div>

              <div className="space-y-1 border-t pt-3">
                <Label className="text-destructive">Reason for Override *</Label>
                <Input
                  value={editForm.reason}
                  onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Explain why this record is being modified"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditModal(null)} disabled={saving}>Cancel</Button>
              <Button onClick={() => setConfirmOpen(true)} disabled={saving || !editForm.reason.trim()}>
                {saving ? 'Saving...' : 'Save Override'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Override</DialogTitle>
            <DialogDescription>
              This will modify the attendance record, log the change to the audit trail, and recalculate payroll for the day. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={performSave} disabled={saving}>{saving ? 'Saving...' : 'Confirm & Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
