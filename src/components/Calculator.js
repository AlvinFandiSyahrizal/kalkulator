"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PaywallModal from "./PaywallModal";

// ─── Math helpers ───────────────────────────────────────
function factorial(n) {
  n = Math.floor(Math.abs(n));
  if (n > 170) return Infinity;
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
}
function gcd(a, b) {
  a = Math.abs(Math.floor(a)); b = Math.abs(Math.floor(b));
  while (b) { [a, b] = [b, a % b]; } return a;
}
function lcm(a, b) { return Math.abs(Math.floor(a) * Math.floor(b)) / gcd(a, b); }
function isPrime(n) {
  n = Math.floor(n);
  if (n < 2) return false; if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i <= Math.sqrt(n); i += 2) if (n % i === 0) return false;
  return true;
}
function primeFactors(n) {
  n = Math.floor(n); if (n < 2) return "—";
  const f = []; for (let i = 2; i * i <= n; i++) while (n % i === 0) { f.push(i); n /= i; }
  if (n > 1) f.push(n); return f.join(" × ");
}
function fmt(n) {
  if (typeof n === "string") return n;
  if (isNaN(n)) return "Error";
  if (!isFinite(n)) return n > 0 ? "∞" : "-∞";
  return String(parseFloat(n.toPrecision(12)));
}

// ─── DLC operations ──────────────────────────────────────
const DLC_OPS = [
  { id:"sqrt",    label:"√x",     tip:"Akar kuadrat",                    unary:true,  fn:(a)=>Math.sqrt(a) },
  { id:"cbrt",    label:"∛x",     tip:"Akar kubik",                       unary:true,  fn:(a)=>Math.cbrt(a) },
  { id:"pow",     label:"xⁿ",     tip:"Pangkat (a pangkat b)",            unary:false, fn:(a,b)=>Math.pow(a,b) },
  { id:"log",     label:"log",    tip:"Logaritma basis 10",               unary:true,  fn:(a)=>Math.log10(a) },
  { id:"ln",      label:"ln",     tip:"Logaritma natural",                unary:true,  fn:(a)=>Math.log(a) },
  { id:"sin",     label:"sin",    tip:"Sinus (derajat)",                  unary:true,  fn:(a)=>Math.sin(a*Math.PI/180) },
  { id:"cos",     label:"cos",    tip:"Kosinus (derajat)",                unary:true,  fn:(a)=>Math.cos(a*Math.PI/180) },
  { id:"tan",     label:"tan",    tip:"Tangen (derajat)",                 unary:true,  fn:(a)=>Math.tan(a*Math.PI/180) },
  { id:"fact",    label:"n!",     tip:"Faktorial",                        unary:true,  fn:(a)=>factorial(a) },
  { id:"abs",     label:"|x|",    tip:"Nilai mutlak",                     unary:true,  fn:(a)=>Math.abs(a) },
  { id:"gcd",     label:"FPB",    tip:"Faktor Persekutuan Terbesar (a,b)",unary:false, fn:(a,b)=>gcd(a,b) },
  { id:"lcm",     label:"KPK",    tip:"Kelipatan Persekutuan Terkecil (a,b)",unary:false,fn:(a,b)=>lcm(a,b)},
  { id:"mod",     label:"mod",    tip:"Modulo / sisa bagi (a mod b)",     unary:false, fn:(a,b)=>a%b },
  { id:"prime",   label:"prima?", tip:"Cek bilangan prima",               unary:true,  fn:(a)=>isPrime(Math.floor(a))?"Prima ✓":"Bukan prima" },
  { id:"factors", label:"faktor", tip:"Faktor prima",                     unary:true,  fn:(a)=>primeFactors(a) },
];

export default function Calculator({ sessionToken, sessionData, onSessionUpdate }) {
  const [display, setDisplay]       = useState("0");
  const [expression, setExpression] = useState("");
  const [storedVal, setStoredVal]   = useState(null);
  const [pendingOp, setPendingOp]   = useState(null);
  const [justCalc, setJustCalc]     = useState(false);
  const [freshInput, setFreshInput] = useState(false);
  const [paywallType, setPaywallType] = useState(null); // "result" | "dlc"
  const [pendingDlc, setPendingDlc] = useState(null);
  const [dlcResult, setDlcResult]   = useState(null);
  const [dlcTwoStep, setDlcTwoStep] = useState(null); // waiting for 2nd operand
  const wrapRef = useRef(null);

  const hasDlc  = sessionData?.hasDlc;
  const canCalc = sessionData?.canCalculate;

  // keep focus on wrapper for keyboard
  useEffect(() => { wrapRef.current?.focus(); }, []);

  // ── Keyboard ──────────────────────────────────────────
  const handleKey = useCallback((e) => {
    if (paywallType) return;
    const k = e.key;
    if (k >= "0" && k <= "9")          { e.preventDefault(); pressDigit(k); }
    else if (k === ".")                 { e.preventDefault(); pressDot(); }
    else if (["+","-","*","/"].includes(k)) { e.preventDefault(); pressOp(k); }
    else if (k === "Enter" || k === "="){ e.preventDefault(); pressEquals(); }
    else if (k === "Backspace")         { e.preventDefault(); pressBack(); }
    else if (k === "Escape")            { e.preventDefault(); pressClear(); }
    else if (k === "%")                 { e.preventDefault(); pressPercent(); }
  }, [paywallType, display, storedVal, pendingOp, justCalc, canCalc, expression]);

  // ── Core calc ─────────────────────────────────────────
function pressDigit(d) {
  setDlcResult(null); setDlcTwoStep(null);
  if (justCalc || freshInput) {
    setDisplay(d);
    setFreshInput(false);
    setJustCalc(false);
    return;
  }
  setDisplay(p => p === "0" ? d : p.length >= 15 ? p : p + d);
  setExpression(p => p === "" ? d : p + d);
}

function pressDot() {
  setDlcResult(null);
  if (justCalc || freshInput) {
    setDisplay("0."); setExpression(expression + "0.");
    setFreshInput(false); setJustCalc(false); return;
  }
  if (!display.includes(".")) {
    setDisplay(p => p + "."); setExpression(p => p + ".");
  }
}

function pressOp(op) {
  setDlcResult(null); setDlcTwoStep(null);
  const val = parseFloat(display);
  const sym = { "+":"+", "-":"−", "*":"×", "/":"÷" }[op];
  if (storedVal !== null && pendingOp && !justCalc && !freshInput) {
    const res = compute(storedVal, val, pendingOp);
    setDisplay(fmt(res)); setStoredVal(res);
    setExpression(fmt(res) + " " + sym + " ");
  } else {
    setStoredVal(val);
    setExpression(display + " " + sym + " ");
  }
  setPendingOp(op);
  setJustCalc(false);
  setFreshInput(true); // ← flag: next digit mulai fresh
}

  async function pressEquals() {
    if (!canCalc) { setPaywallType("result"); return; }
    try {
      const res = await fetch("/api/usage", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ sessionToken }),
      });
      const data = await res.json();
      if (!data.success) { setPaywallType("result"); return; }
      onSessionUpdate({ ...sessionData, usesLeft:data.usesLeft, plan:data.plan, canCalculate: data.plan==="lifetime"||data.usesLeft>0 });
    } catch { setPaywallType("result"); return; }

    if (storedVal !== null && pendingOp) {
      const val = parseFloat(display);
      const res = compute(storedVal, val, pendingOp);
      setExpression(expression + display + " =");
      setDisplay(fmt(res)); setDlcResult(null);
      setStoredVal(null); setPendingOp(null); setJustCalc(true);
    }
  }

  function pressClear() {
    setDisplay("0"); setExpression(""); setStoredVal(null);
    setPendingOp(null); setJustCalc(false); setDlcResult(null); setDlcTwoStep(null);
  }
  function pressBack() {
    if (justCalc) { pressClear(); return; }
    setDisplay(p => p.length > 1 ? p.slice(0,-1) : "0");
  }
  function pressPlusMinus() { setDisplay(p => String(parseFloat(p)*-1)); }
  function pressPercent()   { setDisplay(p => String(parseFloat(p)/100)); setDlcResult(null); }

  function compute(a, b, op) {
    switch(op) {
      case "+": return a+b; case "-": return a-b;
      case "*": return a*b; case "/": return b!==0?a/b:NaN;
      default: return b;
    }
  }

  // ── DLC ───────────────────────────────────────────────
  function pressDlc(op) {
    if (!hasDlc) { setPendingDlc(op); setPaywallType("dlc"); return; }
    const a = parseFloat(display);
    if (op.unary) {
      const res = op.fn(a);
      setDlcResult({ label:`${op.label}(${a})`, value: typeof res==="string"?res:fmt(res) });
      setStoredVal(null); setPendingOp(null); setJustCalc(true);
    } else {
      // 2-operand: store first value and wait
      setDlcTwoStep(op);
      setStoredVal(a);
      setExpression(`${op.label}(${a}, `);
      setDisplay("0"); setJustCalc(false);
    }
  }

  // When in dlcTwoStep mode, pressing = computes the dlc op
  async function pressDlcEquals() {
    if (!canCalc) { setPaywallType("result"); return; }
    try {
      const res = await fetch("/api/usage", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ sessionToken }),
      });
      const data = await res.json();
      if (!data.success) { setPaywallType("result"); return; }
      onSessionUpdate({ ...sessionData, usesLeft:data.usesLeft, plan:data.plan, canCalculate: data.plan==="lifetime"||data.usesLeft>0 });
    } catch { setPaywallType("result"); return; }

    const b = parseFloat(display);
    const res = dlcTwoStep.fn(storedVal, b);
    setDlcResult({ label:`${dlcTwoStep.label}(${storedVal}, ${b})`, value: typeof res==="string"?res:fmt(res) });
    setDlcTwoStep(null); setStoredVal(null); setPendingOp(null); setJustCalc(true);
  }

  function handleEqualPress() {
    if (dlcTwoStep) { pressDlcEquals(); } else { pressEquals(); }
  }

  const opKeys = [
    { label:"AC",  action:pressClear,           type:"fn" },
    { label:"+/−", action:pressPlusMinus,        type:"fn" },
    { label:"%",   action:pressPercent,          type:"fn" },
    { label:"÷",   action:()=>pressOp("/"),      type:"op", op:"/" },
    { label:"7",   action:()=>pressDigit("7"),   type:"num" },
    { label:"8",   action:()=>pressDigit("8"),   type:"num" },
    { label:"9",   action:()=>pressDigit("9"),   type:"num" },
    { label:"×",   action:()=>pressOp("*"),      type:"op", op:"*" },
    { label:"4",   action:()=>pressDigit("4"),   type:"num" },
    { label:"5",   action:()=>pressDigit("5"),   type:"num" },
    { label:"6",   action:()=>pressDigit("6"),   type:"num" },
    { label:"−",   action:()=>pressOp("-"),      type:"op", op:"-" },
    { label:"1",   action:()=>pressDigit("1"),   type:"num" },
    { label:"2",   action:()=>pressDigit("2"),   type:"num" },
    { label:"3",   action:()=>pressDigit("3"),   type:"num" },
    { label:"+",   action:()=>pressOp("+"),      type:"op", op:"+" },
    { label:"⌫",   action:pressBack,             type:"fn" },
    { label:"0",   action:()=>pressDigit("0"),   type:"num" },
    { label:".",   action:pressDot,              type:"num" },
    { label:"=",   action:handleEqualPress,      type:"eq" },
  ];

  return (
    <>
      <div
        className="calc-wrap"
        ref={wrapRef}
        tabIndex={0}
        onKeyDown={handleKey}
        style={{ outline:"none" }}
      >
        {/* ── Display ── */}
        <div className="calc-display">
          <div className="calc-expr">{expression || "\u00a0"}</div>
          {dlcResult ? (
            <div className="calc-dlc-result">
              <div className="calc-dlc-label">{dlcResult.label} =</div>
              <div className="calc-dlc-value">{dlcResult.value}</div>
            </div>
          ) : (
            <div className="calc-num"
              style={{ fontSize: display.length > 10 ? "32px" : display.length > 7 ? "42px" : "56px" }}>
              {display}
            </div>
          )}
          {dlcTwoStep && (
            <div className="calc-dlc-hint">masukkan angka kedua, lalu tekan =</div>
          )}
        </div>

        {/* ── DLC Panel ── */}
        <div className="dlc-panel">
          <div className="dlc-header">
            <span className="dlc-label-text">ADVANCED MATH</span>
            {!hasDlc && (
              <span className="dlc-badge-locked">🔒 Klik untuk buka</span>
            )}
            {hasDlc && (
              <span className="dlc-badge-owned">✓ UNLOCKED</span>
            )}
          </div>
          <div className="dlc-grid">
            {DLC_OPS.map(op => (
              <button
                key={op.id}
                className={`dlc-btn${hasDlc ? "" : " dlc-btn-locked"}`}
                onClick={() => pressDlc(op)}
                title={op.tip}
              >
                <span className="dlc-btn-label">{op.label}</span>
                {!hasDlc && <span className="dlc-icon-lock">🔒</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── Basic Keypad ── */}
        <div className="calc-grid">
          {opKeys.map((k, i) => (
            <button
              key={i}
              className={`key type-${k.type}${pendingOp === k.op ? " key-op-active" : ""}`}
              onClick={k.action}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <PaywallModal
        isOpen={!!paywallType}
        type={paywallType}
        onClose={() => { setPaywallType(null); setPendingDlc(null); }}
        onSuccess={(data) => {
          setPaywallType(null);
          onSessionUpdate({ ...sessionData, ...data });
          if (paywallType === "dlc" && pendingDlc && data.hasDlc) {
            setTimeout(() => pressDlc(pendingDlc), 400);
          }
          setPendingDlc(null);
        }}
        sessionToken={sessionToken}
        sessionData={sessionData}
      />
    </>
  );
}