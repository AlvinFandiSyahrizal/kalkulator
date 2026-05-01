// app/api/payment/webhook/route.js
// Midtrans akan POST ke sini setiap kali status pembayaran berubah
// Di dashboard Midtrans, set Notification URL ke: https://yourdomain.com/api/payment/webhook

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

const TRIAL_USES = parseInt(process.env.NEXT_PUBLIC_TRIAL_USES) || 10;

/**
 * Verifikasi signature dari Midtrans biar tidak bisa dipalsukan
 */
function verifySignature(orderId, statusCode, grossAmount, serverKey) {
  const hash = crypto
    .createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex");
  return hash;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = body;

    // Verifikasi signature
    const expectedSignature = verifySignature(
      order_id,
      status_code,
      gross_amount,
      process.env.MIDTRANS_SERVER_KEY
    );

    if (signature_key !== expectedSignature) {
      console.error("Invalid Midtrans signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    // Cari transaksi di DB
    const transaction = await prisma.transaction.findUnique({
      where: { orderId: order_id },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    // Tentukan status berdasarkan respons Midtrans
    let newStatus = "pending";
    let isSuccess = false;

    if (
      transaction_status === "capture" ||
      transaction_status === "settlement"
    ) {
      if (fraud_status === "accept" || !fraud_status) {
        newStatus = "success";
        isSuccess = true;
      } else if (fraud_status === "challenge") {
        newStatus = "challenge";
      }
    } else if (
      transaction_status === "cancel" ||
      transaction_status === "deny" ||
      transaction_status === "expire"
    ) {
      newStatus = "failed";
    }

    // Update status transaksi di DB
    await prisma.transaction.update({
      where: { orderId: order_id },
      data: { status: newStatus },
    });

    // Kalau sukses, update session user
    if (isSuccess) {
      const { plan, sessionToken } = transaction;

      if (plan === "lifetime") {
        await prisma.session.update({
          where: { token: sessionToken },
          data: { plan: "lifetime", usesLeft: 999999 },
        });
      } else if (plan === "trial") {
        // Tambah uses ke yang sudah ada (kalau beli trial lagi)
        const session = await prisma.session.findUnique({
          where: { token: sessionToken },
        });
        const currentUses = session?.plan === "trial" ? (session.usesLeft || 0) : 0;

        await prisma.session.update({
          where: { token: sessionToken },
          data: {
            plan: "trial",
            usesLeft: currentUses + TRIAL_USES,
          },
        });
      }

      console.log(`✅ Payment success: ${order_id} | Plan: ${plan} | Token: ${sessionToken.slice(0, 8)}...`);
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}