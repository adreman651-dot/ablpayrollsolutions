import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface ImportRow {
  code: string;
  name: string;
  department: string;
  position: string;
  salary: number;
  status: string;
}

interface Props {
  onImportComplete: () => void;
}

export default function EmployeeImportDialog({ onImportComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

        if (json.length === 0) {
          setErrors(["The file is empty or has no data rows."]);
          return;
        }

        const parseErrors: string[] = [];
        const parsed: ImportRow[] = json.map((row, i) => {
          const code = String(row["Code"] || row["code"] || "").trim();
          const name = String(row["Name"] || row["name"] || "").trim();
          const department = String(row["Department"] || row["department"] || "").trim();
          const position = String(row["Position"] || row["position"] || "").trim();
          const salaryRaw = row["Salary"] || row["salary"] || 0;
          const salary = typeof salaryRaw === "number" ? salaryRaw : parseFloat(String(salaryRaw).replace(/[^0-9.]/g, "")) || 0;
          const status = String(row["Status"] || row["status"] || "active").trim().toLowerCase();

          if (!name) parseErrors.push(`Row ${i + 2}: Name is required.`);
          if (salary <= 0) parseErrors.push(`Row ${i + 2}: Invalid salary.`);

          return { code, name, department, position, salary, status };
        });

        setErrors(parseErrors);
        setRows(parsed);
      } catch {
        setErrors(["Failed to parse the file. Please check the format."]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRows([]);
      setErrors([]);
      parseFile(file);
    }
  };

  const handleImport = async () => {
    if (errors.length > 0) {
      toast.error("Fix errors before importing.");
      return;
    }

    setImporting(true);
    let successCount = 0;
    const importErrors: string[] = [];

    for (const row of rows) {
      const nameParts = row.name.split(/\s+/);
      const first_name = nameParts[0] || "";
      const last_name = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
      const middle_name = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : null;

      const { error } = await supabase.from("employees").insert({
        employee_code: row.code || "",
        first_name,
        last_name,
        middle_name,
        department: row.department || null,
        job_title: row.position || null,
        basic_salary: row.salary,
        employment_status: ["active", "inactive", "probationary", "resigned", "terminated"].includes(row.status)
          ? row.status
          : "active",
      });

      if (error) {
        importErrors.push(`${row.name}: ${error.message}`);
      } else {
        successCount++;
      }
    }

    setImporting(false);

    if (importErrors.length > 0) {
      toast.error(`${importErrors.length} failed. ${successCount} imported.`);
      setErrors(importErrors);
    } else {
      toast.success(`${successCount} employees imported successfully!`);
      setOpen(false);
      setRows([]);
      onImportComplete();
    }
  };

  const reset = () => {
    setRows([]);
    setErrors([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="w-4 h-4 mr-2" />Import Excel</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Employees from Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/50">
            <FileSpreadsheet className="w-8 h-8 text-primary shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Excel file format required:</p>
              <p className="text-muted-foreground">Headers: <code className="bg-muted px-1 rounded">Code</code>, <code className="bg-muted px-1 rounded">Name</code>, <code className="bg-muted px-1 rounded">Department</code>, <code className="bg-muted px-1 rounded">Position</code>, <code className="bg-muted px-1 rounded">Salary</code>, <code className="bg-muted px-1 rounded">Status</code></p>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />

          {errors.length > 0 && (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-sm space-y-1">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <AlertCircle className="w-4 h-4" /> Errors found:
              </div>
              {errors.slice(0, 10).map((err, i) => (
                <p key={i} className="text-destructive/80 ml-6">{err}</p>
              ))}
              {errors.length > 10 && <p className="text-destructive/80 ml-6">...and {errors.length - 10} more</p>}
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                {rows.length} rows ready to import
              </div>
              <div className="border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Salary</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 20).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{r.code || "—"}</TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.department || "—"}</TableCell>
                        <TableCell>{r.position || "—"}</TableCell>
                        <TableCell>₱{r.salary.toLocaleString()}</TableCell>
                        <TableCell>{r.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.length > 20 && <p className="text-xs text-muted-foreground">Showing 20 of {rows.length} rows</p>}
            </>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
            <Button onClick={handleImport} disabled={rows.length === 0 || errors.length > 0 || importing}>
              {importing ? "Importing..." : `Import ${rows.length} Employees`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
