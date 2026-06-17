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

  // Lookup employee name as code is entered (via secure RPC; no direct table access)
  useEffect(() => {
    if (!code) { setEmployeeName(""); return; }
    const lookup = code.startsWith("ABL-") ? code : "ABL-" + code.padStart(5, "0");
    const tid = setTimeout(async () => {
      const { data } = await supabase.rpc("kiosk_lookup_employee", { _code: lookup });
      const row = Array.isArray(data) ? data[0] : null;
      setEmployeeName(row ? `${row.first_name} ${row.last_name}`.toUpperCase() : "");
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

  // Announce employee name as soon as it's resolved
  useEffect(() => {
    if (employeeName && code) {
      const spelled = code.split("").join(" ");
      speak(`Employee Code ${spelled}. Welcome ${employeeName}.`);
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
    try {
      const lookup = "ABL-" + code.padStart(5, "0");
      const selfie = captureSelfie();
      const { data, error } = await supabase.rpc("kiosk_punch", {
        _code: lookup,
        _mode: mode,
        _latitude: location?.lat ?? null,
        _longitude: location?.lng ?? null,
        _selfie: selfie,
        _address: address || null,
      });
      if (error) { toast.error(error.message); return; }
      const res = data as { ok?: boolean; error?: string; first_name?: string; last_name?: string; late_minutes?: number } | null;
      if (!res?.ok) { toast.error(res?.error || "Punch failed"); return; }

      const fn = res.first_name ?? "";
      const ln = res.last_name ?? "";
      if (mode === "in") {
        const late = res.late_minutes ?? 0;
        toast.success(`${fn} Successfully timed in!${late ? ` (${late}m late)` : ""}`);
        speak(`Welcome ${fn} ${ln}. Your Time In has been recorded.`);
      } else {
        toast.success(`${fn} Successfully timed out!`);
        speak(`Thank you ${fn} ${ln}. Your Time Out has been recorded.`);
      }
      setCode("");
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
    </div>
  );
}
