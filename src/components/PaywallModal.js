"use client";

import { useState, useEffect, useRef } from "react";

const PRICE_TRIAL = parseInt(process.env.NEXT_PUBLIC_PRICE_TRIAL) || 10000;
const PRICE_LIFETIME = parseInt(process.env.NEXT_PUBLIC_PRICE_LIFETIME) || 50000;
const TRIAL_USES = parseInt(process.env.NEXT_PUBLIC_TRIAL_USES) || 10;

export default function PaywallModal({ isOpen, onClose, onSuccess, sessionToken, currentPlan, usesLeft }) {
  const [selectedPlan, setSelectedPlan] = useState("trial");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("reveal"); // "reveal" | "purchase" | "polling"
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const audioCtxRef = useRef(null);

  // Load Midtrans Snap
  useEffect(() => {
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
    const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true";
    const snapUrl = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    if (!document.getElementById("midtrans-snap")) {
      const script = document.createElement("script");
      script.id = "midtrans-snap";
      script.src = snapUrl;
      script.setAttribute("data-client-key", clientKey);
      document.head.appendChild(script);
    }
  }, []);

  // Play EA fanfare using Web Audio API
  useEffect(() => {
    if (!isOpen) return;
    setPhase("reveal");

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;

      // EA-style triumphant fanfare notes
      const notes = [
        { freq: 523.25, start: 0.0, dur: 0.15 },   // C5
        { freq: 659.25, start: 0.15, dur: 0.15 },  // E5
        { freq: 783.99, start: 0.3, dur: 0.15 },   // G5
        { freq: 1046.5, start: 0.45, dur: 0.4 },   // C6 — long hold
        { freq: 880.0,  start: 0.85, dur: 0.15 },  // A5
        { freq: 1046.5, start: 1.0, dur: 0.6 },    // C6 — finale
      ];

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur + 0.05);
      });
    } catch { /* audio blocked, skip */ }

    // After reveal animation, show purchase UI
    const t = setTimeout(() => setPhase("purchase"), 2200);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Polling
  useEffect(() => {
    if (!pendingOrderId || phase !== "polling") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment/verify?orderId=${pendingOrderId}&token=${sessionToken}`);
        const data = await res.json();
        if (data.isSuccess) {
          clearInterval(interval);
          onSuccess({ plan: data.plan, usesLeft: data.usesLeft });
        } else if (data.status === "failed") {
          clearInterval(interval);
          setError("Pembayaran gagal atau dibatalkan.");
          setPhase("purchase");
        }
      } catch { /* keep polling */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [pendingOrderId, phase, sessionToken, onSuccess]);

  const handleBuy = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan, sessionToken }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Gagal."); setIsLoading(false); return; }
      setPendingOrderId(data.orderId);
      if (window.snap) {
        window.snap.pay(data.snapToken, {
          onSuccess: () => { setPhase("polling"); setIsLoading(false); },
          onPending: () => { setPhase("polling"); setIsLoading(false); },
          onError: () => { setError("Pembayaran gagal."); setIsLoading(false); },
          onClose: () => { setIsLoading(false); if (pendingOrderId) setPhase("polling"); },
        });
      } else {
        window.location.href = data.redirectUrl;
      }
    } catch {
      setError("Gagal terhubung.");
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="pw-overlay">
      <div className={`pw-box ${phase === "reveal" ? "pw-reveal" : ""}`}>

        {/* ── PHASE: REVEAL ── */}
        {phase === "reveal" && (
          <div className="pw-fanfare">
            <div className="pw-ea-logo">EA</div>
            <div className="pw-fanfare-text">PURCHASE REQUIRED</div>
            <div className="pw-scanline" />
          </div>
        )}

        {/* ── PHASE: PURCHASE ── */}
        {phase === "purchase" && (
          <div className="pw-content">
            <div className="pw-header">
              <div className="pw-ea-small">EA</div>
              <div className="pw-title-group">
                <h2 className="pw-title">RESULT LOCKED</h2>
                <p className="pw-sub">This feature requires a separate purchase.</p>
              </div>
            </div>

            <div className="pw-divider" />

            <div className="pw-plans">
              {/* Trial */}
              <div
                className={`pw-plan ${selectedPlan === "trial" ? "pw-plan-active" : ""}`}
                onClick={() => setSelectedPlan("trial")}
              >
                <div className="pw-plan-check">{selectedPlan === "trial" ? "●" : "○"}</div>
                <div className="pw-plan-info">
                  <div className="pw-plan-name">Standard Edition</div>
                  <div className="pw-plan-desc">{TRIAL_USES}× result unlocks</div>
                </div>
                <div className="pw-plan-price">Rp {PRICE_TRIAL.toLocaleString("id-ID")}</div>
              </div>

              {/* Lifetime */}
              <div
                className={`pw-plan pw-plan-featured ${selectedPlan === "lifetime" ? "pw-plan-active" : ""}`}
                onClick={() => setSelectedPlan("lifetime")}
              >
                <div className="pw-plan-badge">BEST VALUE</div>
                <div className="pw-plan-check">{selectedPlan === "lifetime" ? "●" : "○"}</div>
                <div className="pw-plan-info">
                  <div className="pw-plan-name">Ultimate Edition</div>
                  <div className="pw-plan-desc">Unlimited · Lifetime access</div>
                </div>
                <div className="pw-plan-price">Rp {PRICE_LIFETIME.toLocaleString("id-ID")}</div>
              </div>
            </div>

            {error && <div className="pw-error">{error}</div>}

            <button className="pw-buy-btn" onClick={handleBuy} disabled={isLoading}>
              {isLoading ? "LOADING..." : `UNLOCK NOW — Rp ${(selectedPlan === "trial" ? PRICE_TRIAL : PRICE_LIFETIME).toLocaleString("id-ID")}`}
            </button>

            <button className="pw-skip-btn" onClick={onClose}>
              Maybe later (calculator will remain locked)
            </button>

            <p className="pw-legal">
              *This is a parody project. Not affiliated with EA Games.
              Payment goes to server costs, not yachts.
            </p>
          </div>
        )}

        {/* ── PHASE: POLLING ── */}
        {phase === "polling" && (
          <div className="pw-polling">
            <div className="pw-ea-small">EA</div>
            <div className="pw-spinner" />
            <p>Verifying purchase...</p>
            <p className="pw-polling-sub">Please do not close this window</p>
          </div>
        )}
      </div>
    </div>
  );
}