"use client";

// components/PaywallModal.js
import { useState, useEffect } from "react";

const PRICE_TRIAL = parseInt(process.env.NEXT_PUBLIC_PRICE_TRIAL) || 10000;
const PRICE_LIFETIME = parseInt(process.env.NEXT_PUBLIC_PRICE_LIFETIME) || 50000;
const TRIAL_USES = parseInt(process.env.NEXT_PUBLIC_TRIAL_USES) || 10;

const EA_MEMES = [
  "Fitur ini memerlukan pembelian terpisah.",
  "Hasil kalkulasi dijual secara terpisah dari soalnya.",
  "Untuk melihat jawaban, diperlukan koneksi internet dan kartu kredit.",
  "Hasilnya sudah selesai dihitung. Beli sekarang untuk melihatnya!",
  "Operasi matematika ini tersedia sebagai DLC opsional.",
  "Kalkulator dasar gratis. Hasilnya dijual terpisah.",
];

export default function PaywallModal({
  isOpen,
  onClose,
  onSuccess,
  sessionToken,
  currentPlan,
  usesLeft,
}) {
  const [selectedPlan, setSelectedPlan] = useState("trial");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [meme] = useState(() => EA_MEMES[Math.floor(Math.random() * EA_MEMES.length)]);
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

  // Load Midtrans Snap script
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

  // Polling setelah payment (untuk kasus redirect)
  useEffect(() => {
    if (!pendingOrderId || !isPolling) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/payment/verify?orderId=${pendingOrderId}&token=${sessionToken}`
        );
        const data = await res.json();

        if (data.isSuccess) {
          clearInterval(interval);
          setIsPolling(false);
          setPendingOrderId(null);
          onSuccess(data);
        } else if (data.status === "failed") {
          clearInterval(interval);
          setIsPolling(false);
          setError("Pembayaran gagal atau dibatalkan.");
        }
      } catch {
        // Tetap polling
      }
    }, 2000); // cek setiap 2 detik

    return () => clearInterval(interval);
  }, [pendingOrderId, isPolling, sessionToken, onSuccess]);

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

      if (!res.ok) {
        setError(data.error || "Gagal membuat transaksi.");
        setIsLoading(false);
        return;
      }

      setPendingOrderId(data.orderId);

      // Buka Midtrans Snap popup
      if (window.snap) {
        window.snap.pay(data.snapToken, {
          onSuccess: (result) => {
            console.log("Payment success:", result);
            setIsPolling(true); // mulai polling sampai webhook konfirmasi
          },
          onPending: (result) => {
            console.log("Payment pending:", result);
            setIsPolling(true);
          },
          onError: (result) => {
            console.error("Payment error:", result);
            setError("Pembayaran gagal. Coba lagi.");
            setIsLoading(false);
          },
          onClose: () => {
            console.log("Snap ditutup");
            setIsLoading(false);
            // Tetap polling kalau order sudah dibuat
            if (pendingOrderId) setIsPolling(true);
          },
        });
      } else {
        // Fallback: redirect ke halaman Midtrans
        window.location.href = data.redirectUrl;
      }
    } catch {
      setError("Gagal terhubung. Periksa koneksi internet.");
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-logo">EA</div>
          <h2 className="modal-title">KONTEN PREMIUM DIPERLUKAN</h2>
          <p className="modal-meme">&ldquo;{meme}&rdquo;</p>
        </div>

        {/* Polling state */}
        {isPolling && (
          <div className="polling-notice">
            <div className="spinner" />
            Menunggu konfirmasi pembayaran...
          </div>
        )}

        {!isPolling && (
          <>
            {/* Plan selector */}
            <div className="plan-grid">
              {/* Trial */}
              <div
                className={`plan-card ${selectedPlan === "trial" ? "selected" : ""}`}
                onClick={() => setSelectedPlan("trial")}
              >
                <div className="plan-tag">STARTER PACK</div>
                <div className="plan-name">Trial</div>
                <div className="plan-price">
                  Rp {PRICE_TRIAL.toLocaleString("id-ID")}
                </div>
                <ul className="plan-features">
                  <li>✓ {TRIAL_USES}x kalkulasi</li>
                  <li>✓ Semua operasi matematika</li>
                  <li>✗ Tidak berlaku selamanya</li>
                  <li>✗ Hasil kalkulasi kedaluwarsa?</li>
                </ul>
                <div className="plan-disclaimer">
                  *Hasil hanya boleh dilihat {TRIAL_USES} kali
                </div>
              </div>

              {/* Lifetime */}
              <div
                className={`plan-card featured ${selectedPlan === "lifetime" ? "selected" : ""}`}
                onClick={() => setSelectedPlan("lifetime")}
              >
                <div className="plan-tag popular">PALING POPULER ⭐</div>
                <div className="plan-name">Ultimate Edition</div>
                <div className="plan-price">
                  Rp {PRICE_LIFETIME.toLocaleString("id-ID")}
                </div>
                <ul className="plan-features">
                  <li>✓ Kalkulasi unlimited</li>
                  <li>✓ Semua operasi matematika</li>
                  <li>✓ Berlaku selamanya*</li>
                  <li>✓ Akses semua DLC future</li>
                </ul>
                <div className="plan-disclaimer">
                  *Selama server kami masih hidup
                </div>
              </div>
            </div>

            {/* Error */}
            {error && <div className="modal-error">⚠ {error}</div>}

            {/* CTA */}
            <button
              className="modal-buy-btn"
              onClick={handleBuy}
              disabled={isLoading}
            >
              {isLoading
                ? "MEMUAT PAYMENT GATEWAY..."
                : `BELI SEKARANG — Rp ${(selectedPlan === "trial" ? PRICE_TRIAL : PRICE_LIFETIME).toLocaleString("id-ID")}`}
            </button>

            <button className="modal-close-btn" onClick={onClose}>
              Nanti saja (Kalkulator tetap tidak akan bisa dipakai)
            </button>

            <p className="modal-footer-text">
              Dengan membeli, kamu setuju bahwa ini adalah lelucon dan tidak ada yang tersakiti.
              Uang nyata tetap dibutuhkan karena server tidak gratis. EA tidak berafiliasi dengan proyek ini.
            </p>
          </>
        )}
      </div>
    </div>
  );
}