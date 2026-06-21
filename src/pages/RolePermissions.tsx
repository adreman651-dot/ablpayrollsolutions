import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Shield, Save, Check, X } from 'lucide-react';

export default function RolePermissions() {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState([
    {
      name: 'Administrator',
      role: 'admin',
      permissions: {
        dashboard: true, employees: true, attendance: true, payroll: true,
        payslips: true, leaves: true, loans: true, reports: true, settings: true,
        maintenance: true, sync_center: true, gov_contributions: true,
        user_mgmt: true, role_perms: true, audit_logs: true
      }
    },
    {
      name: 'Manager',
      role: 'manager',
      permissions: {
        dashboard: false, employees: false, attendance: true, payroll: false,
        payslips: false, leaves: true, loans: false, reports: true, settings: false,
        maintenance: false, sync_center: false, gov_contributions: false,
        user_mgmt: false, role_perms: false, audit_logs: false
      }
    },
    {
      name: 'Employee',
      role: 'employee',
      permissions: {
        dashboard: false, employees: false, attendance: true, payroll: false,
        payslips: true, leaves: true, loans: true, reports: false, settings: false,
        maintenance: false, sync_center: false, gov_contributions: false,
        user_mgmt: false, role_perms: false, audit_logs: false
      }
    }
  ]);

  const handleToggle = (roleIndex: number, permissionKey: string) => {
    // Admins are locked to true
    if (roles[roleIndex].role === 'admin') return;

    setRoles(prev => prev.map((r, idx) => {
      if (idx !== roleIndex) return r;
      return {
        ...r,
        permissions: {
          ...r.permissions,
          [permissionKey]: !r.permissions[permissionKey as keyof typeof r.permissions]
        }
      };
    }));
  };

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      toast.success("Security permissions updated and enforced system-wide.");
      setLoading(false);
    }, 500);
  };

  const permissionsList = [
    { key: 'dashboard', label: 'Admin Dashboard View' },
    { key: 'employees', label: 'Modify Employee Profiles' },
    { key: 'attendance', label: 'Manage Attendance Sheets / Self Attendance' },
    { key: 'payroll', label: 'Process Payroll Cycles' },
    { key: 'payslips', label: 'Generate & View Payslips' },
    { key: 'leaves', label: 'Approve & View Leave Requests' },
    { key: 'loans', label: 'Modify Loans & Advances' },
    { key: 'reports', label: 'Access Summary Reports' },
    { key: 'settings', label: 'Modify System Settings' },
    { key: 'maintenance', label: 'Database Backup & Restore' },
    { key: 'sync_center', label: 'Access Sync Center & Logs' },
    { key: 'gov_contributions', label: 'Manage Contributions & Rates' },
    { key: 'user_mgmt', label: 'Manage User Accounts' },
    { key: 'role_perms', label: 'Modify Security Clearances' },
    { key: 'audit_logs', label: 'Access System Audit Trails' }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-display">Role Permissions</h1>
          <p className="text-muted-foreground">Configure access control levels and authorization rules for system portals</p>
        </div>
        <Button onClick={handleSave} disabled={loading} className="gap-2">
          <Save className="w-4 h-4" />
          Save Policy
        </Button>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Security Matrix
          </CardTitle>
          <CardDescription>Grant or deny specific action pathways to user groups</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Functional Pathway</TableHead>
                {roles.map(r => (
                  <TableHead key={r.role} className="text-center">{r.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissionsList.map(p => (
                <TableRow key={p.key}>
                  <TableCell className="font-medium text-white">{p.label}</TableCell>
                  {roles.map((r, rIdx) => {
                    const hasAccess = r.permissions[p.key as keyof typeof r.permissions];
                    return (
                      <TableCell key={r.role} className="text-center">
                        <button
                          onClick={() => handleToggle(rIdx, p.key)}
                          className={`p-1.5 rounded-lg border transition-all ${hasAccess ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'} ${r.role === 'admin' ? 'cursor-not-allowed opacity-90' : 'hover:scale-105'}`}
                        >
                          {hasAccess ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </button>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
