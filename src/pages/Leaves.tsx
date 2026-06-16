import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Check, X, CalendarDays, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface LeaveRecord {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  duration: number;
  reason: string | null;
  status: string;
  created_at: string;
  employees?: { first_name: string; last_name: string; employee_code: string };
  leave_types?: { name: string; credits_per_year: number };
}

interface LeaveType {
  id: string;
  name: string;
  credits_per_year: number;
}

interface LeaveBalance {
  leave_type_id: string;
  leave_type_name: string;
  credits: number;
  used: number;
  remaining: number;
}

const PH_LEAVE_TYPES_DEFAULT = [
  "Sick Leave",
  "Vacation Leave",
  "Emergency Leave",
  "Maternity Leave",
  "Paternity Leave",
  "Other Leave",
];

export default function Leaves() {
  const { hasRole, employeeId, user, isAdminOrHR } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employees, setEmployees] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "",
  });

  const fetchData = async () => {
    const [leavesRes, typesRes, empRes] = await Promise.all([
      supabase.from("leaves")
        .select("*, employees(first_name, last_name, employee_code), leave_types(name, credits_per_year)")
        .order("created_at", { ascending: false }),
      supabase.from("leave_types").select("*"),
      supabase.from("employees").select("id, first_name, last_name").eq("employment_status", "active"),
    ]);
    setLeaves(leavesRes.data || []);
    setLeaveTypes(typesRes.data || []);
    setEmployees(empRes.data || []);
    setLoading(false);
  };

  // Compute leave balances for current employee (or selected employee for HR)
  const computeBalances = async (empId: string) => {
    if (!empId) return;
    const { data: types } = await supabase.from("leave_types").select("*");
    const { data: approved } = await supabase.from("leaves")
      .select("leave_type_id, duration")
      .eq("employee_id", empId)
      .eq("status", "approved");

    const usedMap: Record<string, number> = {};
    (approved || []).forEach(l => {
      usedMap[l.leave_type_id] = (usedMap[l.leave_type_id] || 0) + l.duration;
    });

    const balances: LeaveBalance[] = (types || []).map(t => ({
      leave_type_id: t.id,
      leave_type_name: t.name,
      credits: t.credits_per_year,
      used: usedMap[t.id] || 0,
      remaining: Math.max(0, t.credits_per_year - (usedMap[t.id] || 0)),
    }));
    setLeaveBalances(balances);
  };

  useEffect(() => {
    fetchData();
    const eid = employeeId;
    if (eid) computeBalances(eid);
  }, [employeeId]);

  const computeDuration = (start: string, end: string) => {
    if (!start || !end) return 1;
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(1, diff + 1);
  };

  const handleApply = async () => {
    const empId = hasRole("employee") && employeeId ? employeeId : form.employee_id;
    if (!empId || !form.leave_type_id || !form.start_date || !form.end_date) {
      toast.error("Please fill all required fields"); return;
    }
    const duration = computeDuration(form.start_date, form.end_date);

    // Check leave credits
    const selType = leaveTypes.find(t => t.id === form.leave_type_id);
    if (selType) {
      const { data: usedLeaves } = await supabase.from("leaves")
        .select("duration")
        .eq("employee_id", empId)
        .eq("leave_type_id", form.leave_type_id)
        .eq("status", "approved");
      const totalUsed = (usedLeaves || []).reduce((s, l) => s + l.duration, 0);
      const remaining = selType.credits_per_year - totalUsed;

      if (duration > remaining && remaining > 0) {
        if (!confirm(`Warning: Employee only has ${remaining} day(s) of ${selType.name} credits remaining. The excess will result in salary deduction. Continue?`)) return;
      } else if (remaining <= 0) {
        if (!confirm(`Warning: No ${selType.name} credits remaining. This leave will result in salary deduction. Continue?`)) return;
      }
    }

    const { error } = await supabase.from("leaves").insert({
      employee_id: empId, leave_type_id: form.leave_type_id,
      start_date: form.start_date, end_date: form.end_date,
      duration, reason: form.reason || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Leave application submitted");
      setDialogOpen(false);
      setForm({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "" });
      fetchData();
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("leaves").update({ status, approved_by: user?.id }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Leave ${status}`); fetchData(); }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "approved": return "default";
      case "rejected": return "destructive";
      case "cancelled": return "secondary";
      default: return "outline";
    }
  };

  const duration = form.start_date && form.end_date ? computeDuration(form.start_date, form.end_date) : 0;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p className="page-description">Manage employee leaves with credit-based deduction rules</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Apply Leave</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Leave Application</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              {isAdminOrHR() && (
                <div className="space-y-2">
                  <Label>Employee *</Label>
                  <Select
                    value={form.employee_id}
                    onValueChange={v => { setForm({ ...form, employee_id: v }); computeBalances(v); }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      {employees.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Leave Type *</Label>
                <Select value={form.leave_type_id} onValueChange={v => setForm({ ...form, leave_type_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map(t => {
                      const bal = leaveBalances.find(b => b.leave_type_id === t.id);
                      return (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                          {bal !== undefined && ` (${bal.remaining} days left)`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              {duration > 0 && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm text-blue-700 dark:text-blue-400">
                  <CalendarDays className="w-4 h-4 shrink-0" />
                  <span>Duration: <strong>{duration} day{duration !== 1 ? "s" : ""}</strong></span>
                </div>
              )}
              {form.leave_type_id && leaveBalances.find(b => b.leave_type_id === form.leave_type_id && b.remaining === 0) && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>No credits remaining. Salary deduction will apply.</span>
                </div>
              )}
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  placeholder="Optional reason for leave..."
                  rows={3}
                />
              </div>
              <Button onClick={handleApply} className="w-full">Submit Application</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Leave Balances (for current employee or overview) */}
      {leaveBalances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {leaveBalances.map(b => (
            <div key={b.leave_type_id} className="stat-card py-3 px-4">
              <p className="text-xs text-muted-foreground truncate mb-1">{b.leave_type_name}</p>
              <p className={`text-2xl font-bold ${b.remaining === 0 ? "text-rose-500" : b.remaining <= 2 ? "text-amber-500" : "text-primary"}`}>
                {b.remaining}
              </p>
              <p className="text-xs text-muted-foreground">{b.used} used / {b.credits} total</p>
            </div>
          ))}
        </div>
      )}

      {/* Leave Records Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              {isAdminOrHR() && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : leaves.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No leave records found</TableCell></TableRow>
            ) : leaves.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">
                  <div>{l.employees ? `${l.employees.first_name} ${l.employees.last_name}` : "—"}</div>
                  <div className="text-xs text-muted-foreground">{l.employees?.employee_code}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {l.leave_types?.name || "—"}
                  </Badge>
                </TableCell>
                <TableCell>{l.duration} day{l.duration !== 1 ? "s" : ""}</TableCell>
                <TableCell className="text-sm">{l.start_date} → {l.end_date}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{l.reason || "—"}</TableCell>
                <TableCell>
                  <Badge variant={statusColor(l.status) as any}>{l.status}</Badge>
                </TableCell>
                {isAdminOrHR() && (
                  <TableCell>
                    {l.status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => updateStatus(l.id, "approved")}>
                          <Check className="w-3 h-3 mr-1" />Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(l.id, "rejected")}>
                          <X className="w-3 h-3 mr-1" />Reject
                        </Button>
                      </div>
                    )}
                    {l.status === "approved" && (
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => updateStatus(l.id, "cancelled")}>
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
