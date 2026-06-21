import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Mode = "in" | "out";
type Phase = "active" | "success";

const playErrorBeep = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    console.error("Beep failed", e);
  }
};

export default function TimeIn() {
  const locationRoute = useLocation();
  const navigate = useNavigate();
  // Determine initial mode from route: /time-in = "in", /time-out = "out"
  const routeMode: Mode | null = locationRoute.pathname === "/time-out" ? "out" : locationRoute.pathname === "/time-in" ? "in" : null;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [phase, setPhase] = useState<Phase>("active");
  const [code, setCode] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [now, setNow] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>("");
  const [mode, setMode] = useState<Mode | null>(routeMode);
  const [cameraReady, setCameraReady] = useState(false);
  const [shake, setShake] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [enableFaceGate, setEnableFaceGate] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ name: string; time: string; mode: Mode } | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const detectionIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch voice setting on mount
  useEffect(() => {
    supabase.from("system_settings").select("value").eq("key", "enable_voice_announcement").single()
      .then(({ data }) => {
        if (data) setVoiceEnabled(data.value === 'true');
      });
  }, []);

  // ─── Init: Camera + GPS + face-api ───────────────────────────────────────
  useEffect(() => {
    // Silent GPS
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
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
    }

    // Start camera immediately
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch {
        toast.error("Camera access denied.");
      }
    })();

    // Load face-api
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js";
    script.async = true;
    script.onload = async () => {
      try {
        const faceapi = (window as any).faceapi;
        if (faceapi) {
          await faceapi.nets.tinyFaceDetector.loadFromUri("https://justadudewhohacks.github.io/face-api.js/models");
          setFaceApiLoaded(true);
        }
      } catch (e) {
        console.error("face-api load failed", e);
      }
    };
    document.body.appendChild(script);

    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ─── Real-time employee lookup as user types ──────────────────────────────
  useEffect(() => {
    if (!code || enableFaceGate) {
      if (!enableFaceGate) { setEmployeeName(""); setEmployeeId(""); }
      return;
    }

    const timer = setTimeout(async () => {
      // Use the public SECURITY DEFINER RPC — works without auth
      const { data, error } = await supabase.rpc("kiosk_lookup_by_code", { _typed: code });

      if (!error && data && data.length === 1) {
        setEmployeeName(`${data[0].first_name} ${data[0].last_name}`.toUpperCase());
        setEmployeeId(data[0].id);
      } else if (!error && data) {
        // Check exact padded match
        const padded = "ABL-" + code.padStart(5, "0");
        const exact = data.find((d: any) => d.employee_code === padded);
        if (exact) {
          setEmployeeName(`${exact.first_name} ${exact.last_name}`.toUpperCase());
          setEmployeeId(exact.id);
        } else {
          setEmployeeName("");
          setEmployeeId("");
        }
      } else {
        setEmployeeName("");
        setEmployeeId("");
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [code, enableFaceGate]);

  // ─── Face detection loop (only after DONE + employee found) ─────────────
  useEffect(() => {
    if (!enableFaceGate || !cameraReady || !faceApiLoaded || phase !== "active") return;
    const faceapi = (window as any).faceapi;
    if (!faceapi || !videoRef.current || !overlayCanvasRef.current) return;

    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    detectionIntervalRef.current = window.setInterval(async () => {
      if (!video || video.paused || video.ended) return;
      const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (detection) {
          const r = faceapi.resizeResults(detection, displaySize);
          const b = r.box;
          ctx.strokeStyle = "#00C853";
          ctx.lineWidth = 2;
          ctx.strokeRect(b.x, b.y, b.width, b.height);
          setFaceDetected(true);
        } else {
          setFaceDetected(false);
        }
      }
    }, 500);

    return () => {
      if (detectionIntervalRef.current) { clearInterval(detectionIntervalRef.current); detectionIntervalRef.current = null; }
      const ctx = overlayCanvasRef.current?.getContext("2d");
      if (ctx && overlayCanvasRef.current) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    };
  }, [enableFaceGate, cameraReady, faceApiLoaded, phase]);

  // ─── Live TTS greeting while typing the employee code ────────────────────
  const lastSpokenCodeRef = useRef<string>("");
  useEffect(() => {
    if (!code || code.length < 3 || enableFaceGate || phase !== "active") return;
    if (lastSpokenCodeRef.current === code) return;
    const handle = setTimeout(async () => {
      const padded = "ABL-" + code.padStart(5, "0");
      const { data } = await supabase.rpc("kiosk_lookup_by_code", { _typed: code });
      if (!data || data.length === 0) return;
      const match = data.find((d: any) => d.employee_code === padded) || (data.length === 1 ? data[0] : null);
      if (!match) return;
      lastSpokenCodeRef.current = code;
      const firstName = (match.first_name || "").split(" ")[0].trim();
      if (!firstName) return;
      const { playVoice } = await import("@/lib/voiceService");
      const action = mode === "out" ? "ready to time out" : "ready to time in";
      playVoice(`Hello ${firstName}, ${action}.`, undefined, "voice_welcome_enabled");
    }, 450);
    return () => clearTimeout(handle);
  }, [code, mode, enableFaceGate, phase]);

  // ─── Voice helper ────────────────────────────────────────────────────────
  const speakAnnouncement = async (type: "greeting" | "in" | "out" | "error" | "complete", empName: string, empCodeStr: string, timeStr?: string) => {
    // Extract FIRST name only (first word of employee's first_name or full display name)
    const firstName = empName.split(" ")[0].trim();

    const { playVoice } = await import("@/lib/voiceService");

    if (type === "error") {
      playVoice("Employee record not found.", "employee_not_found.mp3", "voice_error_enabled");
      return;
    }

    if (type === "complete") {
      playVoice("Attendance already completed for today.", "attendance_complete.mp3", "voice_error_enabled");
      return;
    }

    // Greeting rules
    const hour = new Date().getHours();
    let greeting = "Welcome";
    if (hour >= 12 && hour < 18) greeting = "Good Afternoon";
    else if (hour >= 18) greeting = "Good Evening";

    if (type === "greeting") {
      playVoice(`${greeting} ${firstName}.`, "welcome.mp3", "voice_welcome_enabled");
    } else if (type === "in") {
      playVoice(`Welcome ${firstName}. Successfully timed in.`, "timed_in.mp3", "voice_time_in_enabled");
    } else if (type === "out") {
      playVoice(`Thank you ${firstName}. Successfully timed out.`, "timed_out.mp3", "voice_time_out_enabled");
    }
  };

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };

  const resetKiosk = () => {
    setCode(""); setEmployeeName(""); setEmployeeId("");
    setEnableFaceGate(false); setFaceDetected(false); setMode(null);
    if (detectionIntervalRef.current) { clearInterval(detectionIntervalRef.current); detectionIntervalRef.current = null; }
    const ctx = overlayCanvasRef.current?.getContext("2d");
    if (ctx && overlayCanvasRef.current) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
  };

  // ─── DONE button ─────────────────────────────────────────────────────────
  const handleDone = async () => {
    if (!code || enableFaceGate || submitting) return;
    setSubmitting(true);

    const { data, error } = await supabase.rpc("kiosk_lookup_by_code", { _typed: code });
    const padded = "ABL-" + code.padStart(5, "0");
    let employee: any = null;

    if (!error && data && data.length > 0) {
      // Prefer exact code match
      employee = data.find((d: any) => d.employee_code === padded) || (data.length === 1 ? data[0] : null);
    }

    if (!employee) {
      speakAnnouncement("error", "", "");
      playErrorBeep();
      triggerShake();
      setCode("");
      setEmployeeName("");
      setEmployeeId("");
      setSubmitting(false);
      toast.error("Invalid Employee ID.");
      return;
    }

    const fullName = `${employee.first_name} ${employee.last_name}`.toUpperCase();
    setEmployeeName(fullName);
    setEmployeeId(employee.id);

    // Check today's attendance using public RPC
    const { data: attData } = await supabase.rpc("kiosk_get_today_attendance", { _employee_id: employee.id });
    
    // Check if employee already timed in AND timed out today
    if (attData && (attData as any).time_in && (attData as any).time_out) {
      speakAnnouncement("complete", fullName, padded);
      toast.error("Attendance already completed for today.");
      triggerShake();
      setCode("");
      setEmployeeName("");
      setEmployeeId("");
      setSubmitting(false);
      return;
    }

    // We no longer auto-set the mode. Let the user choose via the buttons.
    setMode(null);

    // Make sure voices are loaded by calling getVoices once before speaking
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
    
    speakAnnouncement("greeting", fullName, padded);
    setEnableFaceGate(true);
    setSubmitting(false);
  };

  const press = (k: string) => {
    if (enableFaceGate || submitting || phase !== "active") return;
    if (k === "Clear") { setCode(""); setEmployeeName(""); setEmployeeId(""); }
    else if (k === "Done") { handleDone(); }
    else if (code.length < 10) setCode(c => c + k);
  };

  // ─── Capture + upload selfie ─────────────────────────────────────────────
  const captureSelfie = (): string | null => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return null;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth || 480;
    c.height = v.videoHeight || 640;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  };

  const uploadSelfie = async (base64: string, empId: string): Promise<string | null> => {
    try {
      const res = await fetch(base64);
      const blob = await res.blob();
      const filename = `${empId}_${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("selfies").upload(filename, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from("selfies").getPublicUrl(filename);
      return data.publicUrl;
    } catch (e) {
      console.error("Selfie upload failed", e);
      return null;
    }
  };

  // ─── Submit punch ─────────────────────────────────────────────────────────
  const submitPunch = async (selectedMode: Mode) => {
    if (!faceDetected || !employeeId) return;
    setSubmitting(true);
    setMode(selectedMode);

    const selfieBase64 = captureSelfie();
    let photoUrl: string | null = null;
    if (selfieBase64) photoUrl = await uploadSelfie(selfieBase64, employeeId);

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const deviceType = isMobile ? "Mobile" : "Desktop";
    const deviceTimestamp = new Date().toISOString();
    const employeeCodeStr = "ABL-" + code.padStart(5, "0");

    try {
      const { data, error } = await supabase.rpc("kiosk_punch_v2", {
        _employee_id: employeeId,
        _mode: selectedMode,
        _latitude: location?.lat ?? null,
        _longitude: location?.lng ?? null,
        _photo_url: photoUrl,
        _address: address || null,
        _employee_code: employeeCodeStr,
        _employee_name: employeeName,
        _device_type: deviceType,
        _device_timestamp: deviceTimestamp
      });

      if (error) throw error;
      const res = data as any;
      if (!res?.ok) throw new Error(res?.error || "Punch failed");

      const timeStr = new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });
      
      if (selectedMode === "in") speakAnnouncement("in", employeeName, employeeCodeStr, timeStr);
      else speakAnnouncement("out", employeeName, employeeCodeStr, timeStr);

      setSuccessInfo({ name: employeeName, time: timeStr, mode: selectedMode });
      setPhase("success");

      setTimeout(() => {
        setPhase("active");
        resetKiosk();
        setSuccessInfo(null);
        setSubmitting(false);
      }, 3000);
    } catch (e: any) {
      console.error("Attendance RPC Error:", e);
      // Fallback: If the migration with 10 parameters isn't run, try the old 6 parameter signature so attendance is still saved.
      if (e.message?.includes("Could not find the function") || e.message?.includes("kiosk_punch_v2")) {
        try {
          const { data, error } = await supabase.rpc("kiosk_punch_v2", {
            _employee_id: employeeId,
            _mode: selectedMode,
            _latitude: location?.lat ?? null,
            _longitude: location?.lng ?? null,
            _photo_url: photoUrl,
            _address: address || null,
          });
          if (!error && (data as any)?.ok) {
            // Success with fallback
            const timeStr = new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });
            if (selectedMode === "in") speakAnnouncement("in", employeeName, employeeCodeStr, timeStr);
            else speakAnnouncement("out", employeeName, employeeCodeStr, timeStr);
            setSuccessInfo({ name: employeeName, time: timeStr, mode: selectedMode });
            setPhase("success");
            setTimeout(() => {
              setPhase("active");
              resetKiosk();
              setSuccessInfo(null);
              setSubmitting(false);
            }, 3000);
            return;
          }
        } catch (fallbackError) {
          console.error("Fallback RPC Error:", fallbackError);
        }
      }
      
      toast.error("Attendance save failed. Please try again.");
      setSubmitting(false);
    }
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "Done"];

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white select-none">
      {/* Back to Home button */}
      <button
        onClick={() => navigate("/")}
        className="fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/50 backdrop-blur border border-white/10 text-white/70 hover:text-white hover:bg-black/70 transition-all text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Home
      </button>
      {/* LAYER 1: Fullscreen Camera */}
      <video
        ref={videoRef}
        playsInline muted autoPlay
        className="fixed top-0 left-0 w-screen h-screen object-cover z-0"
        onLoadedMetadata={() => {
          if (overlayCanvasRef.current && videoRef.current) {
            overlayCanvasRef.current.width = videoRef.current.videoWidth;
            overlayCanvasRef.current.height = videoRef.current.videoHeight;
          }
        }}
      />

      {/* Face detection canvas (z-15) */}
      <canvas ref={overlayCanvasRef} className="fixed top-0 left-0 w-screen h-screen object-cover z-[15] pointer-events-none" />
      <canvas ref={canvasRef} className="hidden" />

      {/* LAYER 2: Dark overlay */}
      <div className="fixed inset-0 bg-black/25 z-[1] pointer-events-none" />

      {/* SUCCESS OVERLAY */}
      {phase === "success" && successInfo && (
        <div className="fixed inset-0 z-[100] bg-[#00C853] flex flex-col items-center justify-center">
          <CheckCircle className="w-32 h-32 text-white mb-6 animate-bounce" strokeWidth={1.5} />
          <h2 className="text-5xl font-bold mb-3 tracking-wide">TIMED {successInfo.mode === "in" ? "IN" : "OUT"}</h2>
          <div className="text-2xl font-medium opacity-90 mb-4">{successInfo.name}</div>
          <div className="text-3xl font-mono font-bold bg-black/20 px-8 py-3 rounded-full">{successInfo.time}</div>

          {/* Show location only on success */}
          {(address || location) && (
            <div className="absolute bottom-6 left-6 text-white/80 text-xs max-w-xs">
              <div className="truncate">{address || ""}</div>
              {location && <div className="opacity-60">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</div>}
            </div>
          )}
        </div>
      )}

      {phase === "active" && (
        <>
          {/* LAYER 3: Top info bar */}
          <div className="fixed top-0 left-0 right-0 z-[10] flex flex-col items-center pt-10 pb-4 pointer-events-none"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>
            <div className="text-[32px] font-bold tracking-widest text-white uppercase">
              {enableFaceGate && mode ? `TIME ${mode.toUpperCase()}` : mode ? `TIME ${mode.toUpperCase()}` : "TIME IN / TIME OUT"}
            </div>

            {/* Typed code display — actual numbers, NOT dots */}
            <div className={`text-[28px] font-mono text-white mt-2 min-h-[40px] ${shake ? "animate-shake" : ""}`}>
              {code || <span className="opacity-40 text-xl">Enter Employee Code</span>}
            </div>

            {/* Employee full name — appears immediately as they type */}
            <div className="text-[26px] font-bold text-white mt-1 min-h-[40px] uppercase">
              {employeeName}
            </div>
          </div>

          {/* LAYER 5: Numpad / Action */}
          <div className="fixed inset-0 z-[20] flex flex-col items-center justify-end pb-14 pointer-events-none">
            {!enableFaceGate ? (
              <div className="grid grid-cols-3 gap-2 px-6 pb-2 w-full max-w-sm pointer-events-auto">
                {keys.map(k => (
                  <button
                    key={k}
                    onClick={() => press(k)}
                    disabled={submitting}
                    style={{ textShadow: "0 2px 6px rgba(0,0,0,0.9)", minHeight: "80px", minWidth: "80px" }}
                    className={`rounded-none bg-transparent border-none text-white font-light hover:opacity-70 transition-all active:scale-90 disabled:opacity-40
                      ${k === "Clear" || k === "Done" ? "text-[22px] font-semibold tracking-wider uppercase" : "text-[40px]"}`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5 pointer-events-auto">
                {/* Face status hint */}
                <div className="text-white/70 text-sm tracking-widest uppercase">
                  {faceDetected ? "✓ Face Detected — Ready" : "Align face in frame…"}
                </div>

                <div className="flex gap-4">
                  {/* Show only TIME IN button if routeMode is 'in', only TIME OUT if 'out', both if no route mode */}
                  {(!routeMode || routeMode === "in") && (
                    <button
                      onClick={() => submitPunch("in")}
                      disabled={!faceDetected || submitting}
                      className={`px-8 py-5 rounded-full text-xl font-bold tracking-widest text-white shadow-2xl transition-all
                        ${faceDetected && !submitting
                          ? "bg-[#00C853] hover:bg-[#00E676] active:scale-95"
                          : "bg-[#00C853]/40 cursor-not-allowed opacity-50"}`}
                    >
                      {submitting ? "..." : "TIME IN"}
                    </button>
                  )}
                  {(!routeMode || routeMode === "out") && (
                    <button
                      onClick={() => submitPunch("out")}
                      disabled={!faceDetected || submitting}
                      className={`px-8 py-5 rounded-full text-xl font-bold tracking-widest text-white shadow-2xl transition-all
                        ${faceDetected && !submitting
                          ? "bg-[#D50000] hover:bg-[#FF1744] active:scale-95"
                          : "bg-[#D50000]/40 cursor-not-allowed opacity-50"}`}
                    >
                      {submitting ? "..." : "TIME OUT"}
                    </button>
                  )}
                </div>

                <button
                  onClick={resetKiosk}
                  disabled={submitting}
                  className="text-white/70 hover:text-white uppercase tracking-widest text-sm font-medium active:scale-95"
                  style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%,60%{transform:translateX(-10px)}
          40%,80%{transform:translateX(10px)}
        }
        .animate-shake{animation:shake 0.4s cubic-bezier(.36,.07,.19,.97) both}
      ` }} />
    </div>
  );
}
