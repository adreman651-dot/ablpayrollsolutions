import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";

type Mode = "in" | "out";
type Phase = "active" | "success";

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
  
  const [phase, setPhase] = useState<Phase>("active");
  const [code, setCode] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [now, setNow] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>("");
  const [mode, setMode] = useState<Mode | null>(null); // "in" or "out" determined after DONE
  const [cameraReady, setCameraReady] = useState(false);
  const [shake, setShake] = useState(false);
  
  // Face detection
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [enableFaceGate, setEnableFaceGate] = useState(false); // only true after DONE
  
  const [successInfo, setSuccessInfo] = useState<{name: string, time: string} | null>(null);
  
  const detectionIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load face-api.js and Start Camera & GPS on load
  useEffect(() => {
    // 1. Silent GPS
    if (navigator.geolocation) {
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
      // cleanup handled at unmount
    }

    // 2. Camera
    const initCamera = async () => {
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
        }
      } catch (e) {
        toast.error("Camera access denied.");
      }
    };
    initCamera();

    // 3. Face API
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

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Real-time Employee Lookup
  useEffect(() => {
    if (!code) {
      setEmployeeName("");
      setEmployeeId("");
      return;
    }
    
    // Don't lookup if face gate is already enabled
    if (enableFaceGate) return;

    const lookupEmployee = async () => {
      const paddedCode = "ABL-" + code.padStart(5, "0");
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, employee_code')
        .or(`employee_code.ilike.%${code}%,employee_code.eq.${paddedCode}`);
        
      if (!error && data) {
        const exact = data.find(d => d.employee_code === paddedCode);
        if (exact) {
          setEmployeeName(`${exact.first_name} ${exact.last_name}`.toUpperCase());
          setEmployeeId(exact.id);
        } else if (data.length === 1) {
          setEmployeeName(`${data[0].first_name} ${data[0].last_name}`.toUpperCase());
          setEmployeeId(data[0].id);
        } else {
          setEmployeeName("");
          setEmployeeId("");
        }
      } else {
        setEmployeeName("");
        setEmployeeId("");
      }
    };
    
    const timeout = setTimeout(lookupEmployee, 150);
    return () => clearTimeout(timeout);
  }, [code, enableFaceGate]);

  // Face Detection Loop
  useEffect(() => {
    if (!enableFaceGate || !cameraReady || !faceApiLoaded || phase !== "active") return;
    
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
          
          ctx.save();
          // Draw thin green rectangle outline
          ctx.strokeStyle = '#00C853';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.rect(box.x, box.y, box.width, box.height);
          ctx.stroke();
          ctx.restore();
          
          setFaceDetected(true);
        } else {
          setFaceDetected(false);
        }
      }
    }, 500);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      const ctx = overlayCanvasRef.current?.getContext('2d');
      if (ctx && overlayCanvasRef.current) {
        ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
    };
  }, [enableFaceGate, cameraReady, faceApiLoaded, phase]);


  const playVoiceAsset = async (filename: string, fallbackText: string) => {
    try {
      const { data } = supabase.storage.from("voice-assets").getPublicUrl(filename);
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

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const resetKiosk = () => {
    setCode("");
    setEmployeeName("");
    setEmployeeId("");
    setEnableFaceGate(false);
    setFaceDetected(false);
    setMode(null);
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    const ctx = overlayCanvasRef.current?.getContext('2d');
    if (ctx && overlayCanvasRef.current) {
      ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
  };

  const handleDone = async () => {
    if (!code || enableFaceGate) return;
    setSubmitting(true);
    
    const paddedCode = "ABL-" + code.padStart(5, "0");
    
    // Exact match lookup
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('employee_code', paddedCode)
      .maybeSingle();
      
    if (error || !data) {
      playErrorBeep();
      triggerShake();
      resetKiosk();
      setSubmitting(false);
      return;
    }
    
    const fullName = `${data.first_name} ${data.last_name}`.toUpperCase();
    setEmployeeName(fullName);
    setEmployeeId(data.id);
    
    // Check today's attendance to determine IN or OUT
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); 
    const { data: att } = await supabase.from('attendance')
       .select('time_in, time_out')
       .eq('employee_id', data.id)
       .eq('date', today)
       .maybeSingle();
       
    if (!att) setMode("in");
    else if (att.time_in && !att.time_out) setMode("out");
    else setMode("in"); 
    
    await playVoiceAsset("greeting.mp3", `Hello, ${data.first_name}!`);
    setEnableFaceGate(true);
    setSubmitting(false);
  };

  const press = (k: string) => {
    if (enableFaceGate || submitting || phase !== "active") return;
    if (k === "Clear") {
      resetKiosk();
    }
    else if (k === "Done") {
      handleDone();
    }
    else setCode(c => c + k);
  };

  const captureSelfie = (): string | null => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return null;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth || 480; 
    c.height = v.videoHeight || 640;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.6);
  };

  const uploadSelfie = async (base64Image: string, empId: string): Promise<string | null> => {
    try {
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `${empId}_${Date.now()}.jpg`;
      
      const { data, error } = await supabase.storage
        .from('selfies')
        .upload(filename, buffer, { contentType: 'image/jpeg' });
        
      if (error) throw error;
      
      const { data: publicData } = supabase.storage.from('selfies').getPublicUrl(filename);
      return publicData.publicUrl;
    } catch (e) {
      console.error("Selfie upload failed", e);
      return null;
    }
  };

  const submitPunch = async () => {
    if (!faceDetected || !employeeId || !mode) return;
    setSubmitting(true);
    
    const selfieBase64 = captureSelfie();
    if (!selfieBase64) {
      toast.error("Could not capture selfie.");
      setSubmitting(false);
      return;
    }
    
    try {
      const lookup = "ABL-" + code.padStart(5, "0");
      const photoUrl = await uploadSelfie(selfieBase64, employeeId);
      
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
      const nowIso = new Date().toISOString();
      const h = new Date().getHours();
      // Simple status logic: Before 8 AM = On Time, else Late
      const status = h < 8 ? "On Time" : "Late";
      
      if (mode === "in") {
        const { error } = await supabase.from('attendance').insert({
          employee_id: employeeId,
          date: today,
          time_in: nowIso,
          photo_in_url: photoUrl,
          latitude_in: location?.lat || null,
          longitude_in: location?.lng || null,
          location_label_in: address || null,
          status: status
        });
        if (error) throw error;
        playVoiceAsset("timein_success.mp3", "Successfully timed in!");
      } else {
        // Mode out: update existing record
        const { data: existing } = await supabase.from('attendance')
          .select('id, time_in')
          .eq('employee_id', employeeId)
          .eq('date', today)
          .maybeSingle();
          
        if (existing) {
          // Compute hours
          let total_hours = 0;
          if (existing.time_in) {
            const ms = new Date(nowIso).getTime() - new Date(existing.time_in).getTime();
            total_hours = parseFloat((ms / (1000 * 60 * 60)).toFixed(2));
          }
          const { error } = await supabase.from('attendance').update({
            time_out: nowIso,
            photo_out_url: photoUrl,
            latitude_out: location?.lat || null,
            longitude_out: location?.lng || null,
            location_label_out: address || null,
            total_hours: total_hours
          }).eq('id', existing.id);
          if (error) throw error;
        } else {
          // Edge case: Time out but no time in found today
          const { error } = await supabase.from('attendance').insert({
            employee_id: employeeId,
            date: today,
            time_out: nowIso,
            photo_out_url: photoUrl,
            latitude_out: location?.lat || null,
            longitude_out: location?.lng || null,
            location_label_out: address || null,
          });
          if (error) throw error;
        }
        playVoiceAsset("timeout_success.mp3", "Successfully timed out!");
      }
      
      const timeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true });
      setSuccessInfo({ name: employeeName, time: timeStr });
      setPhase("success");
      
      setTimeout(() => {
        setPhase("active");
        resetKiosk();
        setSuccessInfo(null);
        setSubmitting(false);
      }, 3000);
      
    } catch (e: any) {
      toast.error(e.message);
      setSubmitting(false);
    }
  };

  const keys = ["1","2","3","4","5","6","7","8","9","Clear","0","Done"];

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white select-none">
      {/* LAYER 1: Fullscreen Camera Video */}
      <video
        ref={videoRef}
        playsInline muted autoPlay
        className="fixed top-0 left-0 w-[100vw] h-[100vh] object-cover z-0"
        onLoadedMetadata={() => {
          if (overlayCanvasRef.current && videoRef.current) {
            overlayCanvasRef.current.width = videoRef.current.videoWidth;
            overlayCanvasRef.current.height = videoRef.current.videoHeight;
          }
        }}
      />
      <canvas ref={overlayCanvasRef} className="fixed top-0 left-0 w-[100vw] h-[100vh] object-cover z-[15] pointer-events-none" />
      <canvas ref={canvasRef} className="hidden" />

      {/* LAYER 2: Dark Overlay */}
      <div className="fixed inset-0 bg-black/25 z-[1] pointer-events-none" />

      {/* SUCCESS OVERLAY */}
      {phase === "success" && successInfo && (
        <div className="fixed inset-0 z-[100] bg-[#00C853] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <CheckCircle className="w-32 h-32 text-white mb-6 animate-bounce" strokeWidth={1.5} />
          <h2 className="text-4xl font-bold mb-2 tracking-wide">TIMED {mode === "in" ? "IN" : "OUT"}</h2>
          <div className="text-2xl font-medium opacity-90">{successInfo.name}</div>
          <div className="text-3xl mt-4 font-mono font-bold bg-black/20 px-6 py-2 rounded-full">{successInfo.time}</div>
          
          {/* LAYER 4: Location Text shown on success only */}
          {(address || location) && (
            <div className="absolute bottom-6 left-6 text-white/80 text-xs">
              <div>{address || "Address not found"}</div>
              {location && <div className="opacity-75">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</div>}
            </div>
          )}
        </div>
      )}

      {/* LAYER 3: Top Info Bar */}
      {phase === "active" && (
        <div className="fixed top-0 left-0 right-0 z-[10] flex flex-col items-center pt-12 pointer-events-none">
          <div className="text-[32px] font-bold tracking-widest text-white drop-shadow-md mb-2">
            {enableFaceGate && mode ? `TIME ${mode.toUpperCase()}` : "TIME IN / TIME OUT"}
          </div>
          
          <div className={`text-[28px] font-mono text-white drop-shadow-md h-10 ${shake ? 'animate-shake' : ''}`}>
            {code}
          </div>
          
          <div className="text-[26px] font-bold text-white drop-shadow-md h-10 mt-1 uppercase">
            {employeeName}
          </div>
        </div>
      )}

      {/* LAYER 5: Numpad Overlay / Action Button */}
      {phase === "active" && (
        <div className="fixed inset-0 z-[20] flex flex-col items-center justify-end pb-16 pointer-events-none">
          
          {!enableFaceGate ? (
            // NUMPAD
            <div className="grid grid-cols-3 gap-6 p-6 max-w-sm w-full pointer-events-auto">
              {keys.map(k => (
                <button 
                  key={k} 
                  onClick={() => press(k)} 
                  disabled={submitting} 
                  className="h-20 min-w-[80px] rounded-none bg-transparent border-none text-white text-[36px] font-light drop-shadow-md hover:text-white/80 transition-all active:scale-95 disabled:opacity-50"
                >
                  {k === "Clear" || k === "Done" ? <span className="text-[24px] uppercase tracking-wider font-medium">{k}</span> : k}
                </button>
              ))}
            </div>
          ) : (
            // FACE GATE ACTIONS
            <div className="flex flex-col items-center gap-6 pointer-events-auto">
              <button 
                onClick={submitPunch}
                disabled={!faceDetected || submitting}
                className={`px-12 py-5 rounded-full text-2xl font-bold tracking-widest text-white transition-all shadow-xl
                  ${faceDetected && !submitting ? 'bg-[#3D2DBF] hover:bg-[#4A38E0] active:scale-95' : 'bg-[#3D2DBF]/50 opacity-50 cursor-not-allowed'}`}
              >
                {submitting ? "PROCESSING..." : `TIME ${mode?.toUpperCase()}`}
              </button>
              
              <button 
                onClick={resetKiosk}
                disabled={submitting}
                className="text-white/80 hover:text-white uppercase tracking-widest text-sm font-medium drop-shadow-md active:scale-95"
              >
                Cancel
              </button>
            </div>
          )}
          
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
