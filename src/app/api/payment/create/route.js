// src/app/api/payment/create/route.js

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSnapTransaction } from "@/lib/midtrans";
import { nanoid } from "nanoid";

const PRICES = {
  trial:    parseInt(process.env.NEXT_PUBLIC_PRICE_TRIAL)    || 10000,
  dlc:      parseInt(process.env.NEXT_PUBLIC_PRICE_DLC)      || 50000,
  lifetime: parseInt(process.env.NEXT_PUBLIC_PRICE_LIFETIME) || 100000,
};
const TRIAL_USES = parseInt(process.env.NEXT_PUBLIC_TRIAL_USES) || 10;

const PLAN_NAMES = {
  trial:    `Standard Edition (${TRIAL_USES}× kalkulasi)`,
  dlc:      "Advanced Math DLC (Permanent)",
  lifetime: "Ultimate Edition (Lifetime Unlimited)",
};

export async function POST(request) {
  try {
    const { plan, sessionToken } = await request.json();

    if (!["trial","dlc","lifetime"].includes(plan))
      return NextResponse.json({ error:"Plan tidak valid" }, { status:400 });
    if (!sessionToken || sessionToken.length < 10)
      return NextResponse.json({ error:"Session token tidak valid" }, { status:400 });

    // Upsert session
    await prisma.session.upsert({
      where:  { token: sessionToken },
      create: { token: sessionToken },
      update: {},
    });

    const session = await prisma.session.findUnique({ where:{ token: sessionToken } });

    // Guard: already lifetime
    if (plan === "lifetime" && session?.plan === "lifetime")
      return NextResponse.json({ error:"Sudah punya akses lifetime!" }, { status:400 });

    // Guard: already has DLC
    if (plan === "dlc" && session?.hasDlc)
      return NextResponse.json({ error:"DLC sudah dimiliki!" }, { status:400 });

    const orderId = `KALKU-${nanoid(12).toUpperCase()}`;
    const amount  = PRICES[plan];

    const snapData = await createSnapTransaction({ orderId, amount, plan, sessionToken, itemName: PLAN_NAMES[plan] });

    await prisma.transaction.create({
      data: { orderId, sessionToken, amount, plan, status:"pending", snapToken: snapData.token },
    });

    return NextResponse.json({ snapToken: snapData.token, orderId, redirectUrl: snapData.redirect_url });
  } catch (e) {
    console.error("Payment create error:", e);
    return NextResponse.json({ error:"Gagal membuat transaksi." }, { status:500 });
  }
}