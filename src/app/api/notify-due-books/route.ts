// src/app/api/notify-due-books/route.ts

import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Book from "@/models/books";
import NotificationLog from "@/models/NotificationLog";
import Subscription from "@/models/Subscription"; // <-- if you have this
import { sendToUser } from "@/src/messagereusable/push";

const MS_HOUR = 1000 * 60 * 60;

// -----------------------------
//     FIXED SENT COUNT
// -----------------------------
function extractSentCount(sendResult: any): number {
  try {
    if (!sendResult) return 0;

    // direct numeric responses
    if (typeof sendResult === "number") return sendResult;
    if (typeof sendResult.sent === "number") return sendResult.sent;
    if (typeof sendResult.sentCount === "number") return sendResult.sentCount;
    if (typeof sendResult.success === "number") return sendResult.success;
    if (typeof sendResult.successCount === "number") return sendResult.successCount;

    // boolean success
    if (sendResult.success === true) {
      return typeof sendResult.count === "number" ? sendResult.count : 1;
    }

    // detect arrays (web-push libs, FCM libs)
    const arr =
      Array.isArray(sendResult) ? sendResult
      : Array.isArray(sendResult.results) ? sendResult.results
      : Array.isArray(sendResult.responses) ? sendResult.responses
      : Array.isArray(sendResult.raw) ? sendResult.raw
      : Array.isArray(sendResult.matched) ? sendResult.matched
      : null;

    if (Array.isArray(arr)) {
      return arr.filter((r) => {
        if (!r) return false;
        return (
          r.status === "sent" ||
          r.status === "ok" ||
          r.success === true ||
          r.error == null
        );
      }).length;
    }

    // fallback: search keys
    const keys = Object.keys(sendResult || {});
    for (const k of keys) {
      if (/sent|success|count|ok/i.test(k) && typeof sendResult[k] === "number") {
        return sendResult[k];
      }
    }
  } catch (e) {
    console.warn("extractSentCount error:", e);
  }

  return 0;
}

// -----------------------------
//         MAIN ROUTE
// -----------------------------

export async function POST(req: Request) {
  try {
    // 1) CRON secret validation
    const auth =
      req.headers.get("authorization") ||
      req.headers.get("Authorization");

    const expected = process.env.CRON_SECRET;
    if (!expected) {
      console.error("CRON_SECRET not configured");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    if (!auth || !auth.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = auth.split(" ")[1];
    if (token !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ?force=1
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";

    // 2) DB
    await connectDB();

    // 3) Find books due within 2 days
    const now = new Date();
    const dueEnd = new Date(now.getTime() + 2 * 24 * MS_HOUR);

    console.log(`[notify] now=${now.toISOString()} dueEnd=${dueEnd.toISOString()} force=${force}`);

    const booksDue = await Book.find({
      dueDate: { $gte: now, $lte: dueEnd },
      borrowerId: { $exists: true, $ne: null },
    }).lean();

    console.log("[notify] booksDue:", booksDue?.length ?? 0);

    if (!booksDue.length) {
      return NextResponse.json({ ok: true, checked: 0, notified: 0 });
    }

    let notifiedCount = 0;

    // loop over each due book
    for (const book of booksDue) {
      try {
        const userId = book.borrowerId?.toString?.();
        if (!userId) continue;

        const msLeft = new Date(book.dueDate).getTime() - now.getTime();
        const daysLeft = Math.ceil(msLeft / MS_HOUR / 24);

        console.log(
          `[notify] processing book=${book._id} title="${book.title}" daysLeft=${daysLeft}`
        );

        // throttle check
        const log = await NotificationLog.findOne({
          userId,
          bookId: book._id.toString(),
        }).lean();

        const lastNotifiedAt = log?.lastNotifiedAt
          ? new Date(log.lastNotifiedAt)
          : null;

        const sinceLast = lastNotifiedAt
          ? now.getTime() - lastNotifiedAt.getTime()
          : Infinity;

        const shouldNotify = force || !lastNotifiedAt || sinceLast >= 6 * MS_HOUR;

        if (!shouldNotify) {
          console.log(
            "[notify] throttle skip user:",
            userId,
            "lastNotifiedAt:",
            lastNotifiedAt?.toISOString()
          );
          continue;
        }

        // payload
        const title = "Library reminder";
        const body =
          daysLeft <= 0
            ? `Your book "${book.title}" is due today.`
            : daysLeft === 1
            ? `You have 1 day left to return "${book.title}".`
            : `You have ${daysLeft} days left to return "${book.title}".`;

        const payload = {
          title,
          body,
          url: `/library/${book._id}`,
          meta: { bookId: book._id.toString(), daysLeft },
        };

        // -----------------------------
        // call sendToUser
        // -----------------------------
        const sendResult = await sendToUser(userId, payload);

        let summary;
        try {
          summary = JSON.stringify(sendResult);
        } catch (e) {
          summary = String(sendResult);
        }

        console.log("[notify] sendToUser result:", summary);

        const sentCount = extractSentCount(sendResult);
        console.log("[notify] sentCount =>", sentCount);

        if (sentCount > 0) {
          await NotificationLog.updateOne(
            { userId, bookId: book._id.toString() },
            { $set: { lastNotifiedAt: now } },
            { upsert: true }
          );
          notifiedCount += sentCount;
        } else {
          // ---------- DEBUG: check subscriptions ----------
          try {
            const subs = await Subscription.find({ userId }).lean();
            console.log("[notify] subscriptions:", subs.length, subs.slice(0, 3));
          } catch (e) {
            console.log("[notify] subscription debug error:", e);
          }
          // ------------------------------------------------
          console.log("[notify] no devices sent — skipping log update");
        }
      } catch (innerErr) {
        console.error("[notify] error processing book", book._id, innerErr);
      }
    }

    console.log(`[notify] finished checked=${booksDue.length} notified=${notifiedCount}`);

    return NextResponse.json({
      ok: true,
      checked: booksDue.length,
      notified: notifiedCount,
    });
  } catch (err) {
    console.error("notify error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
