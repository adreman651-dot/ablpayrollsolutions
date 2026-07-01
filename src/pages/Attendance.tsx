import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MapPin, Image as ImageIcon, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { offlineExecute } from "@/lib/offlineDb";
import { recalculatePayrollForDate } from "@/lib/payroll-recalc";

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
  status: string | null;
  total_hours: number | null;
  employee_code: string | null;
  employee_name: string | null;
  device_type: string | null;
  employees?: { first_name: string; last_name: string; employee_code: string };
}

export default function Attendance() {
  const { hasRole, user } = useAuth();
  const isAdminOrHR = hasRole('admin') || hasRole('hr');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<"day" | "month" | "range">("day");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [employees, setEmployees] = useState<any[]>([]);

  // Selfie Modal State
  const [selfieModal, setSelfieModal] = useState<AttendanceRecord | null>(null);

  // Edit Modal State
  const [editModal, setEditModal] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({
    date: '',
    time_in: '',
    time_out: '',
    location_label_in: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchAttendance = async () => {
    setLoading(true);
    let query = supabase.from("attendance").select("*, employees(first_name, last_name, employee_code, department)").order("date", { ascending: false }).order("time_in", { ascending: false });
    if (filterMode === "day") {
      query = query.eq("date", dateFilter);
    } else if (filterMode === "month") {
      const [y, m] = monthFilter.split("-").map(Number);
      const start = `${monthFilter}-01`;
      const endDate = new Date(y, m, 0).toISOString().split("T")[0];
      query = query.gte("date", start).lte("date", endDate);
    } else {
      query = query.gte("date", dateFrom).lte("date", dateTo);
    }
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
    // Convert ISO timestamps to local datetime-local input values
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
      notes: '',
    });
  };

  const handleEditSave = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      const timeInISO = editForm.time_in ? new Date(editForm.time_in).toISOString() : null;
      const timeOutISO = editForm.time_out ? new Date(editForm.time_out).toISOString() : null;

      // Calculate hours worked
      let hoursWorked: number | null = null;
      if (timeInISO && timeOutISO) {
        const diff = (new Date(timeOutISO).getTime() - new Date(timeInISO).getTime()) / 3600000;
        hoursWorked = Math.round(diff * 100) / 100;
      }

      // Calculate late minutes (if time_in is after 08:00)
      let lateMinutes = 0;
      if (timeInISO) {
        const tIn = new Date(timeInISO);
        const cutoff = new Date(tIn);
        cutoff.setHours(8, 0, 0, 0);
        if (tIn > cutoff) {
          lateMinutes = Math.round((tIn.getTime() - cutoff.getTime()) / 60000);
        }
      }

      const updates: any = {
        date: editForm.date,
        time_in: timeInISO,
        time_out: timeOutISO,
        location_label_in: editForm.location_label_in || null,
        late_minutes: lateMinutes,
        status: lateMinutes > 0 ? 'Late' : (timeInISO ? 'On Time' : editModal.status),
      };
      if (hoursWorked !== null) updates.total_hours = hoursWorked;

      const { error } = await supabase.from('attendance').update(updates).eq('id', editModal.id);
      if (error) throw error;

      // Audit log to local SQLite
      try {
        await offlineExecute(
          `INSERT INTO audit_logs (user_id, user_email, action, table_name, record_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            user?.id ?? null,
            user?.email ?? null,
            'EDIT',
            'attendance',
            editModal.id,
            JSON.stringify({ old: editModal, new: editForm, edited_by: user?.email }),
            new Date().toISOString(),
          ]
        );
      } catch (auditErr) {
        console.warn('Audit log write failed:', auditErr);
      }

      // Recalculate payroll for this date
      try {
        await recalculatePayrollForDate(editForm.date);
      } catch (recalcErr) {
        console.warn('Payroll recalc failed:', recalcErr);
      }

      toast.success('Attendance record updated');
      setEditModal(null);
      await fetchAttendance();
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { fetchAttendance(); }, [dateFilter]);

  const LocationCell = ({ label, lat, lng }: { label: string | null, lat: number | null, lng: number | null }) => {
    if (!lat || !lng) return <span className="text-muted-foreground">—</span>;
    const gmapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const displayLabel = label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    
    return (
      <a 
        href={gmapsUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-1 hover:text-primary transition-colors group"
        title={displayLabel}
      >
        <MapPin className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
        <span className="truncate max-w-[150px] inline-block align-bottom">{displayLabel}</span>
      </a>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Daily Logs</h1>
        <p className="page-description">Track daily time-in and time-out with GPS and selfies</p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-48" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center w-16">Photo</TableHead>
              <TableHead>Employee Code</TableHead>
              <TableHead>Employee Name</TableHead>
              <TableHead>Time In</TableHead>
              <TableHead>Time Out</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Device Used</TableHead>
              <TableHead>Status</TableHead>
              {isAdminOrHR && <TableHead className="w-20">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : records.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No records for this date</TableCell></TableRow>
            ) : (
              records.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-center">
                    {(r.photo_in_url || r.photo_out_url) ? (
                      <button 
                        onClick={() => setSelfieModal(r)}
                        className="inline-flex w-10 h-10 rounded-lg bg-muted border items-center justify-center overflow-hidden hover:ring-2 ring-primary/50 transition-all"
                      >
                        {r.photo_in_url ? (
                          <img src={r.photo_in_url} alt="Selfie" className="w-full h-full object-cover" />
                        ) : r.photo_out_url ? (
                          <img src={r.photo_out_url} alt="Selfie" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {r.employees?.employee_code || r.employee_code || "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : r.employee_name || "—"}
                  </TableCell>
                  <TableCell>
                    {r.time_in ? new Date(r.time_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : "—"}
                    {r.location_label_in && (
                       <div className="text-[10px] text-muted-foreground truncate max-w-[150px] flex items-center gap-1 mt-1" title={r.location_label_in}>
                         <MapPin className="w-3 h-3" /> {r.location_label_in}
                       </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.time_out ? new Date(r.time_out).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : "—"}
                    {r.location_label_out && (
                       <div className="text-[10px] text-muted-foreground truncate max-w-[150px] flex items-center gap-1 mt-1" title={r.location_label_out}>
                         <MapPin className="w-3 h-3" /> {r.location_label_out}
                       </div>
                    )}
                  </TableCell>
                  <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                  <TableCell>{r.device_type || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'On Time' || r.status === 'present' ? "default" : r.status === 'Late' || r.status === 'late' ? "secondary" : "destructive"}>
                      {r.status || "—"}
                    </Badge>
                  </TableCell>
                  {isAdminOrHR && (
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(r)}
                        className="h-8 w-8 p-0"
                        title="Edit Record"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Selfie Modal */}
      {selfieModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-card max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg">{selfieModal.employees?.first_name} {selfieModal.employees?.last_name}</h3>
                <p className="text-sm text-muted-foreground">{new Date(selfieModal.date).toLocaleDateString()}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelfieModal(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Time In */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-primary">TIME IN</h4>
                  <span className="text-xs font-mono">{selfieModal.time_in ? new Date(selfieModal.time_in).toLocaleTimeString() : "—"}</span>
                </div>
                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted flex items-center justify-center relative">
                  {selfieModal.photo_in_url ? (
                    <img src={selfieModal.photo_in_url} alt="Time In Selfie" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-muted-foreground flex flex-col items-center">
                      <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-sm">No Photo</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground leading-tight p-2 bg-muted/50 rounded-lg">
                  <MapPin className="w-3 h-3 inline mr-1 mb-0.5" />
                  {selfieModal.location_label_in || "No location recorded"}
                </div>
              </div>
              
              {/* Time Out */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-primary">TIME OUT</h4>
                  <span className="text-xs font-mono">{selfieModal.time_out ? new Date(selfieModal.time_out).toLocaleTimeString() : "—"}</span>
                </div>
                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted flex items-center justify-center relative">
                  {selfieModal.photo_out_url ? (
                    <img src={selfieModal.photo_out_url} alt="Time Out Selfie" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-muted-foreground flex flex-col items-center">
                      <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-sm">No Photo</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground leading-tight p-2 bg-muted/50 rounded-lg">
                  <MapPin className="w-3 h-3 inline mr-1 mb-0.5" />
                  {selfieModal.location_label_out || "No location recorded"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {isAdminOrHR && (
        <Dialog open={!!editModal} onOpenChange={(open) => { if (!open) setEditModal(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Attendance Record</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {editModal && (
                <p className="text-sm text-muted-foreground">
                  {editModal.employees ? `${editModal.employees.first_name} ${editModal.employees.last_name}` : editModal.employee_name}
                </p>
              )}
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editForm.date}
                  onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Time In</Label>
                <Input
                  type="datetime-local"
                  value={editForm.time_in}
                  onChange={e => setEditForm(f => ({ ...f, time_in: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Time Out</Label>
                <Input
                  type="datetime-local"
                  value={editForm.time_out}
                  onChange={e => setEditForm(f => ({ ...f, time_out: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Location Label (In)</Label>
                <Input
                  value={editForm.location_label_in}
                  onChange={e => setEditForm(f => ({ ...f, location_label_in: e.target.value }))}
                  placeholder="e.g. Office, Branch A"
                />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Input
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional admin note"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditModal(null)} disabled={saving}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
