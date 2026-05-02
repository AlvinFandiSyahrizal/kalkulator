// src/app/api/payment/webhook/route.js

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

const TRIAL_USES = parseInt(process.env.NEXT_PUBLIC_TRIAL_USES) || 10;

function verifySignature(orderId, statusCode, grossAmount, serverKey) {
  return crypto.createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex");
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = body;

    const expected = verifySignature(order_id, status_code, gross_amount, process.env.MIDTRANS_SERVER_KEY);
    if (signature_key !== expected)
      return NextResponse.json({ error:"Invalid signature" }, { status:403 });

    const transaction = await prisma.transaction.findUnique({ where:{ orderId: order_id } });
    if (!transaction) return NextResponse.json({ error:"Not found" }, { status:404 });

    let newStatus = "pending";
    let isSuccess = false;

    if (["capture","settlement"].includes(transaction_status)) {
      if (!fraud_status || fraud_status === "accept") { newStatus = "success"; isSuccess = true; }
      else if (fraud_status === "challenge") newStatus = "challenge";
    } else if (["cancel","deny","expire"].includes(transaction_status)) {
      newStatus = "failed";
    }

    await prisma.transaction.update({ where:{ orderId: order_id }, data:{ status: newStatus } });

    if (isSuccess) {
      const { plan, sessionToken } = transaction;

      if (plan === "lifetime") {
        await prisma.session.update({
          where: { token: sessionToken },
          data:  { plan:"lifetime", usesLeft:999999 },
        });
      } else if (plan === "trial") {
        const session = await prisma.session.findUnique({ where:{ token: sessionToken } });
        const current = session?.plan === "trial" ? (session.usesLeft || 0) : 0;
        await prisma.session.update({
          where: { token: sessionToken },
          data:  { plan:"trial", usesLeft: current + TRIAL_USES },
        });
      } else if (plan === "dlc") {
        await prisma.session.update({
          where: { token: sessionToken },
          data:  { hasDlc: true },
        });
      }

      console.log(`✅ Payment OK: ${order_id} | ${plan} | ${sessionToken.slice(0,8)}...`);
    }

    return NextResponse.json({ status:"ok" });
  } catch (e) {
    console.error("Webhook error:", e);
    return NextResponse.json({ error:"Internal error" }, { status:500 });
  }
}