import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Camera, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { computeDescriptorFromImage, descriptorToArray } from "@/lib/faceApi";
import { toast } from "sonner";

interface EmployeeFormData {
  first_name: string;
  last_name: string;
  middle_name: string;
  email: string;
  phone: string;
  department: string;
  job_title: string;
  basic_salary: number;
  hire_date: string;
  sss_number: string;
  philhealth_number: string;
  pagibig_number: string;
  tin_number: string;
  employment_status: string;
  payroll_type: string;
  employee_code: string;
  sss_schedule: string;
  phic_schedule: string;
  hdmf_schedule: string;
  sss_contribution: number;
  phic_contribution: number;
  hdmf_contribution: number;
  profile_photo_url?: string;
  face_descriptor?: number[] | null;
  face_detection_enabled?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: EmployeeFormData;
  setForm: (form: EmployeeFormData) => void;
  onSave: () => void;
  editing: boolean;
  emptyForm: EmployeeFormData;
}

const DEPARTMENTS = [
  "HR", "Finance", "IT", "Operations", "Sales", "Marketing",
  "Admin", "Engineering", "Accounting", "Logistics", "Production",
];

const PAYROLL_TYPES = [
  { value: "monthly_rate", label: "Monthly Rate" },
  { value: "daily_rate", label: "Daily Rate" },
  { value: "hourly_rate", label: "Hourly Rate" },
];

const EMPLOYMENT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "probationary", label: "Probationary" },
  { value: "contractual", label: "Contractual" },
  { value: "part_time", label: "Part-Time" },
  { value: "inactive", label: "Inactive" },
  { value: "resigned", label: "Resigned" },
  { value: "terminated", label: "Terminated" },
];

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="col-span-full mt-2">
      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b border-border pb-1">
        {title}
      </h4>
    </div>
  );
}

export default function EmployeeFormDialog({ open, onOpenChange, form, setForm, onSave, editing, emptyForm }: Props) {
  const payrollTypeLabel = PAYROLL_TYPES.find(p => p.value === form.payroll_type)?.label || "Monthly Rate";

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setForm(emptyForm); }}>
      {!editing && (
        <DialogTrigger asChild>
          <Button><Plus className="w-4 h-4 mr-2" />Add Employee</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Employee" : "Add New Employee"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">

          {/* ── Personal Information ── */}
          <SectionHeader title="Personal Information" />
          <div className="space-y-2 col-span-full">
            <Label>Employee Code *</Label>
            <Input value={form.employee_code} onChange={e => setForm({ ...form, employee_code: e.target.value })} placeholder="e.g. ABL-00001" />
          </div>
          <div className="space-y-2">
            <Label>Last Name *</Label>
            <Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Dela Cruz" />
          </div>
          <div className="space-y-2">
            <Label>First Name *</Label>
            <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="Juan" />
          </div>
          <div className="space-y-2">
            <Label>Middle Name</Label>
            <Input value={form.middle_name} onChange={e => setForm({ ...form, middle_name: e.target.value })} placeholder="Santos" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="juan@company.ph" />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="09XXXXXXXXX" />
          </div>

          {/* ── Employment Details ── */}
          <SectionHeader title="Employment Details" />
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={form.department} onValueChange={v => setForm({ ...form, department: v })}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Position / Job Title</Label>
            <Input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} placeholder="e.g. Payroll Officer" />
          </div>
          <div className="space-y-2">
            <Label>Employment Status</Label>
            <Select value={form.employment_status} onValueChange={v => setForm({ ...form, employment_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Hire Date *</Label>
            <Input type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} />
          </div>

          {/* ── Payroll Configuration ── */}
          <SectionHeader title="Payroll Configuration" />
          <div className="space-y-2">
            <Label>Payroll Type</Label>
            <Select value={form.payroll_type} onValueChange={v => setForm({ ...form, payroll_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {PAYROLL_TYPES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              Basic Salary (₱) *
              <Badge variant="outline" className="ml-2 text-xs">{payrollTypeLabel}</Badge>
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.basic_salary}
              onChange={e => setForm({ ...form, basic_salary: parseFloat(e.target.value) || 0 })}
              placeholder="e.g. 25000"
            />
            {form.payroll_type === "daily_rate" && form.basic_salary > 0 && (
              <p className="text-xs text-muted-foreground">≈ ₱{(form.basic_salary * 26).toLocaleString("en-PH")} / mo (26 days)</p>
            )}
            {form.payroll_type === "hourly_rate" && form.basic_salary > 0 && (
              <p className="text-xs text-muted-foreground">≈ ₱{(form.basic_salary * 8 * 26).toLocaleString("en-PH")} / mo</p>
            )}
          </div>

          {/* ── Government Numbers ── */}
          <SectionHeader title="Government ID Numbers & Deduction Schedules" />
          <div className="space-y-2">
            <Label>SSS Number</Label>
            <Input value={form.sss_number} onChange={e => setForm({ ...form, sss_number: e.target.value })} placeholder="XX-XXXXXXX-X" />
            <Input
              type="number" min="0" step="0.01"
              value={form.sss_contribution}
              onChange={e => setForm({ ...form, sss_contribution: parseFloat(e.target.value) || 0 })}
              placeholder="SSS Contribution Amount (₱/month)"
            />
            <p className="text-xs text-muted-foreground">Leave 0 to auto-compute from salary table</p>
            <Select value={form.sss_schedule || "both"} onValueChange={v => setForm({ ...form, sss_schedule: v })}>
              <SelectTrigger><SelectValue placeholder="Deduction Schedule" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both (15th & 30th)</SelectItem>
                <SelectItem value="15th">15th Only</SelectItem>
                <SelectItem value="30th">30th Only</SelectItem>
                <SelectItem value="none">None (Optional)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>PhilHealth Number</Label>
            <Input value={form.philhealth_number} onChange={e => setForm({ ...form, philhealth_number: e.target.value })} placeholder="XXXX-XXXXXXXX-X" />
            <Input
              type="number" min="0" step="0.01"
              value={form.phic_contribution}
              onChange={e => setForm({ ...form, phic_contribution: parseFloat(e.target.value) || 0 })}
              placeholder="PhilHealth Contribution Amount (₱/month)"
            />
            <p className="text-xs text-muted-foreground">Leave 0 to auto-compute (5% of salary)</p>
            <Select value={form.phic_schedule || "both"} onValueChange={v => setForm({ ...form, phic_schedule: v })}>
              <SelectTrigger><SelectValue placeholder="Deduction Schedule" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both (15th & 30th)</SelectItem>
                <SelectItem value="15th">15th Only</SelectItem>
                <SelectItem value="30th">30th Only</SelectItem>
                <SelectItem value="none">None (Optional)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Pag-IBIG Number</Label>
            <Input value={form.pagibig_number} onChange={e => setForm({ ...form, pagibig_number: e.target.value })} placeholder="XXXX-XXXX-XXXX" />
            <Input
              type="number" min="0" step="0.01"
              value={form.hdmf_contribution}
              onChange={e => setForm({ ...form, hdmf_contribution: parseFloat(e.target.value) || 0 })}
              placeholder="HDMF Contribution Amount (₱/month)"
            />
            <p className="text-xs text-muted-foreground">Leave 0 to use system default (₱400)</p>
            <Select value={form.hdmf_schedule || "both"} onValueChange={v => setForm({ ...form, hdmf_schedule: v })}>
              <SelectTrigger><SelectValue placeholder="Deduction Schedule" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both (15th & 30th)</SelectItem>
                <SelectItem value="15th">15th Only</SelectItem>
                <SelectItem value="30th">30th Only</SelectItem>
                <SelectItem value="none">None (Optional)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>TIN Number</Label>
            <Input value={form.tin_number} onChange={e => setForm({ ...form, tin_number: e.target.value })} placeholder="XXX-XXX-XXX-XXX" />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={!form.first_name || !form.last_name}>
            {editing ? "Update Employee" : "Save Employee"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
