// app/api/payment/create/route.js

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSnapTransaction } from "@/lib/midtrans";
import { nanoid } from "nanoid"; // npm install nanoid

const PRICES = {
  trial: parseInt(process.env.NEXT_PUBLIC_PRICE_TRIAL) || 10000,
  lifetime: parseInt(process.env.NEXT_PUBLIC_PRICE_LIFETIME) || 50000,
};

const TRIAL_USES = parseInt(process.env.NEXT_PUBLIC_TRIAL_USES) || 10;

export async function POST(request) {
  try {
    const { plan, sessionToken } = await request.json();

    // Validasi input
    if (!["trial", "lifetime"].includes(plan)) {
      return NextResponse.json({ error: "Plan tidak valid" }, { status: 400 });
    }

    if (!sessionToken || sessionToken.length < 10) {
      return NextResponse.json({ error: "Session token tidak valid" }, { status: 400 });
    }

    // Pastikan session ada di DB, kalau tidak ada buat baru
    await prisma.session.upsert({
      where: { token: sessionToken },
      create: { token: sessionToken },
      update: {}, // tidak update apa-apa
    });

    // Cek apakah session sudah lifetime (tidak perlu beli lagi)
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
    });

    if (session?.plan === "lifetime") {
      return NextResponse.json(
        { error: "Kamu sudah punya akses lifetime bro!" },
        { status: 400 }
      );
    }

    // Buat order ID unik
    const orderId = `KALKU-${nanoid(12).toUpperCase()}`;
    const amount = PRICES[plan];

    // Buat transaksi di Midtrans
    const snapData = await createSnapTransaction({
      orderId,
      amount,
      plan,
      sessionToken,
    });

    // Simpan transaksi ke DB
    await prisma.transaction.create({
      data: {
        orderId,
        sessionToken,
        amount,
        plan,
        status: "pending",
        snapToken: snapData.token,
      },
    });

    return NextResponse.json({
      snapToken: snapData.token,
      orderId,
      redirectUrl: snapData.redirect_url,
    });
  } catch (error) {
    console.error("Payment create error:", error);
    return NextResponse.json(
      { error: "Gagal membuat transaksi. Coba lagi." },
      { status: 500 }
    );
  }
}