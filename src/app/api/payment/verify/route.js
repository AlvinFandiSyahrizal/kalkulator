// app/api/payment/verify/route.js
// Frontend polling ini untuk tahu apakah pembayaran sudah sukses

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const sessionToken = searchParams.get("token");

  if (!orderId || !sessionToken) {
    return NextResponse.json({ error: "orderId dan token required" }, { status: 400 });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { orderId },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  }

  // Pastikan order ini milik session yang benar
  if (transaction.sessionToken !== sessionToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Ambil info session terbaru
  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
  });

  return NextResponse.json({
    status: transaction.status,       // "pending" | "success" | "failed"
    plan: session?.plan || "free",
    usesLeft: session?.usesLeft || 0,
    isSuccess: transaction.status === "success",
  });
}