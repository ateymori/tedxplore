import { NextResponse } from "next/server";
import { prisma } from "@/server/repositories/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
