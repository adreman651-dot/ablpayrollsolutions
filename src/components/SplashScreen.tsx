import { useEffect, useState } from "react";

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setLeaving(true), 3200);
    const t2 = window.setTimeout(onDone, 3900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden transition-opacity duration-700 ${leaving ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      style={{ background: "radial-gradient(ellipse at center, #0a0e27 0%, #050714 100%)", fontFamily: "'Segoe UI', Arial, sans-serif" }}
    >
      <div className="splash-container relative flex flex-col items-center justify-center px-6 text-center">
        <span className="ring" />
        <span className="ring r2" />
        <span className="ring r3" />
        <span className="glow-dot" />

        <h1 className="logo-text">ABL</h1>
        <div className="subtitle">SOFTWARE SOLUTIONS</div>
        <div className="divider" />
        <div className="services">
          PAYROLL <span>•</span> ACCOUNTING <span>•</span> SALES <span>•</span> MARKETING
        </div>
      </div>

      <style>{`
        .ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(79,195,247,0.35);
          width: 220px; height: 220px;
          top: 50%; left: 50%;
          margin-top: -110px; margin-left: -110px;
          animation: splashPulse 2.4s ease-out infinite;
        }
        .ring.r2 { animation-delay: 0.8s; }
        .ring.r3 { animation-delay: 1.6s; }
        @keyframes splashPulse {
          0% { transform: scale(0.7); opacity: 0.7; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .logo-text {
          font-size: clamp(64px, 16vw, 110px);
          font-weight: 900;
          letter-spacing: 6px;
          margin: 0;
          opacity: 0; transform: scale(0.7);
          animation: splashPopIn 1s cubic-bezier(.2,.9,.3,1.3) forwards 0.3s;
          background: linear-gradient(180deg,#ffffff 0%,#d8e6f5 35%,#7fb8e8 55%,#3a6fa8 75%,#1a3a5c 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
          filter: drop-shadow(0 0 18px rgba(79,195,247,0.5));
          position: relative; z-index: 2;
        }
        .subtitle {
          margin-top: 6px;
          font-size: clamp(14px, 3.2vw, 22px);
          font-weight: 600; letter-spacing: 5px;
          opacity: 0;
          animation: splashFadeUp 0.8s ease forwards 1.2s;
          background: linear-gradient(90deg,#4fc3f7,#7c4dff,#4fc3f7);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .divider {
          width: 0; height: 1px;
          background: linear-gradient(90deg, transparent, #4fc3f7, transparent);
          margin: 16px 0;
          animation: splashGrowLine 0.8s ease forwards 1.5s;
        }
        .services {
          font-size: clamp(10px, 2.4vw, 12px);
          letter-spacing: 3px; color: #d8e6f5;
          opacity: 0;
          animation: splashFadeUp 0.8s ease forwards 1.7s;
        }
        .services span { color: #4fc3f7; margin: 0 4px; }
        .glow-dot {
          position: absolute; width: 6px; height: 6px;
          background: #fff; border-radius: 50%;
          top: 50%; left: 50%;
          transform: translate(-50%,-50%);
          box-shadow: 0 0 30px 12px rgba(79,195,247,0.7);
          opacity: 0;
          animation: splashFlash 1s ease forwards;
        }
        @keyframes splashPopIn {
          0% { opacity: 0; transform: scale(0.6); }
          60% { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes splashFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashGrowLine {
          from { width: 0; }
          to { width: min(260px, 70vw); }
        }
        @keyframes splashFlash {
          0% { opacity: 0; transform: translate(-50%,-50%) scale(0.2); }
          40% { opacity: 1; transform: translate(-50%,-50%) scale(1.3); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(0.4); }
        }
      `}</style>
    </div>
  );
}
