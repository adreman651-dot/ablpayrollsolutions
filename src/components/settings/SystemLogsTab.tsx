import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineQuery, offlineExecute } from "@/lib/offlineDb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Trash2, Search, RefreshCw, AlertTriangle, AlertCircle, Info } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

export function SystemLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      if (navigator.onLine) {
        const { data, error } = await supabase.from('system_logs').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setLogs(data || []);
      } else {
        const localLogs = await offlineQuery('SELECT * FROM system_logs ORDER BY created_at DESC');
        setLogs(localLogs);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load system logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleDeleteAll = async () => {
    if (!confirm("Are you sure you want to delete all system logs?")) return;
    try {
      if (navigator.onLine) {
        await supabase.from('system_logs').delete().neq('id', '0');
      }
      await offlineExecute('DELETE FROM system_logs');
      toast.success("All logs deleted");
      fetchLogs();
    } catch (err: any) {
      toast.error("Failed to delete logs");
    }
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredLogs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SystemLogs");
    XLSX.writeFile(wb, `SystemLogs_${new Date().toISOString()}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    const tableData = filteredLogs.map(l => [
      new Date(l.created_at).toLocaleString(),
      l.module,
      l.severity,
      l.error_message,
      l.device,
      l.internet_status
    ]);
    (doc as any).autoTable({
      head: [['Date', 'Module', 'Severity', 'Error', 'Device', 'Net']],
      body: tableData,
    });
    doc.save(`SystemLogs_${new Date().toISOString()}.pdf`);
  };

  const filteredLogs = logs.filter(log => {
    const matchSearch = (log.error_message || "").toLowerCase().includes(search.toLowerCase()) || 
                        (log.function_name || "").toLowerCase().includes(search.toLowerCase());
    const matchModule = moduleFilter === "all" || log.module === moduleFilter;
    const matchSeverity = severityFilter === "all" || log.severity === severityFilter;
    return matchSearch && matchModule && matchSeverity;
  });

  const uniqueModules = Array.from(new Set(logs.map(l => l.module).filter(Boolean)));

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
      <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="font-display font-semibold">System Logs</h3>
          <p className="text-sm text-muted-foreground mt-1">Monitor errors, crashes, and system events globally.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDeleteAll}>
            <Trash2 className="w-4 h-4 mr-2" /> Clear Logs
          </Button>
        </div>
      </div>

      <div className="p-4 flex gap-4 flex-wrap bg-muted/20 border-b border-border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search error message..." 
            className="pl-8" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <div className="w-[180px]">
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger><SelectValue placeholder="Module" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {uniqueModules.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[180px]">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Context</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No logs found
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      log.severity === 'critical' ? 'bg-red-100 text-red-800' : 
                      log.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                      log.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {log.severity?.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{log.module}</TableCell>
                  <TableCell>
                    <div className="text-sm font-semibold text-red-600 dark:text-red-400">{log.error_message}</div>
                    <div className="text-xs text-muted-foreground mt-1 max-w-[300px] truncate" title={log.stack_trace}>
                      {log.function_name} {log.stack_trace && `- ${log.stack_trace}`}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground flex flex-col gap-0.5">
                      <span><strong>Dev:</strong> {log.device} ({log.os_version})</span>
                      <span><strong>Net:</strong> {log.internet_status}</span>
                      <span><strong>Emp:</strong> {log.employee_id?.slice(0,8) || 'N/A'}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
