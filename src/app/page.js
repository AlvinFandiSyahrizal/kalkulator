"use client";

// app/page.js
import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import Calculator from "@/components/Calculator";

// Generate atau ambil session token dari localStorage
function getOrCreateSessionToken() {
  if (typeof window === "undefined") return null;
  let token = localStorage.getItem("kalku_session");
  if (!token || token.length < 10) {
    token = nanoid(32);
    localStorage.setItem("kalku_session", token);
  }
  return token;
}

export default function HomePage() {
  const [sessionToken, setSessionToken] = useState(null);
  const [sessionData, setSessionData] = useState({
    plan: "free",
    usesLeft: 0,
    canCalculate: false,
  });
  const [isInitializing, setIsInitializing] = useState(true);

  // Inisialisasi session
  useEffect(() => {
    const token = getOrCreateSessionToken();
    setSessionToken(token);

    // Cek status sesi dari server
    fetch(`/api/usage?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        setSessionData(data);
        setIsInitializing(false);
      })
      .catch(() => {
        setIsInitializing(false);
      });
  }, []);

  // Handle parameter dari redirect payment
  useEffect(() => {
    if (!sessionToken) return;
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    const orderId = params.get("order");

    if (paymentStatus === "success" && orderId) {
      // Refresh session data
      fetch(`/api/usage?token=${sessionToken}`)
        .then((r) => r.json())
        .then((data) => setSessionData(data));

      // Bersihkan URL
      window.history.replaceState({}, "", "/");
    }
  }, [sessionToken]);

  if (isInitializing) {
    return (
      <div className="loading-screen">
        <div className="ea-logo-big">EA</div>
        <div className="loading-text">MEMUAT DLC...</div>
        <div className="loading-bar">
          <div className="loading-bar-fill" />
        </div>
      </div>
    );
  }

  return (
    <main className="main-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-ea-logo">EA</div>
        <div className="header-titles">
          <h1 className="app-title">KALKUPAYLATOR™</h1>
          <p className="app-subtitle">
            FIFA Math Edition · Powered by EA Microtransaction Engine™
          </p>
        </div>
        <div className="header-rating">
          <span>PEGI</span>
          <span className="rating-age">3+</span>
          <span className="rating-desc">Konten\nPremium</span>
        </div>
      </header>

      {/* Main Calculator */}
      <Calculator
        sessionToken={sessionToken}
        sessionData={sessionData}
        onSessionUpdate={setSessionData}
      />

      {/* Footer */}
      <footer className="app-footer">
        <p>
          © 2025 KalkuPaylator Corp. — Divisi Electronic Arithmetic™
        </p>
        <p>
          Kalkulator ini memerlukan koneksi internet dan dompet yang sehat.
          Hasil kalkulasi dapat berbeda tergantung server mood.
        </p>
        <p className="disclaimer">
          Ini adalah project parodi. Tidak berafiliasi dengan EA Games.
          Uang yang dibayarkan digunakan untuk biaya server hosting, bukan untuk membeli yacht.
        </p>
      </footer>
    </main>
  );
}