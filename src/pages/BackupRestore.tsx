import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Download, Upload, Trash2, Database, FileJson, Table, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { offlineQuery, offlineExecute } from '@/lib/offlineDb';
import * as XLSX from 'xlsx';

export default function BackupRestore() {
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const handleBackupJSON = async () => {
    setLoading(true);
    try {
      const tables = ['employees', 'attendance', 'leaves', 'loans', 'payroll_runs', 'payroll_items', 'system_settings'];
      const data: Record<string, any[]> = {};
      for (const t of tables) {
        data[t] = await offlineQuery(`SELECT * FROM ${t}`);
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `abl_payroll_backup_${Date.now()}.json`;
      a.click();
      toast.success("JSON backup generated and downloaded successfully");
    } catch (e: any) {
      toast.error("JSON Backup failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackupSQL = async () => {
    setLoading(true);
    try {
      const tables = ['employees', 'attendance', 'leaves', 'loans', 'payroll_runs', 'payroll_items', 'system_settings'];
      let sqlDump = "";
      for (const t of tables) {
        const rows = await offlineQuery(`SELECT * FROM ${t}`);
        if (rows.length === 0) continue;
        sqlDump += `-- Dumping data for table ${t}\n`;
        for (const row of rows) {
          const keys = Object.keys(row);
          const values = Object.values(row).map(val => {
            if (val === null) return "NULL";
            if (typeof val === 'number') return val;
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          sqlDump += `INSERT OR REPLACE INTO ${t} (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        sqlDump += "\n";
      }

      const blob = new Blob([sqlDump], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `abl_payroll_backup_${Date.now()}.sql`;
      a.click();
      toast.success("SQL Dump backup generated and downloaded successfully");
    } catch (e: any) {
      toast.error("SQL Backup failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackupExcel = async () => {
    setLoading(true);
    try {
      const tables = ['employees', 'attendance', 'leaves', 'loans', 'payroll_runs', 'payroll_items', 'system_settings'];
      const wb = XLSX.utils.book_new();
      for (const t of tables) {
        const rows = await offlineQuery(`SELECT * FROM ${t}`);
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, t);
      }
      XLSX.writeFile(wb, `abl_payroll_backup_${Date.now()}.xlsx`);
      toast.success("Excel backup generated and downloaded successfully");
    } catch (e: any) {
      toast.error("Excel Backup failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      const backupData = JSON.parse(text);
      const tables = ['employees', 'attendance', 'leaves', 'loans', 'payroll_runs', 'payroll_items', 'system_settings'];
      
      for (const t of tables) {
        if (backupData[t]) {
          await offlineExecute(`DELETE FROM ${t}`);
          for (const row of backupData[t]) {
            const keys = Object.keys(row);
            const placeholders = keys.map(() => '?').join(', ');
            const sql = `INSERT INTO ${t} (${keys.join(', ')}) VALUES (${placeholders})`;
            await offlineExecute(sql, Object.values(row));
          }
        }
      }
      toast.success("Database restored successfully from JSON");
    } catch (err: any) {
      toast.error("Restore failed: " + err.message);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleDeleteAll = async () => {
    if (deleteConfirm !== "DELETE ALL") {
      toast.error("Please type DELETE ALL to confirm");
      return;
    }
    setLoading(true);
    try {
      const tables = ['payroll_items', 'payroll_runs', 'loans', 'leaves', 'attendance', 'employees'];
      for (const t of tables) {
        await offlineExecute(`DELETE FROM ${t}`);
      }
      toast.success("All transactional records and employees successfully deleted.");
      setDeleteConfirm("");
    } catch (e: any) {
      toast.error("Clear database failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display text-white">Backup & Restore</h1>
        <p className="text-muted-foreground">Manage database backups, import sql, JSON or excel sheets, and clean workspace</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Export & Backup
            </CardTitle>
            <CardDescription>Export your databases in multiple formats for archiving</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button className="flex-1 gap-2" onClick={handleBackupJSON} disabled={loading}>
                <FileJson className="w-4 h-4" />
                Backup JSON
              </Button>
              <Button className="flex-1 gap-2 text-white bg-emerald-600 hover:bg-emerald-500" onClick={handleBackupExcel} disabled={loading}>
                <Table className="w-4 h-4" />
                Export Excel
              </Button>
              <Button className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-500" onClick={handleBackupSQL} disabled={loading}>
                <Database className="w-4 h-4" />
                Export SQL
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Restore Database
            </CardTitle>
            <CardDescription>Upload a JSON database backup file to restore records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid w-full items-center gap-1.5">
              <Input
                type="file"
                accept=".json"
                onChange={handleRestoreJSON}
                disabled={loading}
                className="cursor-pointer bg-slate-900 border-border"
              />
              <p className="text-xs text-muted-foreground mt-2">Warning: Restoring will overwrite existing data. Please make sure to backup first.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-500/30 bg-rose-500/5 col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-rose-200/60">Destructive options that delete all database records permanently</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="space-y-1">
              <div className="font-semibold text-white">Delete All Records</div>
              <p className="text-xs text-rose-200/50">Permanently clears employees, attendance, leaves, loans, and payroll runs.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Input
                type="text"
                placeholder="Type DELETE ALL"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                className="w-44 bg-slate-900 border-rose-500/30 text-white"
              />
              <Button variant="destructive" onClick={handleDeleteAll} disabled={loading || deleteConfirm !== "DELETE ALL"}>
                <Trash2 className="w-4 h-4 mr-2" />
                Execute
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
