// src/app/api/usage/route.js

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionToken = searchParams.get("token");
  if (!sessionToken) return NextResponse.json({ error:"Token required" }, { status:400 });

  const session = await prisma.session.findUnique({ where:{ token: sessionToken } });
  if (!session) return NextResponse.json({ plan:"free", usesLeft:0, canCalculate:false, hasDlc:false });

  return NextResponse.json({
    plan:         session.plan,
    usesLeft:     session.usesLeft,
    totalUses:    session.totalUses,
    hasDlc:       session.hasDlc,
    canCalculate: session.plan === "lifetime" || session.usesLeft > 0,
  });
}

export async function POST(request) {
  try {
    const { sessionToken } = await request.json();
    if (!sessionToken) return NextResponse.json({ error:"Token required" }, { status:400 });

    const session = await prisma.session.findUnique({ where:{ token: sessionToken } });
    if (!session) return NextResponse.json({ error:"Session tidak ditemukan", canCalculate:false }, { status:404 });

    if (session.plan === "lifetime") {
      await prisma.session.update({ where:{ token: sessionToken }, data:{ totalUses:{ increment:1 } } });
      return NextResponse.json({ success:true, usesLeft:999999, plan:"lifetime", hasDlc:session.hasDlc });
    }

    if (session.plan === "trial" && session.usesLeft > 0) {
      const updated = await prisma.session.update({
        where: { token: sessionToken },
        data:  { usesLeft:{ decrement:1 }, totalUses:{ increment:1 } },
      });
      return NextResponse.json({ success:true, usesLeft:updated.usesLeft, plan:"trial", hasDlc:session.hasDlc });
    }

    return NextResponse.json({ success:false, canCalculate:false, error:"Tidak ada sisa kalkulasi." }, { status:403 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error:"Server error" }, { status:500 });
  }
}