import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Edit, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, computeAllDeductions } from "@/lib/payroll-utils";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmployeeFormDialog from "@/components/employees/EmployeeFormDialog";
import EmployeeImportDialog from "@/components/employees/EmployeeImportDialog";

interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  job_title: string | null;
  basic_salary: number;
  hire_date: string;
  employment_status: string;
  sss_number: string | null;
  philhealth_number: string | null;
  pagibig_number: string | null;
  tin_number: string | null;
}

const emptyForm = {
  first_name: "", last_name: "", middle_name: "", email: "", phone: "",
  department: "", job_title: "", basic_salary: 0, hire_date: new Date().toISOString().split("T")[0],
  sss_number: "", philhealth_number: "", pagibig_number: "", tin_number: "", employment_status: "active",
};

export default function Employees() {
  const { isAdminOrHR } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pagibigSettings, setPagibigSettings] = useState<{ employee: number; employer: number } | undefined>(undefined);

  const fetchEmployees = async () => {
    const { data, error } = await supabase.from("employees").select("*").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setEmployees(data || []);
    setLoading(false);
  };

  const fetchPagibigSettings = async () => {
    const { data } = await supabase.from("system_settings").select("key, value").in("key", ["pagibig_employee", "pagibig_employer"]);
    if (data && data.length === 2) {
      const map = Object.fromEntries(data.map(d => [d.key, parseFloat(d.value)]));
      setPagibigSettings({ employee: map.pagibig_employee || 400, employer: map.pagibig_employer || 400 });
    }
  };

  useEffect(() => { fetchEmployees(); fetchPagibigSettings(); }, []);

  const handleSave = async () => {
    try {
      const payload = {
        first_name: form.first_name, last_name: form.last_name, middle_name: form.middle_name || null,
        email: form.email || null, phone: form.phone || null, department: form.department || null,
        job_title: form.job_title || null, basic_salary: form.basic_salary, hire_date: form.hire_date,
        sss_number: form.sss_number || null, philhealth_number: form.philhealth_number || null,
        pagibig_number: form.pagibig_number || null, tin_number: form.tin_number || null,
        employment_status: form.employment_status,
      };
      if (editing) {
        const { error } = await supabase.from("employees").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Employee updated");
      } else {
        const { error } = await supabase.from("employees").insert({ ...payload, employee_code: "" });
        if (error) throw error;
        toast.success("Employee added");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleStatus = async (emp: Employee) => {
    const newStatus = emp.employment_status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("employees").update({ employment_status: newStatus }).eq("id", emp.id);
    if (error) toast.error(error.message);
    else { toast.success(`Employee ${newStatus === "active" ? "activated" : "deactivated"}`); fetchEmployees(); }
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({
      first_name: emp.first_name, last_name: emp.last_name, middle_name: emp.middle_name || "",
      email: emp.email || "", phone: emp.phone || "", department: emp.department || "",
      job_title: emp.job_title || "", basic_salary: emp.basic_salary, hire_date: emp.hire_date,
      sss_number: emp.sss_number || "", philhealth_number: emp.philhealth_number || "",
      pagibig_number: emp.pagibig_number || "", tin_number: emp.tin_number || "",
      employment_status: emp.employment_status,
    });
    setDialogOpen(true);
  };

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))] as string[];

  const filtered = employees.filter(e => {
    const matchesSearch = `${e.first_name} ${e.last_name} ${e.employee_code} ${e.department}`.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || e.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const deductions = selectedEmployee ? computeAllDeductions(selectedEmployee.basic_salary, pagibigSettings) : null;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-description">{employees.length} total employees</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64" />
          </div>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          {isAdminOrHR() && (
            <>
              <EmployeeFormDialog
                open={dialogOpen}
                onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
                form={form}
                setForm={setForm}
                onSave={handleSave}
                editing={!!editing}
                emptyForm={emptyForm}
              />
              <EmployeeImportDialog onImportComplete={fetchEmployees} />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Status</TableHead>
                {isAdminOrHR() && <TableHead className="w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No employees found</TableCell></TableRow>
              ) : (
                filtered.map(emp => (
                  <TableRow
                    key={emp.id}
                    className={`cursor-pointer ${selectedEmployee?.id === emp.id ? "bg-accent" : ""}`}
                    onClick={() => setSelectedEmployee(emp)}
                  >
                    <TableCell className="font-mono text-sm">{emp.employee_code}</TableCell>
                    <TableCell className="font-medium">{emp.first_name} {emp.last_name}</TableCell>
                    <TableCell>{emp.department || "—"}</TableCell>
                    <TableCell>{emp.job_title || "—"}</TableCell>
                    <TableCell>{formatCurrency(emp.basic_salary)}</TableCell>
                    <TableCell>
                      <Badge variant={emp.employment_status === "active" ? "default" : "secondary"}>
                        {emp.employment_status}
                      </Badge>
                    </TableCell>
                    {isAdminOrHR() && (
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => toggleStatus(emp)}>
                            {emp.employment_status === "active"
                              ? <UserX className="w-4 h-4 text-destructive" />
                              : <UserCheck className="w-4 h-4 text-primary" />}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Government Deductions Preview Panel */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Government Deductions Preview</h3>
          {selectedEmployee && deductions ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{selectedEmployee.first_name} {selectedEmployee.last_name}</span>
                <br />Basic Salary: {formatCurrency(selectedEmployee.basic_salary)}
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-border pb-2">
                  <span>SSS (EE)</span><span>{formatCurrency(deductions.sss.employee)}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>SSS (ER)</span><span className="text-muted-foreground">{formatCurrency(deductions.sss.employer)}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>SSS EC</span><span className="text-muted-foreground">{formatCurrency(deductions.sss.ec)}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>PhilHealth (EE)</span><span>{formatCurrency(deductions.philhealth.employee)}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>PhilHealth (ER)</span><span className="text-muted-foreground">{formatCurrency(deductions.philhealth.employer)}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Pag-IBIG (EE)</span><span>{formatCurrency(deductions.pagibig.employee)}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Pag-IBIG (ER)</span><span className="text-muted-foreground">{formatCurrency(deductions.pagibig.employer)}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Withholding Tax</span><span>{formatCurrency(deductions.withholdingTax)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2">
                  <span>Total EE Deductions</span><span>{formatCurrency(deductions.totalEmployeeDeductions)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Total ER Contributions</span><span>{formatCurrency(deductions.totalEmployerContributions)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Click an employee row to preview their government deductions.</p>
          )}
        </div>
      </div>
    </div>
  );
}
