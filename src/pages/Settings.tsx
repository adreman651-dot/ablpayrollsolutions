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
import { Save, UserPlus, Download, Upload, Trash2, AlertTriangle, Info, Volume2, RefreshCw, Wifi, WifiOff, CheckCircle, Play, History, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { syncAllData } from "@/lib/syncEngine";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { Progress } from "@/components/ui/progress";
import { SystemLogsTab } from "@/components/settings/SystemLogsTab";




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
  const {
    isSupported,
    currentVersion,
    currentBuild,
    latestVersionInfo,
    releaseNotes,
    lastChecked,
    checking,
    connectionStatus,
    githubStatus,
    debugLog,
    downloadProgress,
    checkForUpdates,
    checkConnectivity,
    startDownload,
    cancelDownload,
    verifyAndInstall,
    formatSpeed,
    formatTime,
    formatSize,
  } = useAppUpdate();
  const [showDebugLog, setShowDebugLog]     = useState(false);
  const [updateChannel, setUpdateChannel]   = useState<string>("Production");
  const [showNotesDialog, setShowNotesDialog] = useState(false);
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

  // Auto-Sync state
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const autoSyncSetting = settings.find(s => s.key === "auto_sync_enabled");
  const autoSyncEnabled = autoSyncSetting?.value === "true";

  const runSyncNow = async () => {
    if (!isOnline) {
      toast.error("You're offline. Connect to the internet to sync.");
      return;
    }
    setIsSyncing(true);
    try {
      const res = await syncAllData();
      if (res.success) {
        toast.success(res.details || "Sync complete.");
        setLastSyncAt(new Date().toLocaleString());
      } else {
        toast.error(res.details || "Sync failed.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync every 5 minutes when toggle is on and online
  useEffect(() => {
    if (!autoSyncEnabled || !isOnline) return;
    const interval = setInterval(() => { runSyncNow(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncEnabled, isOnline]);

  const fetchData = async () => {
    const [settingsRes, rolesRes] = await Promise.all([
      supabase.from("system_settings").select("*").order("key"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    let currentSettings = settingsRes.data || [];
    const voiceSetting = currentSettings.find(s => s.key === 'enable_voice_announcement');
    
    if (!voiceSetting) {
      try {
        await supabase.from("system_settings").insert([
          { key: 'enable_voice_announcement', value: 'true', description: 'Enable Text-to-Speech automatic voice announcements for Attendance Kiosk' }
        ]);
        const refetch = await supabase.from("system_settings").select("*").order("key");
        if (refetch.data) currentSettings = refetch.data;
      } catch (err) {
        console.error("Auto-init voice setting failed", err);
      }
    }

    setSettings(currentSettings);

    // Auto-init app_version setting
    const appVersionSetting = currentSettings.find(s => s.key === 'app_version');
    if (!appVersionSetting) {
      try {
        await supabase.from("system_settings").insert([
          { key: 'app_version', value: '1.0.0', description: 'Application version. Update this when a new APK is deployed.' }
        ]);
        const refetch2 = await supabase.from("system_settings").select("*").order("key");
        if (refetch2.data) currentSettings = refetch2.data;
      } catch (err) {
        console.error("Auto-init app_version setting failed", err);
      }
    }

    setSettings(currentSettings);

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
        const { data, error } = await supabase.from(table as any).select("*");
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
         await supabase.from(table as any).delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Hack to delete all
      }
      
      // Note: Full restore via client-side inserts is complex due to FKs and IDs. 
      // For this implementation, we will notify the user that full restore should be done via SQL admin, 
      // or we can insert in order if they have IDs.
      const insertTables = ["employees", "attendance", "leave_types", "leaves", "payroll_runs", "payroll_items", "loans", "loan_payments", "system_settings"];
      
      for (const table of insertTables) {
        if (backupData[table] && backupData[table].length > 0) {
           // UPSERT to handle existing
           const { error } = await supabase.from(table as any).upsert(backupData[table]);
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
         const { error } = await supabase.from(table as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
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
          <TabsTrigger value="sync">Sync</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="updates">Application Updates</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
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
                ) : settings
                    .filter(s => !['philhealth_rate', 'pagibig_employee', 'pagibig_employer', 'sss_employer_rate', 'sss_employer_share', 'sss_employee_rate', 'phic_rate', 'hdmf_employee', 'hdmf_employer', 'enable_voice_announcement', 'auto_sync_enabled'].includes(s.key))
                    .map(s => (
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
              <h3 className="font-display font-semibold">Attendance Voice Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">Configure automatic text-to-speech announcements and custom MP3 uploads for the Attendance Kiosk.</p>
            </div>
            <div className="p-6 space-y-6">
              {/* Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "voice_enabled", label: "Enable Voice Assistant", desc: "Global toggle to enable voice output" },
                  { key: "voice_welcome_enabled", label: "Enable Welcome Message", desc: "Greet employee during ID validation lookup" },
                  { key: "voice_time_in_enabled", label: "Enable Time In Confirmation", desc: "Voice confirmation of successfully timing in" },
                  { key: "voice_time_out_enabled", label: "Enable Time Out Confirmation", desc: "Voice confirmation of successfully timing out" },
                  { key: "voice_error_enabled", label: "Enable Error Announcements", desc: "Announce 'Employee record not found' and other errors" },
                ].map((item) => {
                  const setting = settings.find(s => s.key === item.key);
                  return (
                    <div key={item.key} className="flex items-center justify-between border rounded-xl p-4 bg-muted/10">
                      <div>
                        <h4 className="font-semibold text-sm">{item.label}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                      <Switch 
                        checked={setting?.value === 'true'}
                        onCheckedChange={async (checked) => {
                          if (setting) {
                            setSettings(prev => prev.map(p => p.id === setting.id ? { ...p, value: checked.toString() } : p));
                            updateSetting(setting.id, checked.toString());
                          } else {
                            try {
                              await supabase.from("system_settings").insert([
                                { key: item.key, value: checked.toString(), description: item.label }
                              ]);
                              fetchData();
                            } catch (err) {
                              console.error("Failed to create voice setting", err);
                            }
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Sliders / Pitch & Rate & Volume */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                {[
                  { key: "voice_rate", label: "Voice Rate (Speed)", min: 0.5, max: 2.0, step: 0.1 },
                  { key: "voice_pitch", label: "Voice Pitch", min: 0.5, max: 2.0, step: 0.1 },
                  { key: "voice_volume", label: "Volume (0 - 100)", min: 0, max: 100, step: 5 }
                ].map((item) => {
                  const setting = settings.find(s => s.key === item.key);
                  return (
                    <div key={item.key} className="space-y-2">
                      <Label className="text-sm font-semibold">{item.label}: {setting?.value || item.min}</Label>
                      <input 
                        type="range"
                        min={item.min}
                        max={item.max}
                        step={item.step}
                        value={parseFloat(setting?.value || "1.0")}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSettings(prev => prev.map(p => p.key === item.key ? { ...p, value: val } : p));
                        }}
                        onMouseUp={async (e) => {
                          const val = (e.target as HTMLInputElement).value;
                          const targetSetting = settings.find(s => s.key === item.key);
                          if (targetSetting) {
                            updateSetting(targetSetting.id, val);
                          } else {
                            await supabase.from("system_settings").insert([{ key: item.key, value: val, description: item.label }]);
                            fetchData();
                          }
                        }}
                        className="w-full accent-primary bg-muted h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>

              {/* MP3 Uploads Section */}
              <div className="pt-6 border-t space-y-4">
                <h4 className="font-semibold text-base">Custom MP3 Audio Announcements</h4>
                <p className="text-xs text-muted-foreground">Upload custom audio files that play instead of the Text-to-Speech voices when triggered.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { fileName: "welcome.mp3", label: "Welcome / Greeting Sound" },
                    { fileName: "timed_in.mp3", label: "Time In Confirmation" },
                    { fileName: "timed_out.mp3", label: "Time Out Confirmation" },
                    { fileName: "employee_not_found.mp3", label: "Employee Not Found Error" },
                  ].map((mp3) => (
                    <div key={mp3.fileName} className="flex items-center justify-between border rounded-xl p-4 bg-muted/10">
                      <div>
                        <h5 className="text-sm font-medium">{mp3.label}</h5>
                        <code className="text-xs text-muted-foreground">{mp3.fileName}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="file" 
                          accept="audio/mpeg" 
                          id={`upload-${mp3.fileName}`} 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const { error } = await supabase.storage.from("voice-assets").upload(mp3.fileName, file, {
                                upsert: true,
                                contentType: "audio/mpeg"
                              });
                              if (error) throw error;
                              toast.success(`Uploaded ${mp3.fileName} successfully!`);
                            } catch (err: any) {
                              toast.error(`Upload failed: ${err.message}`);
                            }
                          }}
                        />
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => document.getElementById(`upload-${mp3.fileName}`)?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" /> Upload
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl flex items-start gap-3 border border-blue-100 dark:border-blue-900/50">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm leading-relaxed">
                  <strong>ℹ️ Voice Assistant Priority:</strong> The system automatically tries to find and play custom uploaded MP3 files from the `voice-assets` bucket first. If none are found, it falls back to the native Text-to-Speech system tuned to your preferred rate, pitch, and voice guidelines.
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── Maintenance ───────────────────────────────────────────── */}
        {/* ─── Sync ─────────────────────────────────────────────────── */}
        <TabsContent value="sync" className="mt-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold">Cloud Sync</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Automatically synchronize all admin module data with the cloud whenever an internet connection is detected.
                </p>
              </div>
              <div className={`flex items-center gap-2 text-sm font-medium ${isOnline ? "text-emerald-500" : "text-rose-500"}`}>
                {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                {isOnline ? "Online" : "Offline"}
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between border rounded-xl p-4 bg-muted/10">
                <div>
                  <h4 className="font-semibold text-sm">Enable Auto-Sync</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    When ON and the device is online, all admin data (employees, attendance, payroll, leaves, loans, settings) is synced every 5 minutes.
                  </p>
                </div>
                <Switch
                  checked={autoSyncEnabled}
                  onCheckedChange={async (checked) => {
                    const existing = settings.find(s => s.key === "auto_sync_enabled");
                    if (existing) {
                      setSettings(prev => prev.map(p => p.id === existing.id ? { ...p, value: checked.toString() } : p));
                      updateSetting(existing.id, checked.toString());
                    } else {
                      await supabase.from("system_settings").insert([{
                        key: "auto_sync_enabled",
                        value: checked.toString(),
                        description: "Auto-sync admin data with cloud when online"
                      }]);
                      fetchData();
                    }
                    if (checked && isOnline) runSyncNow();
                  }}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border rounded-xl p-4 bg-muted/10">
                <div>
                  <h4 className="font-semibold text-sm">Manual Sync</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lastSyncAt ? `Last sync: ${lastSyncAt}` : "No sync run in this session yet."}
                  </p>
                </div>
                <Button onClick={runSyncNow} disabled={isSyncing || !isOnline} className="gap-2">
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? "Syncing..." : "Sync Now"}
                </Button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl flex items-start gap-3 border border-blue-100 dark:border-blue-900/50">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed">
                  Auto-sync is optional. Toggle it OFF to sync only when you press <strong>Sync Now</strong>. Sync is automatically skipped when the device is offline.
                </p>
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

        {/* ─── Application Updates ───────────────────────────────────── */}
        <TabsContent value="updates" className="mt-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold">Application Updates</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage OTA (Over-The-Air) self-updates for the Android application.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isSupported 
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                }`}>
                  {isSupported ? "Android Native Supported" : "Simulated/Web Mode"}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-6">

              {/* ── Connection Status Banner ─────────────────────────── */}
              <div className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium border ${
                connectionStatus === "online"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300"
                  : connectionStatus === "offline"
                  ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-800 dark:text-red-300"
                  : "bg-muted/40 border-border text-muted-foreground"
              }`}>
                <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  connectionStatus === "online" ? "bg-emerald-500"
                  : connectionStatus === "offline" ? "bg-red-500"
                  : "bg-muted-foreground"
                }`} />
                <span className="flex-1">
                  {connectionStatus === "online"
                    ? "Internet Connected"
                    : connectionStatus === "offline"
                    ? "No Internet — connect to WiFi or mobile data"
                    : "Connection status unknown"}
                  <span className="ml-3 text-xs opacity-70">GitHub: {githubStatus}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => checkConnectivity()}
                >
                  <RefreshCw className="w-3 h-3" /> Test
                </Button>
              </div>

              {/* Version details grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 border rounded-xl bg-muted/10">
                  <span className="text-xs text-muted-foreground block font-medium">Current Version</span>
                  <span className="text-lg font-bold font-mono block mt-1">{currentVersion}</span>
                </div>
                <div className="p-4 border rounded-xl bg-muted/10">
                  <span className="text-xs text-muted-foreground block font-medium">Latest Version</span>
                  <span className="text-lg font-bold font-mono block mt-1 text-primary">
                    {latestVersionInfo?.versionName || "Not Checked"}
                  </span>
                </div>
                <div className="p-4 border rounded-xl bg-muted/10">
                  <span className="text-xs text-muted-foreground block font-medium">Build Number</span>
                  <span className="text-lg font-bold font-mono block mt-1">
                    {currentBuild} / {latestVersionInfo?.versionCode || "—"}
                  </span>
                </div>
                <div className="p-4 border rounded-xl bg-muted/10">
                  <span className="text-xs text-muted-foreground block font-medium">Release Date</span>
                  <span className="text-lg font-bold block mt-1 text-muted-foreground">
                    {latestVersionInfo?.releaseDate || "—"}
                  </span>
                </div>
              </div>

              {/* Extra details grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-6">
                <div className="flex flex-col gap-1">
                  <Label className="text-sm font-semibold">Update Channel</Label>
                  <Select value={updateChannel} onValueChange={setUpdateChannel}>
                    <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Production">Production (Recommended)</SelectItem>
                      <SelectItem value="Beta">Beta (Testing)</SelectItem>
                      <SelectItem value="Staging">Staging (Development)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1 justify-center">
                  <span className="text-xs text-muted-foreground block font-medium font-semibold">APK Size</span>
                  <span className="text-sm font-semibold block font-mono mt-1 text-foreground">
                    {latestVersionInfo?.apkSize || (downloadProgress.totalBytes ? formatSize(downloadProgress.totalBytes) : "8.5 MB")}
                  </span>
                </div>
                <div className="flex flex-col gap-1 justify-center">
                  <span className="text-xs text-muted-foreground block font-medium font-semibold">Last Checked</span>
                  <span className="text-sm font-semibold block mt-1 text-muted-foreground">
                    {lastChecked || "Never"}
                  </span>
                </div>
              </div>

              {/* Download Progress Bar Section */}
              {downloadProgress.status === "downloading" && (
                <div className="border border-primary/20 rounded-xl p-5 bg-primary/5 space-y-4">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="flex items-center gap-2 text-primary animate-pulse">
                      <Download className="w-4 h-4" /> Downloading Update...
                    </span>
                    <span>{Math.round(downloadProgress.progress * 100)}%</span>
                  </div>
                  <Progress value={downloadProgress.progress * 100} className="h-2" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-muted-foreground font-mono">
                    <div>Downloaded: {formatSize(downloadProgress.bytesDownloaded)} / {formatSize(downloadProgress.totalBytes)}</div>
                    <div>Speed: {formatSpeed(downloadProgress.speed)}</div>
                    <div>Remaining: {formatTime(downloadProgress.timeRemaining)}</div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button size="sm" variant="outline" onClick={cancelDownload} className="text-destructive border-destructive hover:bg-destructive/10">
                      Cancel Download
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Buttons Section */}
              <div className="flex flex-wrap gap-3 border-t pt-6">
                <Button onClick={() => checkForUpdates(false)} disabled={checking} className="gap-2">
                  <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
                  {checking ? "Checking…" : "Check for Updates"}
                </Button>

                <Button 
                  onClick={startDownload} 
                  disabled={!latestVersionInfo || downloadProgress.status === "downloading"} 
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Play className="w-4 h-4" />
                  Update Now
                </Button>

                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (releaseNotes) {
                      setShowNotesDialog(true);
                    } else if (latestVersionInfo) {
                      toast.promise(checkForUpdates(true), {
                        loading: "Loading release notes...",
                        success: () => {
                          setShowNotesDialog(true);
                          return "Release notes loaded!";
                        },
                        error: "Failed to load release notes."
                      });
                    } else {
                      toast.info("Please check for updates first.");
                    }
                  }}
                  className="gap-2"
                >
                  <History className="w-4 h-4" />
                  View Release Notes
                </Button>

                <Button 
                  variant="outline" 
                  onClick={async () => {
                    if (!latestVersionInfo) {
                      toast.info("Checking for updates first...");
                      const res = await checkForUpdates(true);
                      if (!res) return;
                    }
                    toast.info("Downloading APK to device storage...");
                    startDownload();
                  }}
                  disabled={downloadProgress.status === "downloading"}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download APK
                </Button>

                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (downloadProgress.filePath) {
                      verifyAndInstall(downloadProgress.filePath);
                    } else {
                      toast.error("No downloaded APK found. Please download the update first.");
                    }
                  }}
                  className="gap-2 border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Install APK
                </Button>

                <Button 
                  variant="ghost" 
                  onClick={() => {
                    toast.info(`Build Number Check:\nInstalled Build: ${currentBuild}\nLatest Released Build: ${latestVersionInfo?.versionCode || "Not checked"}`, {
                      duration: 5000
                    });
                  }}
                  className="gap-2 text-muted-foreground"
                >
                  <Info className="w-4 h-4" />
                  Check Build Number
                </Button>
              </div>

              {/* ── Debug Log ────────────────────────────────────────── */}
              <div className="border rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold bg-muted/30 hover:bg-muted/50 transition-colors"
                  onClick={() => setShowDebugLog(v => !v)}
                >
                  <span className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    Network Debug Log
                    <span className="text-xs text-muted-foreground font-normal">({debugLog.length} entries)</span>
                  </span>
                  <span className="text-muted-foreground text-xs">{showDebugLog ? "▲ Hide" : "▼ Show"}</span>
                </button>
                {showDebugLog && (
                  <div className="bg-black/90 text-green-400 font-mono text-xs p-4 max-h-64 overflow-y-auto space-y-0.5">
                    {debugLog.length === 0 ? (
                      <p className="text-muted-foreground italic">No log entries yet. Tap "Check for Updates" to begin.</p>
                    ) : (
                      debugLog.map((line, i) => (
                        <div key={i} className={`leading-relaxed ${
                          line.includes("✗") || line.includes("FAIL") || line.includes("error")
                            ? "text-red-400"
                            : line.includes("✓")
                            ? "text-green-400"
                            : line.includes("⚠")
                            ? "text-yellow-400"
                            : "text-green-300"
                        }`}>{line}</div>
                      ))
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Release Notes Dialog */}
          <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display">
                  <History className="w-5 h-5 text-primary" />
                  Release Notes — Version {latestVersionInfo?.versionName}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex justify-between items-center text-xs text-muted-foreground border-b pb-2">
                  <span>Released: {latestVersionInfo?.releaseDate}</span>
                  <span>Build Number: {latestVersionInfo?.versionCode}</span>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">What's New in this Version:</h4>
                  {releaseNotes && releaseNotes.changes && releaseNotes.changes.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                      {releaseNotes.changes.map((change, i) => (
                        <li key={i}>{change}</li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                      <li>Payroll improvements</li>
                      <li>Attendance improvements</li>
                      <li>Bug fixes</li>
                      <li>Performance optimization</li>
                    </ul>
                  )}
                </div>
                <div className="flex justify-end pt-4 gap-2 border-t">
                  <Button variant="outline" onClick={() => setShowNotesDialog(false)}>Close</Button>
                  <Button onClick={() => {
                    setShowNotesDialog(false);
                    startDownload();
                  }} className="bg-emerald-600 hover:bg-emerald-700 text-white">Update Now</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ─── System Logs ───────────────────────────────────────────── */}
        <TabsContent value="logs" className="mt-0">
          <SystemLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
