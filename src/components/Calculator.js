"use client";

import { useState } from "react";
import PaywallModal from "./PaywallModal";

export default function Calculator({ sessionToken, sessionData, onSessionUpdate }) {
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [operator, setOperator] = useState(null);
  const [prevValue, setPrevValue] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [justCalculated, setJustCalculated] = useState(false);

  const canCalculate = sessionData?.canCalculate;

  const inputDigit = (digit) => {
    if (justCalculated) {
      setDisplay(String(digit));
      setExpression(String(digit));
      setJustCalculated(false);
      return;
    }
    if (waitingForOperand) {
      setDisplay(String(digit));
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? String(digit) : display + digit);
    }
    setExpression((prev) => (waitingForOperand ? prev + digit : prev === "0" ? String(digit) : prev + digit));
  };

  const inputDecimal = () => {
    if (justCalculated) {
      setDisplay("0.");
      setExpression("0.");
      setJustCalculated(false);
      return;
    }
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(".")) {
      setDisplay(display + ".");
      setExpression(expression + ".");
    }
  };

  const handleOperator = (nextOperator) => {
    const val = parseFloat(display);
    setJustCalculated(false);

    const opSymbols = { "+": "+", "-": "−", "*": "×", "/": "÷" };
    const sym = opSymbols[nextOperator] || nextOperator;

    if (prevValue !== null && !waitingForOperand) {
      const result = calculate(prevValue, val, operator);
      setDisplay(String(result));
      setPrevValue(result);
      setExpression(String(result) + " " + sym + " ");
    } else {
      setPrevValue(val);
      setExpression(display + " " + sym + " ");
    }
    setOperator(nextOperator);
    setWaitingForOperand(true);
  };

  const calculate = (a, b, op) => {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/": return b !== 0 ? a / b : "Error";
      default: return b;
    }
  };

  const handleEquals = async () => {
    if (!canCalculate) {
      setShowPaywall(true);
      return;
    }

    // Consume token
    try {
      const res = await fetch("/api/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken }),
      });
      const data = await res.json();
      if (!data.success) { setShowPaywall(true); return; }
      onSessionUpdate({
        ...sessionData,
        usesLeft: data.usesLeft,
        plan: data.plan,
        canCalculate: data.plan === "lifetime" || data.usesLeft > 0,
      });
    } catch {
      setShowPaywall(true);
      return;
    }

    const val = parseFloat(display);
    if (prevValue !== null && operator) {
      const result = calculate(prevValue, val, operator);
      const opSymbols = { "+": "+", "-": "−", "*": "×", "/": "÷" };
      setExpression(expression + display + " =");
      setDisplay(String(result));
      setPrevValue(null);
      setOperator(null);
      setWaitingForOperand(false);
      setJustCalculated(true);
    }
  };

  const handleClear = () => {
    setDisplay("0");
    setExpression("");
    setOperator(null);
    setPrevValue(null);
    setWaitingForOperand(false);
    setJustCalculated(false);
  };

  const handlePlusMinus = () => {
    setDisplay(String(parseFloat(display) * -1));
  };

  const handlePercent = () => {
    setDisplay(String(parseFloat(display) / 100));
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay("0");
    }
  };

  const handlePaymentSuccess = (data) => {
    setShowPaywall(false);
    onSessionUpdate({
      ...sessionData,
      plan: data.plan,
      usesLeft: data.usesLeft,
      canCalculate: true,
    });
  };

  const buttons = [
    { label: "AC", action: handleClear, type: "fn" },
    { label: "+/-", action: handlePlusMinus, type: "fn" },
    { label: "%", action: handlePercent, type: "fn" },
    { label: "÷", action: () => handleOperator("/"), type: "op" },

    { label: "7", action: () => inputDigit("7"), type: "num" },
    { label: "8", action: () => inputDigit("8"), type: "num" },
    { label: "9", action: () => inputDigit("9"), type: "num" },
    { label: "×", action: () => handleOperator("*"), type: "op" },

    { label: "4", action: () => inputDigit("4"), type: "num" },
    { label: "5", action: () => inputDigit("5"), type: "num" },
    { label: "6", action: () => inputDigit("6"), type: "num" },
    { label: "−", action: () => handleOperator("-"), type: "op" },

    { label: "1", action: () => inputDigit("1"), type: "num" },
    { label: "2", action: () => inputDigit("2"), type: "num" },
    { label: "3", action: () => inputDigit("3"), type: "num" },
    { label: "+", action: () => handleOperator("+"), type: "op" },

    { label: "⌫", action: handleBackspace, type: "fn" },
    { label: "0", action: () => inputDigit("0"), type: "num" },
    { label: ".", action: inputDecimal, type: "num" },
    { label: "=", action: handleEquals, type: "eq" },
  ];

  return (
    <>
      <div className="calc-shell">
        {/* Display */}
        <div className="calc-display">
          <div className="calc-expression">{expression || " "}</div>
          <div className="calc-number">{display}</div>
        </div>

        {/* Buttons */}
        <div className="calc-grid">
          {buttons.map((btn, i) => (
            <button
              key={i}
              onClick={btn.action}
              className={`calc-btn-key type-${btn.type}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSuccess={handlePaymentSuccess}
        sessionToken={sessionToken}
        currentPlan={sessionData?.plan}
        usesLeft={sessionData?.usesLeft}
      />
    </>
  );
}