"use client";

import { useState, useEffect, useRef } from "react";

const PRICES = {
  trial:    parseInt(process.env.NEXT_PUBLIC_PRICE_TRIAL)    || 10000,
  dlc:      parseInt(process.env.NEXT_PUBLIC_PRICE_DLC)      || 50000,
  lifetime: parseInt(process.env.NEXT_PUBLIC_PRICE_LIFETIME) || 100000,
};
const TRIAL_USES = parseInt(process.env.NEXT_PUBLIC_TRIAL_USES) || 10;

// Which plans to show based on paywall type
const PLAN_CONFIG = {
  result: [
    {
      id: "trial",
      name: "Standard Edition",
      price: PRICES.trial,
      desc: `${TRIAL_USES}× unlock hasil kalkulasi`,
      tag: null,
      color: "var(--ea-blue)",
    },
    {
      id: "lifetime",
      name: "Ultimate Edition",
      price: PRICES.lifetime,
      desc: "Hasil kalkulasi unlimited selamanya",
      tag: "BEST VALUE",
      color: "var(--ea-orange)",
    },
  ],
  dlc: [
    {
      id: "dlc",
      name: "Advanced Math DLC",
      price: PRICES.dlc,
      desc: "√ ∛ log sin cos tan n! FPB KPK dan lainnya — permanent",
      tag: "DLC PACK",
      color: "var(--ea-gold)",
    },
  ],
};

const RESULT_MEMES = [
  "Fitur ini memerlukan pembelian terpisah.",
  "Hasil kalkulasi dijual secara terpisah dari soalnya.",
  "Hasilnya sudah selesai dihitung. Beli sekarang untuk melihatnya!",
  "Kalkulator dasar gratis. Hasilnya dijual terpisah.",
  "Untuk melihat jawaban, diperlukan kartu kredit yang sehat.",
];
const DLC_MEMES = [
  "Fitur matematika lanjutan ini tersedia sebagai DLC opsional.",
  "Sin, cos, tan — semuanya dijual terpisah.",
  "Rumus ini tidak termasuk dalam paket dasar.",
  "Upgrade ke DLC Pack untuk membuka fitur ini.",
];

export default function PaywallModal({ isOpen, type, onClose, onSuccess, sessionToken, sessionData }) {
  const plans = PLAN_CONFIG[type] || PLAN_CONFIG.result;
  const [selected, setSelected]   = useState(plans[0]?.id);
  const [phase, setPhase]         = useState("reveal");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState("");
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const memeRef = useRef("");

  useEffect(() => {
    if (!isOpen) return;
    const memes = type === "dlc" ? DLC_MEMES : RESULT_MEMES;
    memeRef.current = memes[Math.floor(Math.random() * memes.length)];
    setPhase("reveal");
    setError("");
    setIsLoading(false);
    setSelected(plans[0]?.id);

    // Fanfare
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = type === "dlc"
        ? [ // DLC: rising arpeggio
            { f:440, s:0.0, d:0.12 }, { f:554, s:0.12, d:0.12 },
            { f:659, s:0.24, d:0.12 }, { f:880, s:0.36, d:0.5 },
          ]
        : [ // Result locked: triumphant
            { f:523, s:0.0,  d:0.15 }, { f:659, s:0.15, d:0.15 },
            { f:784, s:0.3,  d:0.15 }, { f:1047,s:0.45, d:0.45 },
            { f:880, s:0.9,  d:0.15 }, { f:1047,s:1.05, d:0.6  },
          ];
      notes.forEach(({ f, s, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, ctx.currentTime + s);
        gain.gain.setValueAtTime(0, ctx.currentTime + s);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + s + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + s + d);
        osc.start(ctx.currentTime + s);
        osc.stop(ctx.currentTime + s + d + 0.05);
      });
    } catch { /* blocked */ }

    const t = setTimeout(() => setPhase("purchase"), type === "dlc" ? 1600 : 2200);
    return () => clearTimeout(t);
  }, [isOpen, type]);

  // Polling
  useEffect(() => {
    if (!pendingOrderId || phase !== "polling") return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment/verify?orderId=${pendingOrderId}&token=${sessionToken}`);
        const data = await res.json();
        if (data.isSuccess) {
          clearInterval(iv);
          onSuccess({ plan: data.plan, usesLeft: data.usesLeft, hasDlc: data.hasDlc, canCalculate: data.canCalculate });
        } else if (data.status === "failed") {
          clearInterval(iv);
          setError("Pembayaran gagal atau dibatalkan.");
          setPhase("purchase");
        }
      } catch { /* keep */ }
    }, 2000);
    return () => clearInterval(iv);
  }, [pendingOrderId, phase]);

  // Load Midtrans once
  useEffect(() => {
    const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true";
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
    const snapUrl = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    if (!document.getElementById("midtrans-snap")) {
      const s = document.createElement("script");
      s.id = "midtrans-snap"; s.src = snapUrl;
      s.setAttribute("data-client-key", clientKey);
      document.head.appendChild(s);
    }
  }, []);

  const handleBuy = async () => {
    setIsLoading(true); setError("");
    try {
      const res = await fetch("/api/payment/create", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ plan: selected, sessionToken }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Gagal membuat transaksi."); setIsLoading(false); return; }
      setPendingOrderId(data.orderId);
      if (window.snap) {
        window.snap.pay(data.snapToken, {
          onSuccess: ()   => { setPhase("polling"); setIsLoading(false); },
          onPending:  ()  => { setPhase("polling"); setIsLoading(false); },
          onError:    ()  => { setError("Pembayaran gagal."); setIsLoading(false); },
          onClose:    ()  => { setIsLoading(false); if (data.orderId) setPhase("polling"); },
        });
      } else {
        window.location.href = data.redirectUrl;
      }
    } catch { setError("Gagal terhubung ke server."); setIsLoading(false); }
  };

  if (!isOpen) return null;

  const selectedPlan = plans.find(p => p.id === selected);

  return (
    <div className="pw-overlay" onClick={(e) => e.target === e.currentTarget && phase==="purchase" && onClose()}>
      <div className="pw-box">

        {/* ── REVEAL ── */}
        {phase === "reveal" && (
          <div className="pw-reveal">
            <div className="pw-reveal-bg" />
            <div className="pw-ea-giant">{type === "dlc" ? "DLC" : "EA"}</div>
            <div className="pw-reveal-sub">
              {type === "dlc" ? "ADVANCED MATH PACK" : "PURCHASE REQUIRED"}
            </div>
            <div className="pw-scanlines" />
          </div>
        )}

        {/* ── PURCHASE ── */}
        {phase === "purchase" && (
          <div className="pw-purchase">
            {/* Header */}
            <div className="pw-purchase-header">
              <div className="pw-ea-badge">{type === "dlc" ? "DLC" : "EA"}</div>
              <div>
                <div className="pw-purchase-title">
                  {type === "dlc" ? "ADVANCED MATH PACK" : "RESULT LOCKED"}
                </div>
                <div className="pw-purchase-meme">{memeRef.current}</div>
              </div>
            </div>

            {/* Plans */}
            <div className="pw-plans">
              {plans.map(plan => (
                <div
                  key={plan.id}
                  className={`pw-plan-card${selected === plan.id ? " pw-plan-selected" : ""}`}
                  style={{ "--plan-color": plan.color }}
                  onClick={() => setSelected(plan.id)}
                >
                  {plan.tag && <div className="pw-plan-tag">{plan.tag}</div>}
                  <div className="pw-plan-radio">{selected===plan.id?"●":"○"}</div>
                  <div className="pw-plan-body">
                    <div className="pw-plan-name">{plan.name}</div>
                    <div className="pw-plan-desc">{plan.desc}</div>
                  </div>
                  <div className="pw-plan-price" style={{ color: plan.color }}>
                    Rp {plan.price.toLocaleString("id-ID")}
                  </div>
                </div>
              ))}

              {/* Upsell: show other options as secondary */}
              {type === "result" && (
                <div className="pw-upsell">
                  <span className="pw-upsell-text">
                    💡 Butuh sin cos tan dan fitur lanjutan?{" "}
                    <strong>Advanced Math DLC</strong> dijual terpisah — Rp {PRICES.dlc.toLocaleString("id-ID")}
                  </span>
                </div>
              )}
              {type === "dlc" && (
                <div className="pw-upsell">
                  <span className="pw-upsell-text">
                    💡 Mau hasil kalkulasi tidak kena paywall?{" "}
                    <strong>Ultimate Edition</strong> Rp {PRICES.lifetime.toLocaleString("id-ID")} — beli terpisah.
                  </span>
                </div>
              )}
            </div>

            {error && <div className="pw-error">{error}</div>}

            <div className="pw-actions">
              <button className="pw-btn-buy" onClick={handleBuy} disabled={isLoading}
                style={{ background: selectedPlan?.color || "var(--ea-orange)" }}>
                {isLoading ? "MEMUAT..." : `BELI SEKARANG — Rp ${selectedPlan?.price.toLocaleString("id-ID")}`}
              </button>
              <button className="pw-btn-skip" onClick={onClose}>
                Nanti saja (fitur tetap terkunci)
              </button>
            </div>

            <div className="pw-legal">
              Proyek parodi · Tidak berafiliasi dengan EA Games ·
              Uang untuk biaya server, bukan yacht
            </div>
          </div>
        )}

        {/* ── POLLING ── */}
        {phase === "polling" && (
          <div className="pw-polling">
            <div className="pw-ea-badge" style={{ fontSize:"28px", margin:"0 auto 20px" }}>EA</div>
            <div className="pw-poll-spinner" />
            <div className="pw-poll-text">Memverifikasi pembelian...</div>
            <div className="pw-poll-sub">Jangan tutup jendela ini</div>
          </div>
        )}
      </div>
    </div>
  );
}