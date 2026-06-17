import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Delete } from "lucide-react";
import { toast } from "sonner";

type Mode = "in" | "out";

export default function TimeIn() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [code, setCode] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [now, setNow] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>("");
  const [mode, setMode] = useState<Mode>("in");
  const [cameraReady, setCameraReady] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<{name: string, type: string, date: string, time: string, location: string, lat: number, lng: number} | null>(null);

  useEffect(() => {
    supabase.from("system_settings").select("key, value").like("key", "voice_%").then(({ data }) => {
      if (data) {
        const obj: Record<string, string> = {};
        data.forEach(d => obj[d.key] = d.value);
        setVoiceSettings(obj);
      }
    });
  }, []);

  const playAudio = (url: string) => {
    try {
      const audio = new Audio(url);
      audio.play().catch(() => {});
    } catch {}
  };

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });
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

  // Front camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" }, // Removed strict zoom constraints
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch {
        toast.error("Camera access denied. Selfie capture disabled.");
      }
    })();
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  // Lookup employee name as code is entered
  useEffect(() => {
    if (!code) { setEmployeeName(""); return; }
    const lookup = code.startsWith("ABL-") ? code : "ABL-" + code.padStart(5, "0");
    const tid = setTimeout(async () => {
      const { data } = await supabase.rpc("kiosk_lookup_employee", { _code: lookup });
      const row = Array.isArray(data) ? data[0] : null;
      if (row) {
        setEmployeeName(`${row.first_name} ${row.last_name}`.toUpperCase());
        // Auto detect mode
        const today = localDateStr();
        if (row.id) {
          const { data: att } = await supabase.from('attendance')
             .select('time_in, time_out')
             .eq('employee_id', row.id)
             .eq('date', today)
             .maybeSingle();
          if (!att) setMode("in");
          else if (att.time_in && !att.time_out) setMode("out");
        }
      } else {
        setEmployeeName("");
      }
    }, 200);
    return () => clearTimeout(tid);
  }, [code]);

  const press = (k: string) => setCode(c => (c.length >= 8 ? c : c + k));
  const clear = () => setCode("");
  const back = () => setCode(c => c.slice(0, -1));

  const captureSelfie = (): string | null => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return null;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = 480; c.height = 640;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    // Mirror selfie to match preview
    ctx.translate(c.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.6);
  };

  const speak = (text: string) => {
    try {
      if (!("speechSynthesis" in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95; u.pitch = 1; u.volume = 1;
      window.speechSynthesis.speak(u);
    } catch {}
  };

  const hybridSpeak = (ttsText: string, eventKey: string) => {
    speak(ttsText);
    const useMP3 = voiceSettings.voice_use_custom !== "false";
    const fallback = voiceSettings.voice_fallback_tts !== "false";
    const url = voiceSettings[eventKey];

    if (useMP3 && url) {
      setTimeout(() => playAudio(url), 1500); // play after TTS
    } else if (fallback) {
      setTimeout(() => {
        if (eventKey === "voice_time_in_success") speak("Successfully timed in.");
        else if (eventKey === "voice_time_out_success") speak("Successfully timed out.");
        else if (eventKey === "voice_employee_not_found") speak("Employee record not found.");
        else if (eventKey === "voice_invalid_employee_id") speak("Invalid Employee ID.");
      }, 1500);
    }
  };

  // Announce employee name as soon as it's resolved
  useEffect(() => {
    if (employeeName && code) {
      const spelled = code.split("").join(" ");
      speak(`Welcome ${employeeName}.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeName]);

  // Local YYYY-MM-DD (not UTC) so cross-midnight time-ins work per calendar day
  const localDateStr = (d = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  const submit = async () => {
    if (!code.trim()) { toast.error("Enter your Employee ID"); return; }
    setSubmitting(true);
    
    let finalLocation = location;
    let finalAddress = address;

    if (!finalLocation) {
      try {
        toast.info("Acquiring GPS location...");
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
        });
        finalLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(finalLocation);
        // Optional quick reverse geocoding
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${finalLocation.lat}&lon=${finalLocation.lng}&zoom=16`);
          const d = await r.json();
          if (d.display_name) {
            finalAddress = d.display_name;
            setAddress(d.display_name);
          }
        } catch {}
      } catch {
        toast.error("Location access is required. Please check your device GPS settings.");
        setSubmitting(false);
        return;
      }
    }

    const selfie = captureSelfie();
    if (!selfie) {
      toast.error("Selfie verification is required.");
      setSubmitting(false);
      return;
    }

    try {
      const lookup = "ABL-" + code.padStart(5, "0");
      
      const { data, error } = await supabase.rpc("kiosk_punch", {
        _code: lookup,
        _mode: mode,
        _latitude: finalLocation.lat,
        _longitude: finalLocation.lng,
        _selfie: selfie,
        _address: finalAddress || null,
      });
      if (error) { toast.error(error.message); return; }
      const res = data as { ok?: boolean; error?: string; first_name?: string; last_name?: string; late_minutes?: number } | null;
      if (!res?.ok) { 
        toast.error(res?.error || "Invalid Employee ID."); 
        hybridSpeak("Invalid Employee ID.", "voice_invalid_employee_id");
        return; 
      }

      const fn = res.first_name ?? "";
      const ln = res.last_name ?? "";
      const fullName = `${fn} ${ln}`;
      const timeStr = new Date().toLocaleTimeString();
      const dateStr = new Date().toLocaleDateString();

      if (mode === "in") {
        const late = res.late_minutes ?? 0;
        toast.success(`${fn} Successfully timed in!${late ? ` (${late}m late)` : ""}`);
        hybridSpeak(`Welcome ${fn}.`, "voice_time_in_success");
      } else {
        toast.success(`${fn} Successfully timed out!`);
        hybridSpeak(`Thank you ${fn}.`, "voice_time_out_success");
      }
      
      setConfirmation({
        name: fullName,
        type: mode === "in" ? "Time In" : "Time Out",
        date: dateStr,
        time: timeStr,
        location: address || "Location acquired",
        lat: location.lat,
        lng: location.lng
      });
      
      setCode("");
      setTimeout(() => setConfirmation(null), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const keys = ["1","2","3","4","5","6","7","8","9","clear","0","done"];

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Fullscreen mirrored video */}
      <video
        ref={videoRef}
        playsInline muted autoPlay
        className="absolute inset-0 w-full h-full object-cover [transform:scaleX(-1)]"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/35" />

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="border border-white/30" />
        ))}
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 text-white">
        <Link to="/auth"><Button variant="ghost" size="icon" className="text-white hover:bg-white/10"><ArrowLeft className="w-6 h-6" /></Button></Link>
        <div className="text-sm font-mono opacity-80">{now.toLocaleTimeString()}</div>
        <div className="flex gap-1 bg-black/40 rounded-full p-1">
          <Button size="sm" variant={mode === "in" ? "default" : "ghost"} className={mode === "in" ? "" : "text-white hover:bg-white/10"} onClick={() => setMode("in")}>IN</Button>
          <Button size="sm" variant={mode === "out" ? "default" : "ghost"} className={mode === "out" ? "" : "text-white hover:bg-white/10"} onClick={() => setMode("out")}>OUT</Button>
        </div>
      </div>

      {/* Header text */}
      <div className="absolute top-16 left-0 right-0 text-center text-white drop-shadow-lg pointer-events-none">
        <div className="text-3xl font-display font-bold tracking-widest">
          TIME {mode === "in" ? "IN" : "OUT"}
        </div>
        <div className="text-5xl font-display font-bold mt-2 min-h-[3.5rem]">
          {code || <span className="opacity-40">— — — — —</span>}
        </div>
        <div className="text-2xl font-display font-semibold mt-1 min-h-[2rem]">
          {employeeName || <span className="opacity-40 text-base">Enter Employee ID</span>}
        </div>
      </div>

      {/* GPS info (left side, mid) */}
      <div className="absolute top-[42%] left-3 right-3 text-white text-xs drop-shadow-lg pointer-events-none">
        <div className="line-clamp-2 opacity-90">
          {address || "Acquiring location…"}
        </div>
        {location && (
          <>
            <div className="opacity-80">Lat: {location.lat.toFixed(7)}</div>
            <div className="opacity-80">Long: {location.lng.toFixed(7)}</div>
          </>
        )}
        <div className="opacity-80">{now.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</div>
      </div>

      {/* Keypad — overlaid on bottom half of camera */}
      <div className="absolute bottom-0 left-0 right-0 grid grid-cols-3 gap-px text-white">
        {keys.map(k => {
          if (k === "clear")
            return <button key={k} onClick={clear} disabled={submitting} className="h-20 text-2xl font-light hover:bg-white/15 active:bg-white/30 transition">Clear</button>;
          if (k === "done")
            return <button key={k} onClick={submit} disabled={submitting || !code} className="h-20 text-2xl font-medium hover:bg-primary/40 active:bg-primary/60 transition disabled:opacity-40">Done</button>;
          return <button key={k} onClick={() => press(k)} disabled={submitting} className="h-20 text-3xl font-light hover:bg-white/15 active:bg-white/30 transition">{k}</button>;
        })}
      </div>

      {/* Backspace floating */}
      {code && (
        <button onClick={back} className="absolute bottom-[260px] right-3 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
          <Delete className="w-5 h-5" />
        </button>
      )}

      {/* Confirmation Overlay */}
      {confirmation && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 text-white text-center animate-in fade-in duration-300">
          <div className="bg-white/10 p-8 rounded-3xl backdrop-blur-md max-w-sm w-full border border-white/20 shadow-2xl">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-1">{confirmation.type} Successful</h2>
            <p className="text-xl font-medium text-white/80 mb-6">{confirmation.name}</p>
            
            <div className="space-y-3 text-sm text-left bg-black/40 p-4 rounded-xl border border-white/10">
              <div className="flex justify-between">
                <span className="text-white/60">Date</span>
                <span className="font-medium">{confirmation.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Time</span>
                <span className="font-medium text-primary-foreground">{confirmation.time}</span>
              </div>
              <div className="pt-2 border-t border-white/10">
                <span className="text-white/60 block text-xs mb-1">Exact Location</span>
                <span className="font-medium leading-tight block">{confirmation.location}</span>
              </div>
              <div className="flex justify-between text-xs text-white/50 pt-1">
                <span>Lat: {confirmation.lat.toFixed(5)}</span>
                <span>Lng: {confirmation.lng.toFixed(5)}</span>
              </div>
            </div>
            
            <Button onClick={() => setConfirmation(null)} className="w-full mt-6" variant="secondary">
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
