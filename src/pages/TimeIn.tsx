import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";

type Mode = "in" | "out";
type Phase = "dial" | "camera" | "success";

// Helper to play an error beep
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("dial");
  const [code, setCode] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [now, setNow] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>("");
  const [mode, setMode] = useState<Mode>("in");
  const [cameraReady, setCameraReady] = useState(false);
  const [shake, setShake] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{name: string, time: string} | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load face-api.js
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js";
    script.async = true;
    script.onload = async () => {
      try {
        const modelsUrl = "https://justadudewhohacks.github.io/face-api.js/models";
        const faceapi = (window as any).faceapi;
        if (faceapi) {
          await faceapi.nets.tinyFaceDetector.loadFromUri(modelsUrl);
          setFaceApiLoaded(true);
        }
      } catch (e) {
        console.error("Failed to load face-api models", e);
      }
    };
    document.body.appendChild(script);
    
    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Voice Asset Logic helper
  const playVoiceAsset = async (filename: string, fallbackText: string) => {
    try {
      const { data } = supabase.storage.from("voice-assets").getPublicUrl(filename);
      // Try to fetch to see if it actually exists (Supabase public URLs always generate a URL, we need to check if 200)
      const res = await fetch(data.publicUrl);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start(0);
      } else {
        throw new Error("File not found");
      }
    } catch (e) {
      // Fallback to TTS
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(fallbackText);
        u.lang = "en-US";
        u.rate = 1.0;
        u.pitch = 1.1;
        u.volume = 1.0;
        const voices = window.speechSynthesis.getVoices();
        const female = voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("female"));
        if (female) u.voice = female;
        window.speechSynthesis.speak(u);
      }
    }
  };

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Silent GPS capture
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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        startFaceDetection();
      }
    } catch (e) {
      toast.error("Camera access denied.");
    }
  };

  const stopCamera = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setFaceDetected(false);
  };

  const startFaceDetection = () => {
    if (!(window as any).faceapi || !videoRef.current || !overlayCanvasRef.current) return;
    const faceapi = (window as any).faceapi;
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    detectionIntervalRef.current = window.setInterval(async () => {
      if (!video || video.paused || video.ended) return;
      const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (detections) {
          const resizedDetections = faceapi.resizeResults(detections, displaySize);
          const box = resizedDetections.box;
          
          // Draw face outline box (mirrored since video is mirrored)
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          
          ctx.strokeStyle = '#00C853';
          ctx.lineWidth = 3;
          // Subtly rounded corners
          ctx.beginPath();
          ctx.roundRect(box.x, box.y, box.width, box.height, 10);
          ctx.stroke();
          
          // Semi-transparent overlay with clear cutout for face
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.beginPath();
          ctx.rect(0, 0, canvas.width, canvas.height);
          ctx.roundRect(box.x, box.y, box.width, box.height, 10);
          ctx.fill('evenodd');
          
          ctx.restore();
          
          setFaceDetected(true);
        } else {
          setFaceDetected(false);
        }
      }
    }, 500);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleDoneDialing = async () => {
    if (!code) return;
    setSubmitting(true);
    
    const lookup = code.startsWith("ABL-") ? code : "ABL-" + code.padStart(5, "0");
    const { data, error } = await supabase.rpc("kiosk_lookup_employee", { _code: lookup });
    const row = Array.isArray(data) ? data[0] : null;
    
    if (error || !row) {
      playErrorBeep();
      triggerShake();
      setCode("");
      setSubmitting(false);
      return;
    }
    
    const fn = row.first_name || "";
    setEmployeeName(`${fn} ${row.last_name || ""}`);
    
    // Auto detect mode
    const today = new Date().toLocaleDateString('en-CA'); // Local YYYY-MM-DD
    const { data: att } = await supabase.from('attendance')
       .select('time_in, time_out')
       .eq('employee_id', row.id)
       .eq('date', today)
       .maybeSingle();
       
    if (!att) setMode("in");
    else if (att.time_in && !att.time_out) setMode("out");
    else setMode("in"); // default back to in
    
    // Play greeting
    await playVoiceAsset("greeting.mp3", `Hello, ${fn}!`);
    
    setPhase("camera");
    setSubmitting(false);
    
    // Start camera after a tiny delay to let UI render
    setTimeout(startCamera, 100);
  };

  const press = (k: string) => {
    if (phase !== "dial") return;
    if (k === "clear") setCode("");
    else if (k === "done") handleDoneDialing();
    else setCode(c => (c.length >= 8 ? c : c + k));
  };

  const captureSelfie = (): string | null => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return null;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth || 480; 
    c.height = v.videoHeight || 640;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.translate(c.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.6);
  };

  const submitPunch = async () => {
    if (!faceDetected) return;
    setSubmitting(true);
    
    const selfie = captureSelfie();
    if (!selfie) {
      toast.error("Could not capture selfie.");
      setSubmitting(false);
      return;
    }

    try {
      const lookup = "ABL-" + code.padStart(5, "0");
      const { data, error } = await supabase.rpc("kiosk_punch", {
        _code: lookup,
        _mode: mode,
        _latitude: location?.lat || null,
        _longitude: location?.lng || null,
        _selfie: selfie,
        _address: address || null,
      });
      
      if (error) throw error;
      const res = data as any;
      if (!res?.ok) {
        throw new Error(res?.error || "Invalid punch");
      }
      
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      
      if (mode === "in") {
        playVoiceAsset("timein_success.mp3", "Successfully timed in!");
      } else {
        playVoiceAsset("timeout_success.mp3", "Successfully timed out!");
      }
      
      stopCamera();
      setSuccessInfo({ name: employeeName, time: timeStr });
      setPhase("success");
      
      setTimeout(() => {
        setPhase("dial");
        setCode("");
        setEmployeeName("");
        setSuccessInfo(null);
      }, 3000);
      
    } catch (e: any) {
      toast.error(e.message);
      setSubmitting(false);
    }
  };
  
  const cancelPunch = () => {
    stopCamera();
    setPhase("dial");
    setCode("");
    setEmployeeName("");
  };

  const keys = ["1","2","3","4","5","6","7","8","9","clear","0","done"];

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0F0F1A] text-white select-none">
      
      {/* SUCCESS OVERLAY */}
      {phase === "success" && successInfo && (
        <div className="absolute inset-0 z-50 bg-[#00C853] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <CheckCircle className="w-32 h-32 text-white mb-6 animate-bounce" strokeWidth={1.5} />
          <h2 className="text-4xl font-display font-bold mb-2 tracking-wide">TIMED {mode === "in" ? "IN" : "OUT"}</h2>
          <div className="text-2xl font-medium opacity-90">{successInfo.name}</div>
          <div className="text-3xl mt-4 font-mono font-bold bg-black/20 px-6 py-2 rounded-full">{successInfo.time}</div>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between p-6 bg-gradient-to-b from-[#0F0F1A] to-transparent">
        <Link to="/auth">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div className="text-xl font-display font-bold tracking-widest text-primary-200">
          ABL PAYROLL SOLUTIONS
        </div>
        <div className="text-right">
          <div className="text-lg font-mono font-medium">{now.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila' })}</div>
          <div className="text-xs opacity-60 uppercase tracking-widest">{now.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}</div>
        </div>
      </div>

      {/* PHASE: DIAL PAD */}
      {phase === "dial" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-20">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-display font-semibold mb-4 text-white/80 tracking-wide">ENTER EMPLOYEE ID</h1>
            <div className={`flex gap-3 justify-center h-16 items-center ${shake ? 'animate-shake' : ''}`}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                    i < code.length ? "bg-white border-white scale-110" : "border-white/30 bg-transparent"
                  }`}
                />
              ))}
            </div>
            <div className="mt-4 text-white/40 h-6 font-mono tracking-widest text-sm">
              {code || "Press digits to begin"}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 p-6 max-w-sm w-full">
            {keys.map(k => {
              if (k === "clear") {
                return (
                  <button key={k} onClick={() => press(k)} disabled={submitting} 
                    className="h-20 rounded-2xl bg-transparent border border-white/10 text-white/60 text-lg font-medium hover:bg-white/5 hover:text-white transition-all active:scale-95 disabled:opacity-50 uppercase tracking-wider">
                    Clear
                  </button>
                );
              }
              if (k === "done") {
                return (
                  <button key={k} onClick={() => press(k)} disabled={submitting || !code} 
                    className="h-20 rounded-2xl bg-primary text-primary-foreground text-lg font-bold hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-30 disabled:bg-white/10 disabled:text-white/30 shadow-[0_0_20px_rgba(var(--primary),0.3)] uppercase tracking-wider">
                    Done
                  </button>
                );
              }
              return (
                <button key={k} onClick={() => press(k)} disabled={submitting} 
                  className="h-20 rounded-2xl bg-[#1E1E3A] border border-transparent text-white text-3xl font-light hover:border-primary/50 hover:bg-[#25254A] transition-all active:scale-95 disabled:opacity-50">
                  {k}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PHASE: CAMERA */}
      {phase === "camera" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-3xl overflow-hidden border-4 border-[#1E1E3A] shadow-2xl">
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1E1E3A]">
                <div className="animate-pulse text-white/50 text-sm tracking-widest uppercase">Initializing Camera...</div>
              </div>
            )}
            <video
              ref={videoRef}
              playsInline muted autoPlay
              className="absolute inset-0 w-full h-full object-cover [transform:scaleX(-1)]"
              onLoadedMetadata={() => {
                if (overlayCanvasRef.current && videoRef.current) {
                  overlayCanvasRef.current.width = videoRef.current.videoWidth;
                  overlayCanvasRef.current.height = videoRef.current.videoHeight;
                }
              }}
            />
            <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" />
            
            {/* Hidden canvas for taking snapshot */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Instruction Overlay */}
            <div className="absolute top-6 left-0 right-0 z-20 text-center drop-shadow-md">
              <div className="inline-block bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-medium tracking-wide">
                {faceDetected ? "Face Detected" : "Align face in frame"}
              </div>
            </div>
            
            {/* Mode Toggle (if employee has flexibility) */}
            <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-2">
              <div className="bg-black/60 backdrop-blur-sm p-1 rounded-full flex">
                <button 
                  onClick={() => setMode("in")}
                  className={`px-6 py-2 rounded-full text-sm font-bold tracking-widest transition-colors ${mode === "in" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}>
                  IN
                </button>
                <button 
                  onClick={() => setMode("out")}
                  className={`px-6 py-2 rounded-full text-sm font-bold tracking-widest transition-colors ${mode === "out" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}>
                  OUT
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex gap-4 w-full max-w-md px-4">
            <Button 
              variant="outline" 
              size="lg" 
              className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10"
              onClick={cancelPunch}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button 
              size="lg" 
              className={`flex-[2] text-lg font-bold tracking-widest transition-all ${faceDetected ? 'bg-[#00C853] hover:bg-[#00E676] text-black shadow-[0_0_30px_rgba(0,200,83,0.4)]' : 'bg-white/10 text-white/30'}`}
              disabled={!faceDetected || submitting}
              onClick={submitPunch}
            >
              {submitting ? "PROCESSING..." : `TIME ${mode.toUpperCase()}`}
            </Button>
          </div>
          
          <div className="mt-4 text-center">
            <div className="text-xl font-medium tracking-wide">{employeeName}</div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-10px); }
          40%, 80% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}} />
    </div>
  );
}
