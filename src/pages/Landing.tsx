import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function Landing() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [companyName, setCompanyName] = useState("ABL PAYROLL SOLUTIONS");

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch company name from settings
  useEffect(() => {
    supabase.from("system_settings").select("value").eq("key", "company_name").maybeSingle()
      .then(({ data }) => { if (data?.value) setCompanyName(data.value); });
  }, []);

  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="landing-root">
      {/* Animated background blobs */}
      <div className="landing-blob blob-1" />
      <div className="landing-blob blob-2" />
      <div className="landing-blob blob-3" />

      <div className="landing-content">
        {/* Branding */}
        <div className="landing-brand">
          <div className="landing-logo">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <rect width="64" height="64" rx="16" fill="url(#logoGrad)" />
              <path d="M20 44V20h14a8 8 0 0 1 0 16H20m0 0h16a8 8 0 0 1 0 16H20" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="landing-company">{companyName}</h1>
          <p className="landing-subtitle">Attendance & Payroll Management System</p>
        </div>

        {/* Clock */}
        <div className="landing-clock">
          <div className="landing-time">{timeStr}</div>
          <div className="landing-date">{dateStr}</div>
        </div>

        {/* Action Buttons */}
        <div className="landing-actions">
          {/* TIME IN */}
          <button
            id="btn-time-in"
            className="landing-card card-timein"
            onClick={() => navigate("/time-in")}
          >
            <div className="card-icon-wrap timein-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="card-label">TIME IN</div>
            <div className="card-desc">Employee Attendance Check-In</div>
            <div className="card-arrow">→</div>
          </button>

          {/* TIME OUT */}
          <button
            id="btn-time-out"
            className="landing-card card-timeout"
            onClick={() => navigate("/time-out")}
          >
            <div className="card-icon-wrap timeout-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 8 14" />
              </svg>
            </div>
            <div className="card-label">TIME OUT</div>
            <div className="card-desc">Employee Attendance Check-Out</div>
            <div className="card-arrow">→</div>
          </button>

          {/* ADMIN */}
          <button
            id="btn-admin"
            className="landing-card card-admin"
            onClick={() => navigate("/auth")}
          >
            <div className="card-icon-wrap admin-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="card-label">ADMIN</div>
            <div className="card-desc">Payroll & System Administration</div>
            <div className="card-arrow">→</div>
          </button>
        </div>

        <p className="landing-footer">
          Touch a button to continue &nbsp;·&nbsp; {companyName} &copy; {now.getFullYear()}
        </p>
      </div>

      <style>{`
        .landing-root {
          min-height: 100vh;
          background: #0f172a;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', sans-serif;
        }
        .landing-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.18;
          animation: blobPulse 8s ease-in-out infinite alternate;
        }
        .blob-1 { width: 520px; height: 520px; background: #6366f1; top: -120px; left: -140px; animation-delay: 0s; }
        .blob-2 { width: 420px; height: 420px; background: #0ea5e9; bottom: -100px; right: -100px; animation-delay: 3s; }
        .blob-3 { width: 300px; height: 300px; background: #10b981; top: 50%; left: 50%; transform: translate(-50%,-50%); animation-delay: 6s; }
        @keyframes blobPulse { from { transform: scale(1) translate(0,0); } to { transform: scale(1.1) translate(10px, -10px); } }
        .blob-3 { animation-name: blobPulse3; }
        @keyframes blobPulse3 { from { transform: translate(-50%,-50%) scale(1); } to { transform: translate(-50%,-50%) scale(1.12); } }

        .landing-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
          padding: 2rem 1.5rem;
          width: 100%;
          max-width: 900px;
        }
        .landing-brand { text-align: center; }
        .landing-logo {
          width: 72px; height: 72px;
          margin: 0 auto 1rem;
          border-radius: 20px;
          box-shadow: 0 0 40px rgba(99,102,241,0.5);
          animation: logoGlow 3s ease-in-out infinite alternate;
        }
        @keyframes logoGlow { from { box-shadow: 0 0 30px rgba(99,102,241,0.4); } to { box-shadow: 0 0 60px rgba(99,102,241,0.75); } }
        .landing-company {
          font-size: clamp(1.4rem, 4vw, 2.2rem);
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .landing-subtitle {
          font-size: 0.9rem;
          color: #94a3b8;
          margin: 0.25rem 0 0;
          letter-spacing: 0.04em;
        }

        .landing-clock {
          text-align: center;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 1rem 2.5rem;
          backdrop-filter: blur(12px);
        }
        .landing-time {
          font-size: clamp(2rem, 8vw, 3.8rem);
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.04em;
          line-height: 1.1;
          font-variant-numeric: tabular-nums;
        }
        .landing-date {
          font-size: 0.9rem;
          color: #94a3b8;
          margin-top: 0.25rem;
        }

        .landing-actions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
          width: 100%;
        }
        @media (max-width: 640px) {
          .landing-actions { grid-template-columns: 1fr; }
        }

        .landing-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          padding: 2rem 1.25rem 1.5rem;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(16px);
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
          text-align: center;
          overflow: hidden;
        }
        .landing-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 24px;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .landing-card:hover { transform: translateY(-6px); }
        .landing-card:active { transform: translateY(-2px) scale(0.98); }

        .card-timein:hover { border-color: rgba(16,185,129,0.5); box-shadow: 0 20px 60px rgba(16,185,129,0.2); background: rgba(16,185,129,0.06); }
        .card-timeout:hover { border-color: rgba(239,68,68,0.5); box-shadow: 0 20px 60px rgba(239,68,68,0.2); background: rgba(239,68,68,0.06); }
        .card-admin:hover  { border-color: rgba(99,102,241,0.5); box-shadow: 0 20px 60px rgba(99,102,241,0.2); background: rgba(99,102,241,0.06); }

        .card-icon-wrap {
          width: 72px; height: 72px;
          border-radius: 20px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 0.25rem;
        }
        .timein-icon { background: rgba(16,185,129,0.15); color: #10b981; }
        .timeout-icon { background: rgba(239,68,68,0.15); color: #ef4444; }
        .admin-icon  { background: rgba(99,102,241,0.15); color: #818cf8; }

        .card-label {
          font-size: 1.35rem;
          font-weight: 800;
          color: #fff;
          letter-spacing: 0.06em;
        }
        .card-timein .card-label { color: #10b981; }
        .card-timeout .card-label { color: #ef4444; }
        .card-admin .card-label  { color: #818cf8; }

        .card-desc {
          font-size: 0.8rem;
          color: #94a3b8;
          line-height: 1.4;
        }
        .card-arrow {
          font-size: 1.2rem;
          color: #475569;
          margin-top: 0.5rem;
          transition: transform 0.2s, color 0.2s;
        }
        .landing-card:hover .card-arrow { transform: translateX(4px); color: #94a3b8; }

        .landing-footer {
          font-size: 0.75rem;
          color: #475569;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
