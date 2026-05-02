"use client";

import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import Calculator from "@/components/Calculator";

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
  const [sessionData, setSessionData] = useState({ plan: "free", usesLeft: 0, canCalculate: false });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getOrCreateSessionToken();
    setSessionToken(token);
    fetch(`/api/usage?token=${token}`)
      .then((r) => r.json())
      .then((data) => { setSessionData(data); setReady(true); })
      .catch(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!sessionToken) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      fetch(`/api/usage?token=${sessionToken}`)
        .then((r) => r.json())
        .then((data) => setSessionData(data));
      window.history.replaceState({}, "", "/");
    }
  }, [sessionToken]);

  if (!ready) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:"rgba(255,255,255,0.3)", fontSize:"13px", letterSpacing:"2px" }}>
      LOADING...
    </div>
  );

  return (
    <main className="page-wrap">
      <Calculator
        sessionToken={sessionToken}
        sessionData={sessionData}
        onSessionUpdate={setSessionData}
      />
    </main>
  );
}
