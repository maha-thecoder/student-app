// src/app/api/send-notification/route.ts
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Subscription from "@/models/Subscription";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { sendToUser } from "@/src/messagereusable/push";

/**
 * Safely extract a numeric "sent" count from many possible shapes
 * of sendResult returned by various push libs.
 */
function extractSentCount(sendResult: unknown): number {
  try {
    const r = sendResult as any;
    if (r == null) return 0;

    // common numeric shortcuts
    if (typeof r === "number") return r;
    if (typeof r.sent === "number") return r.sent;
    if (typeof r.sentCount === "number") return r.sentCount;
    if (typeof r.successCount === "number") return r.successCount;
    if (typeof r.success === "number") return r.success;

    // boolean "success" + optional count
    if (typeof r.success === "boolean" && r.success === true) {
      if (typeof r.count === "number") return r.count;
      return 1;
    }

    // common array shapes (results/responses/raw/matched)
    const arr =
      Array.isArray(r) ? r
        : Array.isArray(r?.results) ? r.results
        : Array.isArray(r?.responses) ? r.responses
        : Array.isArray(r?.raw) ? r.raw
        : Array.isArray(r?.matched) ? r.matched
        : null;

    if (Array.isArray(arr)) {
      // count items that appear successful
      return arr.filter((item: any) => {
        if (!item) return false;
        if (item.status && (item.status === "sent" || item.status === "ok")) return true;
        if (typeof item.success === "boolean") return item.success === true;
        // some libs provide error field on failure
        if ("error" in item && item.error != null) return false;
        // fallback: presence of endpoint or id may indicate an attempt; treat as success is risky,
        // so only count when we see no error property.
        return !("error" in item);
      }).length;
    }

    // fallback: look for numeric-looking keys
    for (const k of Object.keys(r || {})) {
      if (/sent|success|count|ok/i.test(k) && typeof r[k] === "number") {
        return r[k];
      }
    }
  } catch (e) {
    console.warn("extractSentCount() error:", e);
  }
  return 0;
}

export async function POST(req: Request) {
  try {
    // 1) Check user session via cookies
    const cookieStore = await cookies();
    const token = cookieStore.get("sessionToken")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let decoded: any = null;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (err) {
      console.error("JWT verify failed:", err);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userId = decoded.id;
    if (!userId) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 401 });
    }

    // 2) Read request body
    const body = await req.json();
    const { title, message, url } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: "title and message are required" },
        { status: 400 }
      );
    }

    // 3) Connect database
    await connectDB();

    // 4) Check if user has any push subscriptions
    const subs = await Subscription.find({ userId }).lean();

    if (!subs || subs.length === 0) {
      console.log("[send-notification] No subscriptions for user:", userId);
      return NextResponse.json({
        ok: false,
        sent: 0,
        message: "No devices subscribed",
      });
    }

    // 5) Build payload
    const payload = {
      title,
      body: message,
      url: url ?? "/", // default redirect
      icon: "/icons/icon-512x512.png",
      meta: {
        type: "manual-message",
        userId,
      },
    };

    // 6) Use your existing sendToUser utility
    console.log("[send-notification] Sending to user:", userId);
    const sendResult = await sendToUser(userId, payload);

    // 7) Extract sent count safely
    const sentCount = extractSentCount(sendResult);

    console.log("[send-notification] sendResult:", (() => {
      try { return JSON.stringify(sendResult); } catch { return String(sendResult); }
    })());

    return NextResponse.json({
      ok: true,
      sent: sentCount,
      result: sendResult,
    });
  } catch (err: any) {
    console.error("send-notification error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
