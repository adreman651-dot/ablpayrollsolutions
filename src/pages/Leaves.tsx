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
import { Plus, Check, X } from "lucide-react";
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
  leave_types?: { name: string };
}

interface LeaveType {
  id: string;
  name: string;
  credits_per_year: number;
}

export default function Leaves() {
  const { hasRole, employeeId, user, isAdminOrHR } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employees, setEmployees] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "" });

  const fetchData = async () => {
    const [leavesRes, typesRes, empRes] = await Promise.all([
      supabase.from("leaves").select("*, employees(first_name, last_name, employee_code), leave_types(name)").order("created_at", { ascending: false }),
      supabase.from("leave_types").select("*"),
      supabase.from("employees").select("id, first_name, last_name").eq("employment_status", "active"),
    ]);
    setLeaves(leavesRes.data || []);
    setLeaveTypes(typesRes.data || []);
    setEmployees(empRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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
    const { error } = await supabase.from("leaves").insert({
      employee_id: empId, leave_type_id: form.leave_type_id,
      start_date: form.start_date, end_date: form.end_date,
      duration, reason: form.reason || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Leave application submitted"); setDialogOpen(false); setForm({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "" }); fetchData(); }
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

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p className="page-description">Track and manage employee leaves</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Apply Leave</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Leave Application</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              {isAdminOrHR() && (
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
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
                <Label>Leave Type</Label>
                <Select value={form.leave_type_id} onValueChange={v => setForm({ ...form, leave_type_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name} ({t.credits_per_year} credits/yr)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Optional reason..." />
              </div>
              <Button onClick={handleApply} className="w-full">Submit Application</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
              {isAdminOrHR() && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : leaves.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No leave records</TableCell></TableRow>
            ) : leaves.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">
                  {l.employees ? `${l.employees.first_name} ${l.employees.last_name}` : "—"}
                </TableCell>
                <TableCell>{l.leave_types?.name || "—"}</TableCell>
                <TableCell>{l.duration} day{l.duration !== 1 ? "s" : ""}</TableCell>
                <TableCell className="text-sm">{l.start_date} to {l.end_date}</TableCell>
                <TableCell><Badge variant={statusColor(l.status) as any}>{l.status}</Badge></TableCell>
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
