import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, FileSpreadsheet, Trash2 } from 'lucide-react';
import { offlineQuery, offlineExecute } from '@/lib/offlineDb';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = "SELECT * FROM audit_logs ORDER BY id DESC";
      let params: any[] = [];
      if (search) {
        query = "SELECT * FROM audit_logs WHERE action LIKE ? OR table_name LIKE ? OR details LIKE ? ORDER BY id DESC";
        params = [`%${search}%`, `%${search}%`, `%${search}%`];
      }
      const data = await offlineQuery(query, params);
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search]);

  const handleExportExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(logs);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "AuditLogs");
      XLSX.writeFile(wb, `abl_audit_logs_${Date.now()}.xlsx`);
      toast.success("Audit logs exported to Excel.");
    } catch (e: any) {
      toast.error("Export failed: " + e.message);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear all audit logs?")) return;
    try {
      await offlineExecute("DELETE FROM audit_logs");
      toast.success("Audit logs cleared.");
      fetchLogs();
    } catch (e: any) {
      toast.error("Clear failed: " + e.message);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-display">Audit Logs</h1>
          <p className="text-muted-foreground">Monitor administrative actions, updates, record modifications, and conflict outcomes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel} className="gap-2 border-border text-white hover:bg-white/5">
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </Button>
          <Button variant="destructive" onClick={handleClearLogs} className="gap-2">
            <Trash2 className="w-4 h-4" />
            Clear Logs
          </Button>
        </div>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>System Audit Trail</CardTitle>
              <CardDescription>Comprehensive ledger recording security events and updates</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search actions or tables..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-slate-900 border-border text-white"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User / Target</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target Table</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading audit ledger...</TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No audit entries found.</TableCell>
                </TableRow>
              ) : (
                logs.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs font-mono">{l.created_at || 'N/A'}</TableCell>
                    <TableCell className="text-xs font-mono">{l.user_email || 'System'}</TableCell>
                    <TableCell>
                      <span className="capitalize text-xs font-semibold px-2 py-0.5 rounded bg-muted text-white">
                        {l.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{l.table_name || 'N/A'}</TableCell>
                    <TableCell className="text-xs max-w-sm truncate">{l.details || 'N/A'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
