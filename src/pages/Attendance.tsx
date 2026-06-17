import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Camera, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  late_minutes: number;
  status: string;
  latitude: number | null;
  longitude: number | null;
  exact_location: string | null;
  attendance_type: string | null;
  employees?: { first_name: string; last_name: string; employee_code: string };
}

export default function Attendance() {
  const { hasRole, employeeId } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeCode, setEmployeeCode] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const canManage = hasRole("admin") || hasRole("hr");

  const fetchAttendance = async () => {
    let query = supabase.from("attendance").select("*, employees(first_name, last_name, employee_code)").eq("date", dateFilter).order("time_in", { ascending: false });
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setRecords(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAttendance(); }, [dateFilter]);

  const startCamera = () => {
    setCapturing(true);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => toast.error("Camera access denied"));
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCapturing(false);
  };

  const handleClockIn = async () => {
    if (!employeeCode.trim()) { toast.error("Please enter employee code"); return; }

    // Lookup employee
    const { data: emp, error: empErr } = await supabase.from("employees")
      .select("id, basic_salary").eq("employee_code", employeeCode.trim()).single();
    if (empErr || !emp) { toast.error("Employee not found"); return; }

    // Get GPS
    let lat: number | null = null, lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch { /* GPS optional */ }

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Check existing record
    const { data: existing } = await supabase.from("attendance")
      .select("id, time_in, time_out").eq("employee_id", emp.id).eq("date", today).maybeSingle();

    if (existing && !existing.time_out) {
      // Clock out
      const timeIn = new Date(existing.time_in);
      const diffMs = now.getTime() - timeIn.getTime();
      let totalHours = diffMs / (1000 * 60 * 60);
      
      // Deduct 1 hour break if they worked more than 5 hours
      if (totalHours > 5) totalHours -= 1;
      
      const overtimeMinutes = totalHours > 8 ? Math.round((totalHours - 8) * 60) : 0;
      const undertimeMinutes = totalHours < 8 && totalHours > 0 ? Math.round((8 - totalHours) * 60) : 0;

      const { error } = await supabase.from("attendance").update({
        time_out: now.toISOString(),
        total_hours_worked: Math.max(0, parseFloat(totalHours.toFixed(2))),
        overtime_minutes: overtimeMinutes,
        undertime_minutes: undertimeMinutes,
      }).eq("id", existing.id);
      if (error) toast.error(error.message);
      else toast.success("Clocked out successfully! Total hours: " + totalHours.toFixed(2));
    } else if (existing && existing.time_out) {
      toast.error("Already clocked in and out today");
    } else {
      // Clock in — compute late minutes
      const { data: settings } = await supabase.from("system_settings")
        .select("value").eq("key", "cutoff_time").single();
      let lateMinutes = 0;
      if (settings) {
        const [cutH, cutM] = settings.value.split(":").map(Number);
        const cutoff = new Date(now);
        cutoff.setHours(cutH, cutM, 0, 0);
        if (now > cutoff) {
          lateMinutes = Math.ceil((now.getTime() - cutoff.getTime()) / 60000);
        }
      }

      const { error } = await supabase.from("attendance").insert({
        employee_id: emp.id,
        date: today,
        time_in: now.toISOString(),
        latitude: lat,
        longitude: lng,
        late_minutes: lateMinutes,
        status: lateMinutes > 0 ? "late" : "present",
      });
      if (error) toast.error(error.message);
      else toast.success(lateMinutes > 0 ? `Clocked in (${lateMinutes} min late)` : "Clocked in on time!");
    }

    stopCamera();
    setEmployeeCode("");
    fetchAttendance();
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Attendance</h1>
        <p className="page-description">Track daily time-in and time-out</p>
      </div>

      {/* Clock In/Out Section */}
      <div className="stat-card mb-6">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" /> Clock In / Out
        </h3>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="flex-1 space-y-3">
            <Input
              placeholder="Enter Employee Code (e.g., ABL-00001)"
              value={employeeCode}
              onChange={e => setEmployeeCode(e.target.value)}
            />
            <div className="flex gap-2">
              {!capturing ? (
                <Button onClick={startCamera} variant="outline">
                  <Camera className="w-4 h-4 mr-2" /> Open Camera
                </Button>
              ) : (
                <>
                  <Button onClick={handleClockIn}>
                    <MapPin className="w-4 h-4 mr-2" /> Record Time
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>Cancel</Button>
                </>
              )}
            </div>
          </div>
          {capturing && (
            <div className="w-64 h-48 rounded-lg overflow-hidden bg-muted">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>

      {/* Records */}
      <div className="flex items-center gap-3 mb-4">
        <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-48" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Time In</TableHead>
              <TableHead>Time Out</TableHead>
              <TableHead>Late (min)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="min-w-[200px]">Exact Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : records.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No records for this date</TableCell></TableRow>
            ) : (
              records.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "—"}
                    <span className="block text-xs text-muted-foreground">{r.employees?.employee_code}</span>
                  </TableCell>
                  <TableCell>{r.time_in ? new Date(r.time_in).toLocaleTimeString() : "—"}</TableCell>
                  <TableCell>{r.time_out ? new Date(r.time_out).toLocaleTimeString() : "—"}</TableCell>
                  <TableCell>{r.late_minutes > 0 ? r.late_minutes : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "present" ? "default" : r.status === "late" ? "secondary" : "destructive"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.exact_location ? (
                      <div className="line-clamp-2" title={r.exact_location}>{r.exact_location}</div>
                    ) : r.latitude && r.longitude ? (
                      `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`
                    ) : "—"}
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
