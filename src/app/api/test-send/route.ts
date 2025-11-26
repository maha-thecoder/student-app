// src/app/api/test-send/route.ts
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { sendToUser } from "@/src/messagereusable/push";

export async function POST(req: Request) {
  await connectDB();
  const body = await req.json().catch(() => ({}));
  const userId = body.userId;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const payload = { title: "Test", body: "This is a test notification", url: "/", tag: `debug-${Date.now()}` };

  try {
    const res = await sendToUser(userId, payload);
    return NextResponse.json({ ok: true, result: res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
