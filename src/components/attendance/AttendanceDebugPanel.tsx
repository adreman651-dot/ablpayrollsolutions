import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AttendanceDebugPanel({ employeeId, address, location, faceDetected }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState("Checking...");
  const [syncQueue, setSyncQueue] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setDbStatus(navigator.onLine ? "Online (Supabase Available)" : "Offline (SQLite Fallback)");
      
      const checkQueue = async () => {
        try {
          const { offlineQuery } = await import("@/lib/offlineDb");
          const res = await offlineQuery("SELECT COUNT(*) as cnt FROM attendance WHERE sync_status = 'pending'");
          if (res && res[0]) {
            setSyncQueue(res[0].cnt);
          }
        } catch {
          setSyncQueue(0);
        }
      };
      checkQueue();
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <div 
        className="fixed top-0 left-1/2 -translate-x-1/2 w-32 h-12 z-[100]" 
        onDoubleClick={() => setIsOpen(true)}
      />
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-[200] bg-black/90 border border-white/20 p-4 rounded-xl text-xs font-mono text-green-400 w-80 shadow-2xl backdrop-blur">
      <div className="flex justify-between items-center mb-2 border-b border-white/20 pb-1">
        <h4 className="font-bold text-white uppercase">Debug Panel</h4>
        <button onClick={() => setIsOpen(false)} className="text-red-400 font-bold px-2 py-0.5 border border-red-500 rounded bg-red-900/30 hover:bg-red-900">X</button>
      </div>
      <div className="space-y-1">
        <p><span className="text-white/50">Employee ID:</span> {employeeId || "None"}</p>
        <p><span className="text-white/50">Status:</span> {dbStatus}</p>
        <p><span className="text-white/50">SQLite Queue:</span> {syncQueue} pending</p>
        <p><span className="text-white/50">GPS:</span> {location?.lat ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : "None"}</p>
        <p><span className="text-white/50">Address:</span> {address || "None"}</p>
        <p><span className="text-white/50">Face:</span> {faceDetected ? "Detected" : "None"}</p>
      </div>
    </div>
  );
}
