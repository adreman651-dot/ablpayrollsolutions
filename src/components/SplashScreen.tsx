import { useEffect, useState } from "react";
import splashAsset from "@/assets/abl-splash.png.asset.json";

/**
 * Full-screen splash. Splits the source poster into a left and right half
 * that slide in from off-screen and "connect" in the middle — so the human
 * hand and the AI robot hand appear to move toward each other and meet,
 * with a pulsing spark where their fingertips touch.
 * Fits both desktop (letterboxed on dark bg) and mobile/Android (object-contain).
 */
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setLeaving(true), 3200);
    const t2 = window.setTimeout(onDone, 3900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-[#05021a] flex items-center justify-center overflow-hidden transition-opacity duration-700 ${leaving ? "opacity-0 pointer-events-none" : "opacity-100"}`}
    >
      {/* Ambient gradient backdrop so it fills any aspect ratio (desktop + android) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,#1e1b4b_0%,#05021a_70%)]" />

      {/* Stage that holds both halves of the poster.
          Mobile/portrait: fills the whole viewport (cover) — no black bars on Android.
          Desktop/landscape: letterboxed via aspect-ratio so the full poster is visible. */}
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="splash-stage relative">
          {/* Left half slides in from the left */}
          <img
            src={splashAsset.url}
            alt=""
            aria-hidden
            className="splash-img absolute inset-0 w-full h-full splash-left"
            style={{ clipPath: "inset(0 50% 0 0)", objectPosition: "50% 35%" }}
            draggable={false}
          />
          {/* Right half slides in from the right */}
          <img
            src={splashAsset.url}
            alt="ABL Payroll Solutions"
            className="splash-img absolute inset-0 w-full h-full splash-right"
            style={{ clipPath: "inset(0 0 0 50%)", objectPosition: "50% 35%" }}
            draggable={false}
          />

          {/* Connection spark — pulses at the point where the fingertips meet */}
          <div className="splash-spark-wrap absolute left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="splash-spark w-24 h-24 rounded-full bg-[radial-gradient(circle,#ffffff_0%,#a78bfa_30%,rgba(124,58,237,0)_70%)]" />
          </div>
        </div>
      </div>

      <style>{`
        /* Default (mobile / portrait): fill the entire Android screen */
        .splash-stage {
          width: 100vw;
          height: 100vh;
          height: 100dvh;
        }
        .splash-img { object-fit: cover; }
        .splash-spark-wrap { top: 50%; }

        /* Tablet & desktop landscape: letterbox so the full poster shows */
        @media (min-width: 768px) and (orientation: landscape) {
          .splash-stage {
            width: auto;
            height: 100vh;
            aspect-ratio: 945 / 1536;
            max-width: 100vw;
          }
          .splash-img { object-fit: contain; }
          .splash-spark-wrap { top: 63%; }
        }

        @keyframes splashSlideLeft {
          0%   { transform: translateX(-30%); opacity: 0; }
          55%  { transform: translateX(-2%); opacity: 1; }
          70%  { transform: translateX(-2%); }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes splashSlideRight {
          0%   { transform: translateX(30%); opacity: 0; }
          55%  { transform: translateX(2%); opacity: 1; }
          70%  { transform: translateX(2%); }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes splashSpark {
          0%, 60%  { transform: scale(0); opacity: 0; }
          75%      { transform: scale(1.4); opacity: 1; }
          85%      { transform: scale(0.9); opacity: 0.9; }
          100%     { transform: scale(1.6); opacity: 0.85; }
        }
        .splash-left  { animation: splashSlideLeft  2.4s cubic-bezier(.22,.9,.27,1) forwards; }
        .splash-right { animation: splashSlideRight 2.4s cubic-bezier(.22,.9,.27,1) forwards; }
        .splash-spark { animation: splashSpark 2.6s ease-out forwards; filter: blur(1px); }
      `}</style>
    </div>
  );
}
