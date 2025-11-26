// src/app/api/notify-due-books/route.ts
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Book from "@/models/books";
import NotificationLog from "@/models/NotificationLog";
import { sendToUser } from "@/src/messagereusable/push";

const MS_HOUR = 1000 * 60 * 60;

function extractSentCount(sendResult: any): number {
  try {
    if (sendResult == null) return 0;
    if (typeof sendResult === "number") return sendResult;
    if (typeof sendResult.sent === "number") return sendResult.sent;
    if (typeof sendResult.sentCount === "number") return sendResult.sentCount;
    const arr = Array.isArray(sendResult)
      ? sendResult
      : Array.isArray(sendResult.matched)
      ? sendResult.matched
      : Array.isArray(sendResult.raw)
      ? sendResult.raw
      : Array.isArray(sendResult.results)
      ? sendResult.results
      : null;
    if (Array.isArray(arr)) {
      return arr.filter((r: any) => r && (r.status === "sent" || r.status === "ok" || r.success === true)).length;
    }
  } catch (e) {
    console.warn("extractSentCount error:", e);
  }
  return 0;
}

export async function POST(req: Request) {
  try {
    // 1) Validate CRON secret in Authorization header
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      console.error("CRON_SECRET not configured in environment");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    if (!auth || !auth.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = auth.split(" ")[1];
    if (token !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // allow force mode for testing: POST /api/notify-due-books?force=1
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";

    // 2) connect DB
    await connectDB();

    // 3) find books due within 2 days
    const now = new Date();
    const dueEnd = new Date(now.getTime() + 2 * 24 * MS_HOUR);

    console.log(`[notify-due-books] running. now=${now.toISOString()} dueEnd=${dueEnd.toISOString()} force=${force}`);

    const booksDue = await Book.find({
      dueDate: { $gte: now, $lte: dueEnd },
      borrowerId: { $exists: true, $ne: null },
    }).lean();

    console.log("booksDue:", booksDue?.length ?? 0);
    if (!booksDue || booksDue.length === 0) {
      console.log("[notify-due-books] no books due in window");
      return NextResponse.json({ ok: true, checked: 0, notified: 0 }, { status: 200 });
    }

    let notifiedCount = 0;
    console.log(
      `[notify-due-books] found ${booksDue.length} books due (from ${now.toISOString()} to ${dueEnd.toISOString()})`
    );

    for (const book of booksDue) {
      try {
        const userId = book.borrowerId?.toString?.() ?? null;
        if (!userId) {
          console.log("[notify-due-books] skipping book with no borrowerId:", book._id?.toString?.());
          continue;
        }

        // days left (rounded up)
        const msLeft = new Date(book.dueDate).getTime() - now.getTime();
        const daysLeft = Math.ceil(msLeft / MS_HOUR / 24);

        console.log(
          `[notify-due-books] processing book=${book._id?.toString?.()} title="${book.title}" dueDate=${new Date(
            book.dueDate
          ).toISOString()} daysLeft=${daysLeft}`
        );

        // throttle: check last notification timestamp
        const log = await NotificationLog.findOne({ userId, bookId: book._id.toString() }).lean();
        const lastNotifiedAt = log?.lastNotifiedAt ? new Date(log.lastNotifiedAt) : null;
        const sinceLast = lastNotifiedAt ? now.getTime() - lastNotifiedAt.getTime() : Infinity;
        const shouldNotify = force || !lastNotifiedAt || sinceLast >= 6 * MS_HOUR;

        if (!shouldNotify) {
          console.log(
            "[notify-due-books] skipping due to throttle for user:",
            userId,
            "book:",
            book._id.toString(),
            "lastNotifiedAt:",
            lastNotifiedAt?.toISOString?.() ?? null
          );
          continue;
        }

        const title = "Library reminder";
        const body =
          daysLeft <= 0
            ? `Your book "${book.title}" is due today. Please return it.`
            : daysLeft === 1
            ? `You have 1 day left to submit "${book.title}".`
            : `You have ${daysLeft} days left to submit "${book.title}".`;

        const payload = {
          title,
          body,
          url: `/library/${book._id.toString()}`,
          meta: { bookId: book._id.toString(), daysLeft },
        };

        // call sendToUser and inspect its result
        try {
          const sendResult = await sendToUser(userId, payload);
          const sentCount = extractSentCount(sendResult);

          console.log(
            "[notify-due-books] sendToUser raw result for user",
            userId,
            "book",
            book._id.toString(),
            "=>",
            JSON.stringify(sendResult)
          );
          console.log("[notify-due-books] interpreted sentCount =>", sentCount);

          if (sentCount > 0) {
            try {
              await NotificationLog.updateOne(
                { userId, bookId: book._id.toString() },
                { $set: { lastNotifiedAt: now } },
                { upsert: true }
              );
            } catch (logErr) {
              console.error(
                "[notify-due-books] failed to update NotificationLog for",
                userId,
                "book",
                book._id.toString(),
                logErr
              );
            }

            notifiedCount += sentCount;
          } else {
            console.log(
              "[notify-due-books] no devices were sent for user (sentCount=0) — skipping NotificationLog update",
              userId,
              book._id.toString()
            );
          }
        } catch (sendErr) {
          console.error(
            "[notify-due-books] sendToUser threw for user",
            userId,
            "book",
            book._id?.toString?.(),
            sendErr
          );
        }
      } catch (innerErr) {
        console.error("[notify-due-books] error processing book", book._id?.toString?.(), innerErr);
      }
    }

    console.log(`[notify-due-books] finished: checked=${booksDue.length} notified=${notifiedCount}`);

    return NextResponse.json({ ok: true, checked: booksDue.length, notified: notifiedCount }, { status: 200 });
  } catch (err) {
    console.error("notify-due-books error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
