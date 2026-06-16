import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, MapPin, LogIn, LogOut, Delete, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Mode = "in" | "out";

export default function TimeIn() {
  const [code, setCode] = useState("");
  const [now, setNow] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>("");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });
        // Reverse geocode (best-effort, free public endpoint)
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`)
          .then(r => r.json())
          .then(d => setAddress(d.display_name || ""))
          .catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  const press = (k: string) => setCode(c => (c.length >= 12 ? c : c + k));
  const clear = () => setCode("");
  const back = () => setCode(c => c.slice(0, -1));

  const submit = async (mode: Mode) => {
    if (!code.trim()) { toast.error("Enter your Employee Code"); return; }
    setSubmitting(true);
    try {
      // Accept either full code "ABL-00001" or just digits "00001" / "1"
      let lookup = code.trim().toUpperCase();
      if (!lookup.startsWith("ABL-")) lookup = "ABL-" + lookup.padStart(5, "0");

      const { data: emp, error: empErr } = await supabase
        .from("employees")
        .select("id, first_name, last_name, employee_code")
        .eq("employee_code", lookup)
        .maybeSingle();

      if (empErr || !emp) { toast.error(`Employee ${lookup} not found`); return; }

      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("attendance")
        .select("id, time_in, time_out")
        .eq("employee_id", emp.id)
        .eq("date", today)
        .maybeSingle();

      const stamp = new Date().toISOString();
      const lat = location?.lat ?? null;
      const lng = location?.lng ?? null;

      if (mode === "in") {
        if (existing) { toast.error("Already timed in today"); return; }
        // Compute lateness
        const { data: settings } = await supabase
          .from("system_settings").select("value").eq("key", "cutoff_time").maybeSingle();
        let lateMinutes = 0;
        if (settings?.value) {
          const [h, m] = String(settings.value).split(":").map(Number);
          const cutoff = new Date(); cutoff.setHours(h, m, 0, 0);
          if (new Date() > cutoff) lateMinutes = Math.ceil((Date.now() - cutoff.getTime()) / 60000);
        }
        const { error } = await supabase.from("attendance").insert({
          employee_id: emp.id, date: today, time_in: stamp,
          latitude: lat, longitude: lng,
          late_minutes: lateMinutes,
          status: lateMinutes > 0 ? "late" : "present",
        });
        if (error) { toast.error(error.message); return; }
        toast.success(`${emp.first_name}, time in recorded${lateMinutes ? ` (${lateMinutes} min late)` : ""}`);
      } else {
        if (!existing) { toast.error("No time-in record for today"); return; }
        if (existing.time_out) { toast.error("Already timed out today"); return; }
        const { error } = await supabase.from("attendance")
          .update({ time_out: stamp }).eq("id", existing.id);
        if (error) { toast.error(error.message); return; }
        toast.success(`${emp.first_name}, time out recorded`);
      }
      setCode("");
    } finally {
      setSubmitting(false);
    }
  };

  const keys = ["1","2","3","4","5","6","7","8","9","clear","0","back"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4 flex flex-col">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <Link to="/auth"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Admin</Button></Link>
          <h1 className="font-display font-bold text-lg">Employee Time In / Out</h1>
          <div className="w-16" />
        </div>

        {/* Clock + location */}
        <Card className="p-4 mb-4 text-center bg-primary text-primary-foreground">
          <div className="flex items-center justify-center gap-2 text-sm opacity-90">
            <Clock className="w-4 h-4" />
            {now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
          <div className="text-4xl font-display font-bold tracking-wide my-1">
            {now.toLocaleTimeString()}
          </div>
          <div className="flex items-start justify-center gap-1 text-xs opacity-90 mt-2">
            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="line-clamp-2">
              {location
                ? (address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`)
                : "Acquiring GPS location…"}
            </span>
          </div>
        </Card>

        {/* Code display */}
        <Card className="p-4 mb-3">
          <div className="text-xs text-muted-foreground mb-1 text-center">EMPLOYEE CODE</div>
          <div className="text-center text-3xl font-mono tracking-widest min-h-[3rem] flex items-center justify-center">
            {code || <span className="text-muted-foreground/40">— — — — —</span>}
          </div>
        </Card>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {keys.map(k => {
            if (k === "clear") return (
              <Button key={k} variant="outline" className="h-16 text-base" onClick={clear} disabled={submitting}>Clear</Button>
            );
            if (k === "back") return (
              <Button key={k} variant="outline" className="h-16" onClick={back} disabled={submitting}><Delete className="w-5 h-5" /></Button>
            );
            return (
              <Button key={k} variant="secondary" className="h-16 text-2xl font-display" onClick={() => press(k)} disabled={submitting}>
                {k}
              </Button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-16 text-base" onClick={() => submit("in")} disabled={submitting}>
            <LogIn className="w-5 h-5 mr-2" /> TIME IN
          </Button>
          <Button className="h-16 text-base" variant="secondary" onClick={() => submit("out")} disabled={submitting}>
            <LogOut className="w-5 h-5 mr-2" /> TIME OUT
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Tip: enter just the number (e.g. <span className="font-mono">1</span> for <span className="font-mono">ABL-00001</span>)
        </p>
      </div>
    </div>
  );
}
