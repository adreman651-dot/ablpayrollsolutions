import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

const DEPARTMENTS = ["HR", "Finance", "IT", "Operations", "Sales", "Marketing", "Admin", "Engineering"];

export default function EmployeeFormDialog({ open, onOpenChange, form, setForm, onSave, editing, emptyForm }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setForm(emptyForm); }}>
      {!editing && (
        <DialogTrigger asChild>
          <Button><Plus className="w-4 h-4 mr-2" />Add Employee</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Employee" : "Add New Employee"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label>First Name *</Label>
            <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Last Name *</Label>
            <Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Middle Name</Label>
            <Input value={form.middle_name} onChange={e => setForm({ ...form, middle_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
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
            <Input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Basic Salary (₱) *</Label>
            <Input type="number" value={form.basic_salary} onChange={e => setForm({ ...form, basic_salary: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Hire Date *</Label>
            <Input type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Employment Status</Label>
            <Select value={form.employment_status} onValueChange={v => setForm({ ...form, employment_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="probationary">Probationary</SelectItem>
                <SelectItem value="resigned">Resigned</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>SSS Number</Label>
            <Input value={form.sss_number} onChange={e => setForm({ ...form, sss_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>PhilHealth Number</Label>
            <Input value={form.philhealth_number} onChange={e => setForm({ ...form, philhealth_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Pag-IBIG Number</Label>
            <Input value={form.pagibig_number} onChange={e => setForm({ ...form, pagibig_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>TIN Number</Label>
            <Input value={form.tin_number} onChange={e => setForm({ ...form, tin_number: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={!form.first_name || !form.last_name}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
