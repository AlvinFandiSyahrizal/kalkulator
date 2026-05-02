"use client";

import { useState, useRef, useEffect } from "react";
import PaywallModal from "./PaywallModal";

// ─── Math helpers ─────────────────────────────────────────
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
function compute(a, b, op) {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return b !== 0 ? a / b : NaN;
    default:  return b;
  }
}

const SYM = { "+": "+", "-": "−", "*": "×", "/": "÷" };

const DLC_OPS = [
  { id:"sqrt",    label:"√x",     tip:"Akar kuadrat",                        unary:true,  fn:(a)=>Math.sqrt(a) },
  { id:"cbrt",    label:"∛x",     tip:"Akar kubik",                           unary:true,  fn:(a)=>Math.cbrt(a) },
  { id:"pow",     label:"xⁿ",     tip:"Pangkat (a pangkat b)",                unary:false, fn:(a,b)=>Math.pow(a,b) },
  { id:"log",     label:"log",    tip:"Logaritma basis 10",                   unary:true,  fn:(a)=>Math.log10(a) },
  { id:"ln",      label:"ln",     tip:"Logaritma natural",                    unary:true,  fn:(a)=>Math.log(a) },
  { id:"sin",     label:"sin",    tip:"Sinus (derajat)",                      unary:true,  fn:(a)=>Math.sin(a*Math.PI/180) },
  { id:"cos",     label:"cos",    tip:"Kosinus (derajat)",                    unary:true,  fn:(a)=>Math.cos(a*Math.PI/180) },
  { id:"tan",     label:"tan",    tip:"Tangen (derajat)",                     unary:true,  fn:(a)=>Math.tan(a*Math.PI/180) },
  { id:"fact",    label:"n!",     tip:"Faktorial",                            unary:true,  fn:(a)=>factorial(a) },
  { id:"abs",     label:"|x|",    tip:"Nilai mutlak",                         unary:true,  fn:(a)=>Math.abs(a) },
  { id:"gcd",     label:"FPB",    tip:"Faktor Persekutuan Terbesar (a,b)",    unary:false, fn:(a,b)=>gcd(a,b) },
  { id:"lcm",     label:"KPK",    tip:"Kelipatan Persekutuan Terkecil (a,b)", unary:false, fn:(a,b)=>lcm(a,b) },
  { id:"mod",     label:"mod",    tip:"Modulo / sisa bagi (a mod b)",         unary:false, fn:(a,b)=>a%b },
  { id:"prime",   label:"prima?", tip:"Cek bilangan prima",                   unary:true,  fn:(a)=>isPrime(Math.floor(a))?"Prima ✓":"Bukan prima" },
  { id:"factors", label:"faktor", tip:"Faktor prima",                         unary:true,  fn:(a)=>primeFactors(a) },
];

// ─── State machine yang jelas ─────────────────────────────
// calc state disimpan semua di satu ref object
// → tidak ada stale closure sama sekali
function makeState() {
  return {
    a:        null,   // operand pertama
    op:       null,   // operator pending
    b:        "",     // operand kedua (string sementara)
    display:  "0",    // apa yang ditampilkan
    expr:     "",     // baris atas (expression)
    fresh:    false,  // kalau true, digit berikutnya reset display
    done:     false,  // habis tekan =
    dlcOp:    null,   // kalau lagi tunggu operand ke-2 DLC
    dlcRes:   null,   // hasil DLC (untuk tampil special)
  };
}

export default function Calculator({ sessionToken, sessionData, onSessionUpdate }) {
  const cs            = useRef(makeState());   // calculator state
  const [ui, setUi]   = useState(makeState()); // untuk trigger render
  const wrapRef       = useRef(null);
  const [paywallType, setPaywallType] = useState(null);
  const [pendingDlc,  setPendingDlc]  = useState(null);

  const canCalc = sessionData?.canCalculate;
  const hasDlc  = sessionData?.hasDlc;

  // sync refs agar event handler selalu up to date
  const canCalcRef = useRef(canCalc);
  const hasDlcRef  = useRef(hasDlc);
  canCalcRef.current = canCalc;
  hasDlcRef.current  = hasDlc;

  useEffect(() => { wrapRef.current?.focus(); }, []);

  // Commit state ke UI
  function commit() { setUi({ ...cs.current }); }

  // ─── Digit ──────────────────────────────────────────────
  function pressDigit(d) {
    const s = cs.current;
    s.dlcRes = null;

    if (s.fresh || s.done) {
      // mulai angka baru
      s.display = d === "0" ? "0" : d;
      s.fresh = false;
      s.done  = false;
      // kalau ada operator pending, update expr dengan angka baru
      if (s.op !== null) {
        s.expr = `${s.a} ${SYM[s.op]} ${s.display}`;
      } else {
        s.expr = s.display;
      }
    } else {
      // append digit
      if (s.display === "0") s.display = d;
      else if (s.display.length < 15) s.display += d;
      // sync expr
      if (s.op !== null) {
        s.expr = `${s.a} ${SYM[s.op]} ${s.display}`;
      } else {
        s.expr = s.display;
      }
    }
    commit();
  }

  // ─── Dot ────────────────────────────────────────────────
  function pressDot() {
    const s = cs.current;
    s.dlcRes = null;
    if (s.fresh || s.done) {
      s.display = "0.";
      s.fresh = false;
      s.done  = false;
      if (s.op !== null) s.expr = `${s.a} ${SYM[s.op]} 0.`;
      else s.expr = "0.";
    } else if (!s.display.includes(".")) {
      s.display += ".";
      if (s.op !== null) s.expr = `${s.a} ${SYM[s.op]} ${s.display}`;
      else s.expr += ".";
    }
    commit();
  }

  // ─── Operator ───────────────────────────────────────────
  function pressOp(op) {
    const s = cs.current;
    s.dlcRes = null;
    s.dlcOp  = null;
    const val = parseFloat(s.display);

    if (s.a !== null && s.op !== null && !s.fresh && !s.done) {
      // chain: hitung dulu yang lama
      const res = compute(s.a, val, s.op);
      s.a       = res;
      s.display = fmt(res);
    } else {
      s.a = val;
    }

    s.op    = op;
    s.fresh = true;
    s.done  = false;
    s.expr  = `${s.a} ${SYM[op]} `;
    commit();
  }

  // ─── Equals ─────────────────────────────────────────────
  async function pressEquals() {
    if (!canCalcRef.current) { setPaywallType("result"); return; }

    // consume token
    try {
      const res  = await fetch("/api/usage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken }),
      });
      const data = await res.json();
      if (!data.success) { setPaywallType("result"); return; }
      onSessionUpdate({
        ...sessionData, usesLeft: data.usesLeft, plan: data.plan,
        canCalculate: data.plan === "lifetime" || data.usesLeft > 0,
      });
    } catch { setPaywallType("result"); return; }

    const s = cs.current;
    if (s.dlcOp) { await pressDlcEquals(); return; }
    if (s.a === null || s.op === null) return;

    const b   = parseFloat(s.display);
    const res = compute(s.a, b, s.op);
    s.expr    = `${s.a} ${SYM[s.op]} ${b} =`;
    s.display = fmt(res);
    s.dlcRes  = null;
    s.a       = null;
    s.op      = null;
    s.fresh   = false;
    s.done    = true;
    commit();
  }

  // ─── DLC Equals ─────────────────────────────────────────
  async function pressDlcEquals() {
    if (!canCalcRef.current) { setPaywallType("result"); return; }
    try {
      const res  = await fetch("/api/usage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken }),
      });
      const data = await res.json();
      if (!data.success) { setPaywallType("result"); return; }
      onSessionUpdate({
        ...sessionData, usesLeft: data.usesLeft, plan: data.plan,
        canCalculate: data.plan === "lifetime" || data.usesLeft > 0,
      });
    } catch { setPaywallType("result"); return; }

    const s  = cs.current;
    const op = s.dlcOp;
    const b  = parseFloat(s.display);
    const r  = op.fn(s.a, b);
    s.dlcRes  = { label: `${op.label}(${s.a}, ${b})`, value: typeof r === "string" ? r : fmt(r) };
    s.dlcOp   = null;
    s.a       = null;
    s.op      = null;
    s.done    = true;
    s.fresh   = false;
    commit();
  }

  function handleEqualPress() {
    const s = cs.current;
    if (s.dlcOp) pressDlcEquals();
    else pressEquals();
  }

  // ─── Clear / Back ────────────────────────────────────────
  function pressClear() { cs.current = makeState(); commit(); }

  function pressBack() {
    const s = cs.current;
    if (s.done) { pressClear(); return; }
    if (s.display.length > 1) {
      s.display = s.display.slice(0, -1);
    } else {
      s.display = "0";
    }
    if (s.op !== null) s.expr = `${s.a} ${SYM[s.op]} ${s.display}`;
    else s.expr = s.display;
    commit();
  }

  function pressPlusMinus() {
    const s = cs.current;
    s.display = String(parseFloat(s.display) * -1);
    commit();
  }

  function pressPercent() {
    const s = cs.current;
    s.display = String(parseFloat(s.display) / 100);
    s.dlcRes  = null;
    commit();
  }

  // ─── DLC ────────────────────────────────────────────────
  function pressDlc(op) {
    if (!hasDlcRef.current) { setPendingDlc(op); setPaywallType("dlc"); return; }
    const s = cs.current;
    const a = parseFloat(s.display);

    if (op.unary) {
      const res = op.fn(a);
      s.dlcRes  = { label: `${op.label}(${a})`, value: typeof res === "string" ? res : fmt(res) };
      s.a       = null; s.op = null; s.done = true; s.fresh = false;
      commit();
    } else {
      // 2-operand DLC: tunggu angka kedua
      s.dlcOp   = op;
      s.a       = a;
      s.op      = null;
      s.display = "0";
      s.expr    = `${op.label}(${a}, `;
      s.fresh   = true;
      s.done    = false;
      s.dlcRes  = null;
      commit();
    }
  }

  // ─── Keyboard ───────────────────────────────────────────
  function handleKey(e) {
    if (paywallType) return;
    const k = e.key;
    if (k >= "0" && k <= "9")              { e.preventDefault(); pressDigit(k); }
    else if (k === ".")                     { e.preventDefault(); pressDot(); }
    else if (["+","-","*","/"].includes(k)) { e.preventDefault(); pressOp(k); }
    else if (k === "Enter" || k === "=")    { e.preventDefault(); handleEqualPress(); }
    else if (k === "Backspace")             { e.preventDefault(); pressBack(); }
    else if (k === "Escape")               { e.preventDefault(); pressClear(); }
    else if (k === "%")                    { e.preventDefault(); pressPercent(); }
  }

  // ─── Keypad ──────────────────────────────────────────────
  const opKeys = [
    { label:"AC",  action:pressClear,         type:"fn" },
    { label:"+/−", action:pressPlusMinus,      type:"fn" },
    { label:"%",   action:pressPercent,        type:"fn" },
    { label:"÷",   action:()=>pressOp("/"),    type:"op", op:"/" },
    { label:"7",   action:()=>pressDigit("7"), type:"num" },
    { label:"8",   action:()=>pressDigit("8"), type:"num" },
    { label:"9",   action:()=>pressDigit("9"), type:"num" },
    { label:"×",   action:()=>pressOp("*"),    type:"op", op:"*" },
    { label:"4",   action:()=>pressDigit("4"), type:"num" },
    { label:"5",   action:()=>pressDigit("5"), type:"num" },
    { label:"6",   action:()=>pressDigit("6"), type:"num" },
    { label:"−",   action:()=>pressOp("-"),    type:"op", op:"-" },
    { label:"1",   action:()=>pressDigit("1"), type:"num" },
    { label:"2",   action:()=>pressDigit("2"), type:"num" },
    { label:"3",   action:()=>pressDigit("3"), type:"num" },
    { label:"+",   action:()=>pressOp("+"),    type:"op", op:"+" },
    { label:"⌫",   action:pressBack,           type:"fn" },
    { label:"0",   action:()=>pressDigit("0"), type:"num" },
    { label:".",   action:pressDot,            type:"num" },
    { label:"=",   action:handleEqualPress,    type:"eq" },
  ];

  const { display, expr, dlcRes, dlcOp, op: activeOp } = ui;

  return (
    <>
      <div className="calc-wrap" ref={wrapRef} tabIndex={0} onKeyDown={handleKey} style={{outline:"none"}}>

        {/* Display */}
        <div className="calc-display">
          <div className="calc-expr">{expr || "\u00a0"}</div>
          {dlcRes ? (
            <div className="calc-dlc-result">
              <div className="calc-dlc-label">{dlcRes.label} =</div>
              <div className="calc-dlc-value">{dlcRes.value}</div>
            </div>
          ) : (
            <div className="calc-num"
              style={{fontSize: display.length > 10 ? "30px" : display.length > 7 ? "40px" : "56px"}}>
              {display}
            </div>
          )}
          {dlcOp && <div className="calc-dlc-hint">masukkan angka kedua lalu tekan =</div>}
        </div>

        {/* DLC Panel */}
        <div className="dlc-panel">
          <div className="dlc-header">
            <span className="dlc-label-text">ADVANCED MATH</span>
            {hasDlc
              ? <span className="dlc-badge-owned">✓ UNLOCKED</span>
              : <span className="dlc-badge-locked">🔒 Klik untuk buka</span>}
          </div>
          <div className="dlc-grid">
            {DLC_OPS.map(op => (
              <button key={op.id}
                className={`dlc-btn${hasDlc ? "" : " dlc-btn-locked"}`}
                onClick={() => pressDlc(op)} title={op.tip}>
                <span className="dlc-btn-label">{op.label}</span>
                {!hasDlc && <span className="dlc-icon-lock">🔒</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Keypad */}
        <div className="calc-grid">
          {opKeys.map((k, i) => (
            <button key={i}
              className={`key type-${k.type}${activeOp === k.op ? " key-op-active" : ""}`}
              onClick={k.action}>
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
          const type = paywallType;
          const dlc  = pendingDlc;
          setPaywallType(null);
          setPendingDlc(null);
          onSessionUpdate({ ...sessionData, ...data });
          if (type === "dlc" && dlc && data.hasDlc) {
            setTimeout(() => pressDlc(dlc), 400);
          }
        }}
        sessionToken={sessionToken}
        sessionData={sessionData}
      />
    </>
  );
}