import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MapPin, Image as ImageIcon, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  photo_in_url: string | null;
  photo_out_url: string | null;
  latitude_in: number | null;
  longitude_in: number | null;
  latitude_out: number | null;
  longitude_out: number | null;
  location_label_in: string | null;
  location_label_out: string | null;
  status: string | null;
  total_hours: number | null;
  employees?: { first_name: string; last_name: string; employee_code: string };
}

export default function Attendance() {
  const { hasRole } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  
  // Selfie Modal State
  const [selfieModal, setSelfieModal] = useState<AttendanceRecord | null>(null);

  const fetchAttendance = async () => {
    let query = supabase.from("attendance").select("*, employees(first_name, last_name, employee_code)").eq("date", dateFilter).order("time_in", { ascending: false });
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setRecords(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAttendance(); }, [dateFilter]);

  const LocationCell = ({ label, lat, lng }: { label: string | null, lat: number | null, lng: number | null }) => {
    if (!lat || !lng) return <span className="text-muted-foreground">—</span>;
    const gmapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const displayLabel = label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    
    return (
      <a 
        href={gmapsUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-1 hover:text-primary transition-colors group"
        title={displayLabel}
      >
        <MapPin className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
        <span className="truncate max-w-[150px] inline-block align-bottom">{displayLabel}</span>
      </a>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Daily Logs</h1>
        <p className="page-description">Track daily time-in and time-out with GPS and selfies</p>
      </div>

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
              <TableHead>Total Hours</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time In Location</TableHead>
              <TableHead>Time Out Location</TableHead>
              <TableHead className="text-center">Photo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : records.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No records for this date</TableCell></TableRow>
            ) : (
              records.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "—"}
                    <span className="block text-xs text-muted-foreground">{r.employees?.employee_code}</span>
                  </TableCell>
                  <TableCell>{r.time_in ? new Date(r.time_in).toLocaleTimeString() : "—"}</TableCell>
                  <TableCell>{r.time_out ? new Date(r.time_out).toLocaleTimeString() : "—"}</TableCell>
                  <TableCell>{r.total_hours ? parseFloat(r.total_hours.toString()).toFixed(2) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'On Time' || r.status === 'present' ? "default" : r.status === 'Late' || r.status === 'late' ? "secondary" : "destructive"}>
                      {r.status || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <LocationCell label={r.location_label_in} lat={r.latitude_in} lng={r.longitude_in} />
                  </TableCell>
                  <TableCell className="text-xs">
                    <LocationCell label={r.location_label_out} lat={r.latitude_out} lng={r.longitude_out} />
                  </TableCell>
                  <TableCell className="text-center">
                    {(r.photo_in_url || r.photo_out_url) ? (
                      <button 
                        onClick={() => setSelfieModal(r)}
                        className="inline-flex w-8 h-8 rounded-full bg-muted border items-center justify-center overflow-hidden hover:ring-2 ring-primary/50 transition-all"
                      >
                        {r.photo_in_url ? (
                          <img src={r.photo_in_url} alt="Selfie" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Selfie Modal */}
      {selfieModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-card max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg">{selfieModal.employees?.first_name} {selfieModal.employees?.last_name}</h3>
                <p className="text-sm text-muted-foreground">{new Date(selfieModal.date).toLocaleDateString()}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelfieModal(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Time In */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-primary">TIME IN</h4>
                  <span className="text-xs font-mono">{selfieModal.time_in ? new Date(selfieModal.time_in).toLocaleTimeString() : "—"}</span>
                </div>
                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted flex items-center justify-center relative">
                  {selfieModal.photo_in_url ? (
                    <img src={selfieModal.photo_in_url} alt="Time In Selfie" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-muted-foreground flex flex-col items-center">
                      <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-sm">No Photo</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground leading-tight p-2 bg-muted/50 rounded-lg">
                  <MapPin className="w-3 h-3 inline mr-1 mb-0.5" />
                  {selfieModal.location_label_in || "No location recorded"}
                </div>
              </div>
              
              {/* Time Out */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-primary">TIME OUT</h4>
                  <span className="text-xs font-mono">{selfieModal.time_out ? new Date(selfieModal.time_out).toLocaleTimeString() : "—"}</span>
                </div>
                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted flex items-center justify-center relative">
                  {selfieModal.photo_out_url ? (
                    <img src={selfieModal.photo_out_url} alt="Time Out Selfie" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-muted-foreground flex flex-col items-center">
                      <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-sm">No Photo</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground leading-tight p-2 bg-muted/50 rounded-lg">
                  <MapPin className="w-3 h-3 inline mr-1 mb-0.5" />
                  {selfieModal.location_label_out || "No location recorded"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
