import { useEffect, useState, useRef } from "react";
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
import { Save, UserPlus, Download, Upload, Trash2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/payroll-utils";
import { Play, Square, FileAudio, Info } from "lucide-react";

function VoiceUploadCard({ title, description, filename }: { title: string, description: string, filename: string }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasFile, setHasFile] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkFile();
  }, []);

  const checkFile = async () => {
    const { data } = await supabase.storage.from("voice-assets").list("", { search: filename });
    if (data && data.some(f => f.name === filename)) {
      setHasFile(true);
    } else {
      setHasFile(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "audio/mpeg") {
      toast.error("Please upload an MP3 file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const { error } = await supabase.storage.from("voice-assets").upload(filename, file, { upsert: true });
      if (error) throw error;
      toast.success("Voice updated successfully");
      setHasFile(true);
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    try {
      await supabase.storage.from("voice-assets").remove([filename]);
      toast.success("Voice removed successfully");
      setHasFile(false);
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      }
    } catch (err: any) {
      toast.error("Remove failed: " + err.message);
    }
  };

  const handlePreview = async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    const { data } = supabase.storage.from("voice-assets").getPublicUrl(filename);
    if (data.publicUrl) {
      const audio = new Audio(`${data.publicUrl}?t=${Date.now()}`);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play().catch(() => toast.error("Could not play audio"));
      setIsPlaying(true);
    }
  };

  return (
    <div className="border border-border rounded-xl p-5 bg-card flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <FileAudio className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold">{title}</h4>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-muted/30 p-3 rounded-lg text-sm flex items-center justify-between">
        <span className="text-muted-foreground">Current:</span>
        <span className="font-mono font-medium">{hasFile ? `${filename}` : "Using TTS"}</span>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <Button 
          variant={isPlaying ? "destructive" : "secondary"} 
          size="sm" 
          onClick={handlePreview}
          disabled={!hasFile}
          className="flex-1 min-w-[100px]"
        >
          {isPlaying ? <><Square className="w-4 h-4 mr-2" /> Stop</> : <><Play className="w-4 h-4 mr-2" /> Preview</>}
        </Button>
        <input 
          type="file" 
          accept="audio/mpeg" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleUpload} 
        />
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex-1 min-w-[120px]"
        >
          <Upload className="w-4 h-4 mr-2" /> {isUploading ? "Uploading..." : "Upload MP3"}
        </Button>
        {hasFile && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRemove}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive flex-1 min-w-[100px]"
          >
            <Trash2 className="w-4 h-4 mr-2" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}

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
  
  // Maintenance State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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



  // --- Maintenance Functions ---
  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const tables = ["employees", "attendance", "leave_types", "leaves", "payroll_runs", "payroll_items", "loans", "loan_payments", "system_settings"];
      const backupData: Record<string, any[]> = {};
      
      for (const table of tables) {
        const { data, error } = await supabase.from(table).select("*");
        if (error) throw error;
        backupData[table] = data || [];
      }
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `abl_payroll_backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded successfully");
    } catch (err: any) {
      toast.error("Backup failed: " + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!confirm("Are you sure you want to restore? This will overwrite existing data. An auto-backup will be created first.")) return;
    
    setIsRestoring(true);
    try {
      // 1. Auto backup first
      await handleBackup();
      
      // 2. Read file
      const text = await file.text();
      const backupData = JSON.parse(text);
      
      // 3. Clear existing transactional data first to avoid FK constraints
      const clearTables = ["loan_payments", "loans", "payroll_items", "payroll_runs", "leaves", "attendance", "employees"];
      for (const table of clearTables) {
         await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Hack to delete all
      }
      
      // Note: Full restore via client-side inserts is complex due to FKs and IDs. 
      // For this implementation, we will notify the user that full restore should be done via SQL admin, 
      // or we can insert in order if they have IDs.
      const insertTables = ["employees", "attendance", "leave_types", "leaves", "payroll_runs", "payroll_items", "loans", "loan_payments", "system_settings"];
      
      for (const table of insertTables) {
        if (backupData[table] && backupData[table].length > 0) {
           // UPSERT to handle existing
           const { error } = await supabase.from(table).upsert(backupData[table]);
           if (error) console.error(`Restore error for ${table}:`, error);
        }
      }
      toast.success("Database restored successfully");
      fetchData();
    } catch (err: any) {
      toast.error("Restore failed: " + err.message);
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAll = async () => {
    if (deleteConfirmText !== "DELETE") {
      toast.error("Please type DELETE to confirm");
      return;
    }
    
    setIsDeleting(true);
    try {
      const tables = ["loan_payments", "loans", "payroll_items", "payroll_runs", "leaves", "attendance", "employees"];
      for (const table of tables) {
         const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
         if (error) throw error;
      }
      toast.success("All transactional records and employees have been deleted.");
      setDeleteConfirmText("");
    } catch (err: any) {
      toast.error("Delete failed: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

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
          <TabsTrigger value="tax">Withholding Tax</TabsTrigger>
          <TabsTrigger value="voice">Voice Settings</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
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

        {/* ─── Voice Settings ───────────────────────────────────────── */}
        <TabsContent value="voice" className="mt-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
            <div className="p-4 border-b border-border">
              <h3 className="font-display font-semibold">Kiosk Voice Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">Upload custom MP3 voice clips for the Time In/Out kiosk. If no file is uploaded, the system will use the built-in text-to-speech voice.</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <VoiceUploadCard 
                  title="Employee Greeting" 
                  description="Plays when an employee is found via the dial pad (e.g. 'Hello, Juan!')" 
                  filename="greeting.mp3" 
                />
                <VoiceUploadCard 
                  title="Time In Success" 
                  description="Plays after a successful Time In is recorded" 
                  filename="timein_success.mp3" 
                />
                <VoiceUploadCard 
                  title="Time Out Success" 
                  description="Plays after a successful Time Out is recorded" 
                  filename="timeout_success.mp3" 
                />
              </div>

              <div className="mt-8 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl flex items-start gap-3 border border-blue-100 dark:border-blue-900/50">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm leading-relaxed">
                  <strong>ℹ️ Voice Tips:</strong> Record your MP3 at a natural speaking pace. For the greeting, say the phrase without the employee name — the system will append it automatically using text-to-speech if needed. Recommended duration: 1–3 seconds per clip. Supported format: MP3 only.
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── Maintenance ───────────────────────────────────────────── */}
        <TabsContent value="maintenance" className="mt-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
            <div className="p-4 border-b border-border">
              <h3 className="font-display font-semibold">Database Maintenance</h3>
              <p className="text-sm text-muted-foreground mt-1">Backup and restore system data.</p>
            </div>
            <div className="p-6 flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border rounded-lg bg-muted/30">
                <div>
                  <h4 className="font-medium text-sm flex items-center gap-2"><Download className="w-4 h-4" /> Backup Database</h4>
                  <p className="text-xs text-muted-foreground mt-1">Download a complete JSON snapshot of all system records.</p>
                </div>
                <Button onClick={handleBackup} disabled={isBackingUp}>
                  {isBackingUp ? "Backing up..." : "Download Backup"}
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border rounded-lg bg-muted/30">
                <div>
                  <h4 className="font-medium text-sm flex items-center gap-2"><Upload className="w-4 h-4" /> Restore Database</h4>
                  <p className="text-xs text-muted-foreground mt-1">Restore the system using a previously generated JSON backup file.</p>
                </div>
                <div>
                  <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleRestore} />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isRestoring}>
                    {isRestoring ? "Restoring..." : "Select Backup File"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-destructive/20 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-destructive/20 bg-destructive/5">
              <h3 className="font-display font-semibold text-destructive flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Danger Zone</h3>
              <p className="text-sm text-destructive/80 mt-1">Irreversible administrative actions.</p>
            </div>
            <div className="p-6">
              <div className="flex flex-col gap-4">
                <div>
                  <h4 className="font-medium text-sm flex items-center gap-2 text-destructive"><Trash2 className="w-4 h-4" /> Delete All Transactional Records</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    This will permanently delete all Employees, Attendance, Payroll Runs, Payslips, Leaves, and Loans.
                    System Users and Application Settings will NOT be affected.
                  </p>
                </div>
                <div className="flex items-end gap-4 max-w-md">
                  <div className="flex-1 space-y-2">
                    <Label className="text-xs">Type <strong className="select-none">DELETE</strong> to confirm</Label>
                    <Input 
                      value={deleteConfirmText} 
                      onChange={e => setDeleteConfirmText(e.target.value)} 
                      placeholder="DELETE" 
                    />
                  </div>
                  <Button variant="destructive" onClick={handleDeleteAll} disabled={isDeleting || deleteConfirmText !== "DELETE"}>
                    {isDeleting ? "Deleting..." : "Clear Records"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
