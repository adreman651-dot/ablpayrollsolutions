import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Save, UserPlus } from "lucide-react";
import {
  SSS_TABLE, PHILHEALTH_RATE, PHILHEALTH_FLOOR, PHILHEALTH_CEILING, formatCurrency,
  PAGIBIG_DEFAULT_EMPLOYEE, PAGIBIG_DEFAULT_EMPLOYER,
} from "@/lib/payroll-utils";

interface Setting {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

interface UserWithRole {
  id: string;
  email: string;
  role: string;
  full_name: string;
}

// Generate PhilHealth sample table rows
function generatePhilHealthRows() {
  const sampleSalaries = [10000, 12000, 15000, 17500, 20000, 25000, 30000, 35000, 40000, 50000, 60000, 70000, 80000, 90000, 100000];
  return sampleSalaries.map(salary => {
    const base = Math.max(Math.min(salary, PHILHEALTH_CEILING), PHILHEALTH_FLOOR);
    const total = base * PHILHEALTH_RATE;
    const share = total / 2;
    return { salary, total, employee: share, employer: share };
  });
}

// TRAIN Law 2025 withholding tax table for display
const TRAIN_TAX_TABLE = [
  { bracket: "₱0 – ₱250,000", rate: "0%", fix: "₱0", excess: "—" },
  { bracket: "₱250,001 – ₱400,000", rate: "15%", fix: "₱0", excess: "over ₱250,000" },
  { bracket: "₱400,001 – ₱800,000", rate: "20%", fix: "₱22,500", excess: "over ₱400,000" },
  { bracket: "₱800,001 – ₱2,000,000", rate: "25%", fix: "₱102,500", excess: "over ₱800,000" },
  { bracket: "₱2,000,001 – ₱8,000,000", rate: "30%", fix: "₱402,500", excess: "over ₱2,000,000" },
  { bracket: "Over ₱8,000,000", rate: "35%", fix: "₱2,202,500", excess: "over ₱8,000,000" },
];

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleDialog, setRoleDialog] = useState(false);
  const [roleForm, setRoleForm] = useState({ email: "", role: "employee" });

  const fetchData = async () => {
    const [settingsRes, rolesRes] = await Promise.all([
      supabase.from("system_settings").select("*").order("key"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    setSettings(settingsRes.data || []);

    const roleData = rolesRes.data || [];
    const userIds = [...new Set(roleData.map(r => r.user_id))];
    if (userIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setUsers(roleData.map(r => ({
        id: r.user_id,
        email: "",
        role: r.role,
        full_name: profileMap.get(r.user_id)?.full_name || "Unknown",
      })));
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updateSetting = async (id: string, value: string) => {
    const { error } = await supabase.from("system_settings").update({ value }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Setting updated");
  };

  const assignRole = async () => {
    toast.info("The user must sign up first. Then assign their role using their user ID from the profiles table.");
    setRoleDialog(false);
  };

  const philHealthRows = generatePhilHealthRows();

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Configure system settings, government contribution schedules, and user roles</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="roles">User Roles</TabsTrigger>
          <TabsTrigger value="sss">SSS Table</TabsTrigger>
          <TabsTrigger value="philhealth">PhilHealth</TabsTrigger>
          <TabsTrigger value="pagibig">Pag-IBIG</TabsTrigger>
          <TabsTrigger value="tax">Withholding Tax</TabsTrigger>
        </TabsList>

        {/* ─── General Settings ─────────────────────────────────────── */}
        <TabsContent value="general" className="mt-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-display font-semibold">General System Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">Company information, payroll cutoffs, and system-wide configurations.</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setting Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-20">Save</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : settings.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">{s.key}</TableCell>
                    <TableCell>
                      <Input
                        value={s.value}
                        onChange={e => setSettings(prev => prev.map(p => p.id === s.id ? { ...p, value: e.target.value } : p))}
                        className="w-48"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.description}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => updateSetting(s.id, s.value)}>
                        <Save className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ─── User Roles ───────────────────────────────────────────── */}
        <TabsContent value="roles" className="mt-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold">Assigned Roles</h3>
                <p className="text-sm text-muted-foreground mt-1">Manage user access roles across the system.</p>
              </div>
              <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
                <DialogTrigger asChild>
                  <Button size="sm"><UserPlus className="w-4 h-4 mr-2" />Assign Role</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Assign User Role</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      To assign a role, the user must first sign up. After signing up, you can assign them a role through the Supabase dashboard or by entering their User ID.
                    </p>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={roleForm.role} onValueChange={v => setRoleForm({ ...roleForm, role: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="hr">HR</SelectItem>
                          <SelectItem value="payroll_officer">Payroll Officer</SelectItem>
                          <SelectItem value="employee">Employee</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={assignRole} className="w-full">Assign Role</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center py-12 text-muted-foreground">No roles assigned yet</TableCell></TableRow>
                ) : users.map((u, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="capitalize">{u.role.replace(/_/g, " ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ─── SSS Contribution Schedule ──────────────────────────── */}
        <TabsContent value="sss" className="mt-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-display font-semibold">SSS Contribution Table (2025–2026)</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Based on official SSS contribution schedule. MSC range: ₱5,000 – ₱35,000. Rate: EE 5%, ER 10%.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">MSC</TableHead>
                    <TableHead className="text-right">ER (10%)</TableHead>
                    <TableHead className="text-right">EE (5%)</TableHead>
                    <TableHead className="text-right">Total SSS</TableHead>
                    <TableHead className="text-right">EC</TableHead>
                    <TableHead className="text-right">Total ER</TableHead>
                    <TableHead className="text-right">Grand Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SSS_TABLE.map(row => (
                    <TableRow key={row.msc}>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(row.msc)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(row.employerShare)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(row.employeeShare)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(row.totalSSS)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(row.ecContribution)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(row.totalEmployer)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(row.totalContribution)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ─── PhilHealth Schedule ──────────────────────────────────── */}
        <TabsContent value="philhealth" className="mt-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-display font-semibold">PhilHealth Contribution Table (2025–2026)</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Premium Rate: {(PHILHEALTH_RATE * 100).toFixed(1)}% of Monthly Basic Salary.
                Floor: {formatCurrency(PHILHEALTH_FLOOR)} · Ceiling: {formatCurrency(PHILHEALTH_CEILING)} · Split: 50/50 (ER + EE)
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">Monthly Basic Salary</TableHead>
                    <TableHead className="text-right">Total Premium (5%)</TableHead>
                    <TableHead className="text-right">EE Share (2.5%)</TableHead>
                    <TableHead className="text-right">ER Share (2.5%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {philHealthRows.map(row => (
                    <TableRow key={row.salary}>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(row.salary)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(row.total)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(row.employee)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(row.employer)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ─── Pag-IBIG Contribution Settings ──────────────────────── */}
        <TabsContent value="pagibig" className="mt-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-display font-semibold">Pag-IBIG (HDMF) Contribution Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure the fixed monthly Pag-IBIG employee and employer shares. Default: ₱200 EE + ₱200 ER (max ₱400/mo).
              </p>
            </div>
            <div className="p-6">
              {(() => {
                const eeRow = settings.find(s => s.key === "pagibig_employee");
                const erRow = settings.find(s => s.key === "pagibig_employer");
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg">
                    <div className="space-y-2">
                      <Label className="font-medium">Employee Share (₱)</Label>
                      {eeRow ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={eeRow.value}
                            onChange={e => setSettings(prev => prev.map(p => p.id === eeRow.id ? { ...p, value: e.target.value } : p))}
                            className="w-32"
                          />
                          <Button size="sm" variant="outline" onClick={() => updateSetting(eeRow.id, eeRow.value)}>
                            <Save className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Default: ₱{PAGIBIG_DEFAULT_EMPLOYEE}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium">Employer Share (₱)</Label>
                      {erRow ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={erRow.value}
                            onChange={e => setSettings(prev => prev.map(p => p.id === erRow.id ? { ...p, value: e.target.value } : p))}
                            className="w-32"
                          />
                          <Button size="sm" variant="outline" onClick={() => updateSetting(erRow.id, erRow.value)}>
                            <Save className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Default: ₱{PAGIBIG_DEFAULT_EMPLOYER}</p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </TabsContent>

        {/* ─── Withholding Tax Table ────────────────────────────────── */}
        <TabsContent value="tax" className="mt-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-display font-semibold">Withholding Tax — TRAIN Law (RA 10963) Revised 2025</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Applicable to taxable compensation income. Tax is computed annually then divided by 12 for monthly withholding.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Annual Taxable Income Bracket</TableHead>
                    <TableHead className="text-right">Tax Rate</TableHead>
                    <TableHead className="text-right">Fixed Amount</TableHead>
                    <TableHead>On Excess</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TRAIN_TAX_TABLE.map((row, i) => (
                    <TableRow key={i} className={i === 0 ? "bg-emerald-50/50 dark:bg-emerald-950/10" : ""}>
                      <TableCell className="font-medium">{row.bracket}</TableCell>
                      <TableCell className="text-right font-mono">{row.rate}</TableCell>
                      <TableCell className="text-right font-mono">{row.fix}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{row.excess}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="p-4 border-t border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Taxable income = Gross Income − SSS (EE) − PhilHealth (EE) − Pag-IBIG (EE).
                The first ₱250,000 of annual income is exempt from tax as provided under RA 10963 (TRAIN Law).
                This table is display-only; tax is computed automatically during payroll processing.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
