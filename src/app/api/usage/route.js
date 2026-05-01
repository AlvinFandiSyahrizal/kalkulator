// app/api/usage/route.js
// GET  → cek sisa penggunaan
// POST → pakai 1 token (sebelum tampilkan hasil)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET: Cek status session
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionToken = searchParams.get("token");

  if (!sessionToken) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
  });

  if (!session) {
    return NextResponse.json({
      plan: "free",
      usesLeft: 0,
      canCalculate: false,
    });
  }

  return NextResponse.json({
    plan: session.plan,
    usesLeft: session.usesLeft,
    totalUses: session.totalUses,
    canCalculate: session.plan === "lifetime" || session.usesLeft > 0,
  });
}

// POST: Consume 1 token untuk menampilkan hasil
export async function POST(request) {
  try {
    const { sessionToken } = await request.json();

    if (!sessionToken) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
    });

    if (!session) {
      return NextResponse.json({ error: "Session tidak ditemukan", canCalculate: false }, { status: 404 });
    }

    // Lifetime → bebas pakai
    if (session.plan === "lifetime") {
      await prisma.session.update({
        where: { token: sessionToken },
        data: { totalUses: { increment: 1 } },
      });
      return NextResponse.json({ success: true, usesLeft: 999999, plan: "lifetime" });
    }

    // Trial → cek sisa
    if (session.plan === "trial" && session.usesLeft > 0) {
      const updated = await prisma.session.update({
        where: { token: sessionToken },
        data: {
          usesLeft: { decrement: 1 },
          totalUses: { increment: 1 },
        },
      });
      return NextResponse.json({
        success: true,
        usesLeft: updated.usesLeft,
        plan: "trial",
      });
    }

    // Tidak ada akses
    return NextResponse.json({
      success: false,
      canCalculate: false,
      error: "Tidak ada sisa kalkulasi. Beli dulu!",
    }, { status: 403 });

  } catch (error) {
    console.error("Usage error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}