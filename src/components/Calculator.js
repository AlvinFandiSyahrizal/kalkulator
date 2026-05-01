"use client";

// components/Calculator.js
import { useState, useCallback } from "react";
import PaywallModal from "./PaywallModal";

// =====================================================
// OPERASI MATEMATIKA
// =====================================================
const OPERATIONS = {
  basic: [
    { id: "add", label: "+", symbol: "+" },
    { id: "sub", label: "−", symbol: "-" },
    { id: "mul", label: "×", symbol: "*" },
    { id: "div", label: "÷", symbol: "/" },
    { id: "mod", label: "%", symbol: "%" },
    { id: "pow", label: "xⁿ", symbol: "**" },
  ],
  advanced: [
    { id: "sqrt", label: "√", unary: true, fn: (a) => Math.sqrt(a) },
    { id: "cbrt", label: "∛", unary: true, fn: (a) => Math.cbrt(a) },
    { id: "factorial", label: "n!", unary: true, fn: factorial },
    { id: "log", label: "log₁₀", unary: true, fn: (a) => Math.log10(a) },
    { id: "ln", label: "ln", unary: true, fn: (a) => Math.log(a) },
    { id: "sin", label: "sin", unary: true, fn: (a) => Math.sin((a * Math.PI) / 180) },
    { id: "cos", label: "cos", unary: true, fn: (a) => Math.cos((a * Math.PI) / 180) },
    { id: "tan", label: "tan", unary: true, fn: (a) => Math.tan((a * Math.PI) / 180) },
    { id: "gcd", label: "FPB", fn: gcd },
    { id: "lcm", label: "KPK", fn: lcm },
    { id: "prime", label: "Prima?", unary: true, fn: isPrime },
    { id: "factors", label: "Faktor", unary: true, fn: primeFactors },
  ],
};

// Math helpers
function factorial(n) {
  n = Math.floor(n);
  if (n < 0) return "Error: bilangan negatif";
  if (n > 170) return Infinity;
  if (n === 0 || n === 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function gcd(a, b) {
  a = Math.abs(Math.floor(a));
  b = Math.abs(Math.floor(b));
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

function lcm(a, b) {
  return Math.abs(Math.floor(a) * Math.floor(b)) / gcd(a, b);
}

function isPrime(n) {
  n = Math.floor(n);
  if (n < 2) return "Bukan bilangan prima";
  if (n === 2) return "Prima ✓";
  if (n % 2 === 0) return "Bukan bilangan prima";
  for (let i = 3; i <= Math.sqrt(n); i += 2) {
    if (n % i === 0) return "Bukan bilangan prima";
  }
  return "Prima ✓";
}

function primeFactors(n) {
  n = Math.floor(n);
  if (n < 2) return "Invalid";
  const factors = [];
  for (let i = 2; i * i <= n; i++) {
    while (n % i === 0) { factors.push(i); n /= i; }
  }
  if (n > 1) factors.push(n);
  return factors.join(" × ");
}

// =====================================================
// KOMPONEN UTAMA
// =====================================================
export default function Calculator({ sessionToken, sessionData, onSessionUpdate }) {
  const [numA, setNumA] = useState("");
  const [numB, setNumB] = useState("");
  const [selectedOp, setSelectedOp] = useState(null);
  const [result, setResult] = useState(null);
  const [resultLabel, setResultLabel] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [pendingCalc, setPendingCalc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const canCalculate = sessionData?.canCalculate;
  const plan = sessionData?.plan;
  const usesLeft = sessionData?.usesLeft;

  // Lakukan kalkulasi (dipanggil setelah bayar atau langsung kalau bisa)
  const executeCalculation = useCallback(async (op, a, b) => {
    setIsLoading(true);
    setError("");

    // Consume 1 token via API
    try {
      const res = await fetch("/api/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken }),
      });

      const data = await res.json();

      if (!data.success) {
        setShowPaywall(true);
        setIsLoading(false);
        return;
      }

      // Update session data
      onSessionUpdate({
        ...sessionData,
        usesLeft: data.usesLeft,
        plan: data.plan,
        canCalculate: data.plan === "lifetime" || data.usesLeft > 0,
      });

      // Hitung hasil
      let calcResult;
      const numA = parseFloat(a);
      const numB = parseFloat(b);

      if (op.unary) {
        calcResult = op.fn(numA);
        setResultLabel(`${op.label}(${numA})`);
      } else if (op.symbol) {
        // eslint-disable-next-line no-eval
        calcResult = Function(`return ${numA} ${op.symbol} ${numB}`)();
        setResultLabel(`${numA} ${op.label} ${numB}`);
      } else {
        calcResult = op.fn(numA, numB);
        setResultLabel(`${op.label}(${numA}, ${numB})`);
      }

      setResult(String(calcResult));
    } catch {
      setError("Gagal terhubung ke server. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, sessionData, onSessionUpdate]);

  const handleCalculate = () => {
    if (!selectedOp) { setError("Pilih operasi dulu!"); return; }
    if (!numA && numA !== "0") { setError("Masukkan angka!"); return; }
    if (!selectedOp.unary && !numB && numB !== "0") { setError("Masukkan angka kedua!"); return; }

    setError("");

    // Cek apakah bisa kalkulasi
    if (!canCalculate) {
      setPendingCalc({ op: selectedOp, a: numA, b: numB });
      setShowPaywall(true);
      return;
    }

    executeCalculation(selectedOp, numA, numB);
  };

  const handlePaymentSuccess = () => {
    setShowPaywall(false);
    if (pendingCalc) {
      executeCalculation(pendingCalc.op, pendingCalc.a, pendingCalc.b);
      setPendingCalc(null);
    }
  };

  return (
    <div className="calculator-wrapper">
      {/* ── Status Bar ── */}
      <div className="status-bar">
        {plan === "lifetime" ? (
          <span className="badge badge-gold">⚡ ULTIMATE EDITION</span>
        ) : plan === "trial" ? (
          <span className="badge badge-blue">🎮 {usesLeft} KALKULASI TERSISA</span>
        ) : (
          <span className="badge badge-red">🔒 FREE PLAYER — BELI DLC UNTUK MAIN</span>
        )}
      </div>

      {/* ── Input Section ── */}
      <div className="input-section">
        <div className="input-group">
          <label>ANGKA PERTAMA</label>
          <input
            type="number"
            value={numA}
            onChange={(e) => setNumA(e.target.value)}
            placeholder="0"
            className="calc-input"
          />
        </div>

        {selectedOp && !selectedOp.unary && (
          <div className="input-group">
            <label>ANGKA KEDUA</label>
            <input
              type="number"
              value={numB}
              onChange={(e) => setNumB(e.target.value)}
              placeholder="0"
              className="calc-input"
            />
          </div>
        )}
      </div>

      {/* ── Operasi Dasar ── */}
      <div className="ops-section">
        <div className="ops-label">OPERASI DASAR</div>
        <div className="ops-grid basic">
          {OPERATIONS.basic.map((op) => (
            <button
              key={op.id}
              onClick={() => setSelectedOp(op)}
              className={`op-btn ${selectedOp?.id === op.id ? "active" : ""}`}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Operasi Lanjutan ── */}
      <div className="ops-section">
        <div className="ops-label">
          DLC — ADVANCED MATH PACK{" "}
          <span className="dlc-badge">TERMASUK DALAM PEMBELIAN</span>
        </div>
        <div className="ops-grid advanced">
          {OPERATIONS.advanced.map((op) => (
            <button
              key={op.id}
              onClick={() => setSelectedOp(op)}
              className={`op-btn ${selectedOp?.id === op.id ? "active" : ""}`}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error Message ── */}
      {error && <div className="error-msg">⚠ {error}</div>}

      {/* ── Calculate Button ── */}
      <button
        className="calc-btn"
        onClick={handleCalculate}
        disabled={isLoading}
      >
        {isLoading ? (
          "MEMPROSES..."
        ) : canCalculate ? (
          <>HITUNG SEKARANG {plan === "trial" && `(${usesLeft} TERSISA)`}</>
        ) : (
          <>🔒 BELI DLC UNTUK MELIHAT HASIL</>
        )}
      </button>

      {/* ── Result ── */}
      {result !== null && (
        <div className="result-box">
          <div className="result-label">{resultLabel} =</div>
          <div className="result-value">{result}</div>
          {plan === "trial" && usesLeft <= 3 && usesLeft > 0 && (
            <div className="result-warning">
              ⚠ Hampir habis! Sisa {usesLeft} kalkulasi. Upgrade sekarang!
            </div>
          )}
        </div>
      )}

      {/* ── Paywall Modal ── */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => { setShowPaywall(false); setPendingCalc(null); }}
        onSuccess={handlePaymentSuccess}
        sessionToken={sessionToken}
        currentPlan={plan}
        usesLeft={usesLeft}
      />
    </div>
  );
}