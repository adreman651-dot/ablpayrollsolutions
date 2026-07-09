import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, FileSpreadsheet, Trash2, FileDown } from 'lucide-react';
import { offlineQuery, offlineExecute } from '@/lib/offlineDb';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [overrides, setOverrides] = useState<any[]>([]);
  const [overrideSearch, setOverrideSearch] = useState("");
  const [overridesLoading, setOverridesLoading] = useState(true);

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

  const fetchOverrides = async () => {
    setOverridesLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance_overrides')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setOverrides(data || []);
    } catch (e) {
      console.warn('Overrides fetch failed', e);
    } finally {
      setOverridesLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [search]);
  useEffect(() => { fetchOverrides(); }, []);

  const filteredOverrides = overrides.filter(o => {
    if (!overrideSearch) return true;
    const s = overrideSearch.toLowerCase();
    return (o.employee_name || '').toLowerCase().includes(s)
      || (o.reason || '').toLowerCase().includes(s)
      || (o.modified_by_email || '').toLowerCase().includes(s);
  });

  const exportOverridesExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(filteredOverrides);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "AttendanceOverrides");
      XLSX.writeFile(wb, `abl_attendance_overrides_${Date.now()}.xlsx`);
      toast.success("Attendance overrides exported.");
    } catch (e: any) { toast.error("Export failed: " + e.message); }
  };

  const exportOverridesPdf = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.text('Attendance Override History', 14, 14);
      autoTable(doc, {
        startY: 20,
        head: [['Date', 'Employee', 'Old Time In', 'New Time In', 'Old Time Out', 'New Time Out', 'Reason', 'By', 'Platform']],
        body: filteredOverrides.map(o => [
          new Date(o.created_at).toLocaleString(),
          o.employee_name || '',
          o.original_time_in ? new Date(o.original_time_in).toLocaleString() : '',
          o.new_time_in ? new Date(o.new_time_in).toLocaleString() : '',
          o.original_time_out ? new Date(o.original_time_out).toLocaleString() : '',
          o.new_time_out ? new Date(o.new_time_out).toLocaleString() : '',
          o.reason || '',
          o.modified_by_email || '',
          o.platform || '',
        ]),
        styles: { fontSize: 7 },
      });
      doc.save(`abl_attendance_overrides_${Date.now()}.pdf`);
      toast.success("Attendance overrides PDF exported.");
    } catch (e: any) { toast.error("Export failed: " + e.message); }
  };


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

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Attendance Override History</CardTitle>
              <CardDescription>Every override made by Administrator or HR, with full before/after values</CardDescription>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search employee, reason, user..."
                  value={overrideSearch}
                  onChange={e => setOverrideSearch(e.target.value)}
                  className="pl-9 bg-slate-900 border-border text-white"
                />
              </div>
              <Button variant="outline" size="sm" onClick={exportOverridesExcel} className="gap-2"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
              <Button variant="outline" size="sm" onClick={exportOverridesPdf} className="gap-2"><FileDown className="w-4 h-4" /> PDF</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Time In (old → new)</TableHead>
                  <TableHead>Time Out (old → new)</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Platform</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overridesLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading overrides...</TableCell></TableRow>
                ) : filteredOverrides.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No overrides found.</TableCell></TableRow>
                ) : (
                  filteredOverrides.map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="text-xs font-mono">{new Date(o.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{o.employee_name}</TableCell>
                      <TableCell className="text-xs">
                        {o.original_time_in ? new Date(o.original_time_in).toLocaleTimeString() : '—'}
                        {' → '}
                        {o.new_time_in ? new Date(o.new_time_in).toLocaleTimeString() : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {o.original_time_out ? new Date(o.original_time_out).toLocaleTimeString() : '—'}
                        {' → '}
                        {o.new_time_out ? new Date(o.new_time_out).toLocaleTimeString() : '—'}
                      </TableCell>
                      <TableCell className="text-xs max-w-xs truncate" title={o.reason}>{o.reason}</TableCell>
                      <TableCell className="text-xs font-mono">{o.modified_by_email} <span className="opacity-60">({o.modified_by_role})</span></TableCell>
                      <TableCell className="text-xs">{o.platform}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>

  );
}
