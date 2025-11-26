import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Student from "@/models/student";
import Subscription from "@/models/Subscription";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
// import { sendToUser } from "@/src/messagereusable/push"; // removed to avoid double-sends
import webpush from "web-push";

const JWT_SECRET = process.env.JWT_SECRET || "mahanth";

// setup VAPID (used by inline sender)
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

    // required login fields
    const { rollno, password } = body ?? {};

    // optional linking fields
    let deviceId: string | null = null;
    let clientSubscription: any | null = null;

    if (typeof body?.deviceId === "string" && body.deviceId.trim() !== "") {
      deviceId = body.deviceId.trim();
    }

    if (body?.subscription && typeof body.subscription === "object" && body.subscription.endpoint) {
      clientSubscription = body.subscription;
      if (!deviceId && typeof body.subscription.deviceId === "string" && body.subscription.deviceId.trim() !== "") {
        deviceId = body.subscription.deviceId.trim();
      }
    }

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

    // --- Safe attach logic (Option A) ---
    try {
      const now = new Date();

      if (clientSubscription && clientSubscription.endpoint) {
        const existing = await Subscription.findOne({ endpoint: clientSubscription.endpoint }).lean();

        if (!existing || !existing.userId || existing.userId.toString() === user._id.toString()) {
          const updateObj: any = {
            subscription: clientSubscription,
            userId: user._id.toString(),
            lastSeenAt: now,
            isActive: true,
          };
          if (deviceId) updateObj.deviceId = deviceId;

          await Subscription.findOneAndUpdate(
            { endpoint: clientSubscription.endpoint },
            { $set: updateObj, $setOnInsert: { createdAt: now } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          console.log("[login] attached subscription by endpoint for user", user._id.toString());
        } else {
          console.log("[login] subscription endpoint already owned by different user — skipping attach");
        }
      } else if (deviceId) {
        const res = await Subscription.updateMany(
          { deviceId, $or: [{ userId: { $exists: false } }, { userId: null }, { userId: user._id.toString() }] },
          { $set: { userId: user._id.toString(), lastSeenAt: now, isActive: true } }
        );
        console.log("[login] updateMany by deviceId result", {
          matchedCount: (res as any)?.matchedCount ?? (res as any)?.n ?? null,
          modifiedCount: (res as any)?.modifiedCount ?? (res as any)?.nModified ?? null,
        });
      } else {
        console.log("[login] no subscription or deviceId provided; skipping attach.");
      }
    } catch (attachErr) {
      console.error("[login] subscription attach failed", attachErr);
      // do not block login on attach failure
    }

    // 4. Prepare payload
    const payload = {
      title: "Welcome back!",
      body: `Good to see you, ${user.name}`,
      url: "/dashboard",
    };

    // 5. Send welcome notification — inline sender ONLY with dedupe
    if (deviceId) {
      (async () => {
        try {
          // fetch subscriptions for this user and deviceId
          const subs = await Subscription.find({ userId: user._id.toString(), deviceId }).lean();
          if (!subs || subs.length === 0) {
            console.log("[login] no matching subscriptions found for deviceId; skipping send");
            return;
          }

          // dedupe endpoints — sometimes duplicates exist in DB
          const seen = new Set<string>();
          const uniqueSubs = subs.filter((s: any) => {
            const ep = s.endpoint || s.subscription?.endpoint;
            if (!ep) return false;
            if (seen.has(ep)) return false;
            seen.add(ep);
            return true;
          });

          if (uniqueSubs.length === 0) return;

          const payloadStr = JSON.stringify(payload);
          const sendOptions = { TTL: 60, headers: { Urgency: "high" } };

          await Promise.all(
            uniqueSubs.map(async (s: any) => {
              const subObj = s.subscription || s;
              try {
                await webpush.sendNotification(subObj, payloadStr, sendOptions);
                console.log("[login] inline send OK to", subObj?.endpoint || s.endpoint);
              } catch (err: any) {
                console.error("push error for", subObj?.endpoint || s.endpoint, err);
                // cleanup expired subscriptions
                if (err?.statusCode === 410 || err?.statusCode === 404) {
                  try {
                    await Subscription.deleteOne({ endpoint: subObj?.endpoint || s.endpoint });
                    console.log("[login] removed expired subscription", subObj?.endpoint || s.endpoint);
                  } catch (delErr) {
                    console.error(delErr);
                  }
                }
              }
            })
          );
        } catch (err) {
          console.error("inline send fallback error:", err);
        }
      })();
    } else {
      console.log("No deviceId provided in login request — skipping device-targeted notification.");
    }

    return response;
  } catch (err) {
    console.error("login error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
