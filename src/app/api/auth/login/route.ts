// src/app/api/auth/login/route.ts

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Student from "@/models/student";
import Subscription from "@/models/Subscription";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendToUser } from "@/src/messagereusable/push"; // keep existing import
import webpush from "web-push";

const JWT_SECRET = process.env.JWT_SECRET || "mahanth";

// setup VAPID (used by fallback inline sender)
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails("mailto:you@example.com", VAPID_PUBLIC, VAPID_PRIVATE);
  } catch (e) {
    console.warn("web-push vapid setup warning:", e);
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const { rollno, password, deviceId } = body; // deviceId must come from client

    if (!rollno || !password) {
      return NextResponse.json({ error: "Roll number and password are required" }, { status: 400 });
    }

    // 1. CHECK IF STUDENT EXISTS
    const user = await Student.findOne({ rollno }).lean();
    if (!user) {
      return NextResponse.json({ error: "Invalid roll number or password" }, { status: 401 });
    }

    // 2. COMPARE PASSWORD
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid roll number or password" }, { status: 401 });
    }

    // 3. SUCCESS: create response + cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        rollno: user.rollno,
      },
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 7,
    };

    const token = jwt.sign({ sub: user._id.toString() }, JWT_SECRET, { expiresIn: "7d" });
    response.cookies.set("sessionToken", token, cookieOptions);

    // 4. Link subscriptions that belong to this deviceId -> this userId
    // Only run if deviceId was provided. If not provided, we don't link or send device-targeted notification.
    if (deviceId) {
      try {
        const now = new Date();
        // Attach subscriptions that have this deviceId to this user
        await Subscription.updateMany(
          { deviceId },
          { $set: { userId: user._id.toString(), lastSeenAt: now, isActive: true } }
        );
      } catch (linkErr) {
        console.error("Failed to link subscriptions for deviceId:", deviceId, linkErr);
        // proceed — linking failure shouldn't block login
      }
    }

    // 5. Prepare payload
    const payload = {
      title: "Welcome back!",
      body: `Good to see you, ${user.name}`,
      url: "/dashboard",
    };

    // 6. Send welcome notification ONLY to this device.
    // Non-blocking: we don't await these sends so login remains fast.
    if (deviceId) {
      // Try using your sendToUser helper with targetDeviceId (if it supports it)
      try {
        // call it but don't await — attach a catch to avoid unhandled rejections
        // If sendToUser accepts a third options arg with targetDeviceId, it will be used.
        // If not, it might ignore the arg — that's why we also include a fallback below.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const p = sendToUser(user._id.toString(), payload, { targetDeviceId: deviceId });
        if (p && typeof p.catch === "function") p.catch((e: any) => console.error("sendToUser (target) failed:", e));
      } catch (e) {
        console.warn("sendToUser call failed or is unavailable, falling back to inline sender:", e);
      }

      // Fallback inline sender using web-push: find subscriptions with { userId, deviceId } and send to them
      // Fire-and-forget:
      (async () => {
        try {
          const subs = await Subscription.find({ userId: user._id.toString(), deviceId }).lean();
          if (!subs || subs.length === 0) return;

          const payloadStr = JSON.stringify(payload);
          const sendOptions = { TTL: 60, headers: { Urgency: "high" } };

          await Promise.all(
            subs.map(async (s: any) => {
              try {
                await webpush.sendNotification(s.subscription, payloadStr, sendOptions);
              } catch (err: any) {
                console.error("push error for", s.endpoint, err);
                if (err?.statusCode === 410 || err?.statusCode === 404) {
                  try { await Subscription.deleteOne({ endpoint: s.endpoint }); } catch (delErr) { console.error(delErr); }
                }
              }
            })
          );
        } catch (err) {
          console.error("inline send fallback error:", err);
        }
      })();
    } else {
      // If no deviceId provided, we intentionally DO NOT send the login welcome push to avoid broadcasting.
      // Optionally, you can broadcast, but it's safer to skip.
      console.log("No deviceId provided in login request — skipping device-targeted notification.");
    }

    return response;
  } catch (err) {
    console.error("login error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
