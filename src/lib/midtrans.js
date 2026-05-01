// lib/midtrans.js

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const IS_PRODUCTION = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true";

const BASE_URL = IS_PRODUCTION
  ? "https://app.midtrans.com/snap/v1"
  : "https://app.sandbox.midtrans.com/snap/v1";

/**
 * Buat transaksi Midtrans Snap
 * @param {Object} params
 * @param {string} params.orderId - ID order unik
 * @param {number} params.amount - Jumlah dalam rupiah
 * @param {string} params.plan - "trial" atau "lifetime"
 * @param {string} params.sessionToken - Token sesi user
 */
export async function createSnapTransaction({ orderId, amount, plan, sessionToken }) {
  const authString = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString("base64");

  const body = {
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
    item_details: [
      {
        id: plan,
        price: amount,
        quantity: 1,
        name: plan === "trial"
          ? `EA Calculator - Trial Pack (10 Kalkulasi)`
          : `EA Calculator - Ultimate Edition (Lifetime)`,
        merchant_name: "KalkuPaylator Corp.",
      },
    ],
    customer_details: {
      first_name: "Player",
      last_name: sessionToken.slice(0, 6), // anonim
    },
    callbacks: {
      finish: `${process.env.NEXT_PUBLIC_APP_URL}?payment=success&order=${orderId}`,
      error: `${process.env.NEXT_PUBLIC_APP_URL}?payment=error`,
      pending: `${process.env.NEXT_PUBLIC_APP_URL}?payment=pending`,
    },
  };

  const response = await fetch(`${BASE_URL}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${authString}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Midtrans error: ${JSON.stringify(error)}`);
  }

  return response.json();
  // Returns: { token: "snap-token", redirect_url: "..." }
}

/**
 * Verifikasi status transaksi dari Midtrans
 * @param {string} orderId
 */
export async function checkTransactionStatus(orderId) {
  const authString = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString("base64");

  const apiUrl = IS_PRODUCTION
    ? `https://api.midtrans.com/v2/${orderId}/status`
    : `https://api.sandbox.midtrans.com/v2/${orderId}/status`;

  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Basic ${authString}`,
    },
  });

  return response.json();
}