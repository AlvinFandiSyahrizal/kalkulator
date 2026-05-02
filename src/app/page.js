"use client";

import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import Calculator from "@/components/Calculator";

function getOrCreateToken() {
  if (typeof window === "undefined") return null;
  let t = localStorage.getItem("kalku_session");
  if (!t || t.length < 10) { t = nanoid(32); localStorage.setItem("kalku_session", t); }
  return t;
}

export default function HomePage() {
  const [token, setToken]           = useState(null);
  const [sessionData, setSessionData] = useState({ plan:"free", usesLeft:0, canCalculate:false, hasDlc:false });
  const [ready, setReady]           = useState(false);

  useEffect(() => {
    const t = getOrCreateToken();
    setToken(t);
    fetch(`/api/usage?token=${t}`)
      .then(r => r.json())
      .then(d => { setSessionData(d); setReady(true); })
      .catch(() => setReady(true));
  }, []);

  // Handle redirect-back from Midtrans
  useEffect(() => {
    if (!token) return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("payment") === "success") {
      fetch(`/api/usage?token=${token}`).then(r=>r.json()).then(setSessionData);
      window.history.replaceState({}, "", "/");
    }
  }, [token]);

  if (!ready) return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"center",
      height:"100vh", color:"rgba(232,236,244,0.2)",
      fontFamily:"'Orbitron',monospace", fontSize:"11px", letterSpacing:"4px"
    }}>
      LOADING
    </div>
  );

  return (
    <main className="page-wrap">
      <Calculator
        sessionToken={token}
        sessionData={sessionData}
        onSessionUpdate={setSessionData}
      />
    </main>
  );
}