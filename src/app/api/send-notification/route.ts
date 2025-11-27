// src/app/api/notify-due-books/route.ts
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Book from "@/models/books";
import NotificationLog from "@/models/NotificationLog";
import { sendToUser } from "@/src/messagereusable/push";

const MS_HOUR = 1000 * 60 * 60;
const MS_DAY = 1000 * 60 * 60 * 24;
const THROTTLE_MS = 1 * MS_HOUR; // 6 hour throttle

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

/** days left relative to start of today (calendar days) */
function daysLeftFromDate(dueDate: Date | string, now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msLeft = new Date(dueDate).getTime() - startOfToday.getTime();
  return Math.ceil(msLeft / MS_DAY);
}

export async function POST(req: Request) {
  try {
    // 1) Validate CRON secret in Authorization header
    const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
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

    // 3) compute start-of-today and dueEnd (end of day two days from today)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // local midnight
    const dueEnd = new Date(startOfToday);
    dueEnd.setDate(dueEnd.getDate() + 2);
    dueEnd.setHours(23, 59, 59, 999);

    console.log(`[notify-due-books] running. startOfToday=${startOfToday.toISOString()} dueEnd=${dueEnd.toISOString()} force=${force}`);

    const booksDue = await Book.find({
      dueDate: { $gte: startOfToday, $lte: dueEnd },
      borrowerId: { $exists: true, $ne: null },
    }).lean();

    console.log("[notify-due-books] booksDue count:", booksDue?.length ?? 0);
    if (!booksDue || booksDue.length === 0) {
      console.log("[notify-due-books] no books due in window");
      return NextResponse.json({ ok: true, checked: 0, notified: 0, results: [] }, { status: 200 });
    }

    let notifiedCount = 0;
    const results: Array<
      | { bookId: string; status: "sent"; sentCount: number }
      | { bookId: string; status: "skipped"; reason: string }
      | { bookId: string; status: "error"; reason: string }
    > = [];

    console.log(
      `[notify-due-books] found ${booksDue.length} books due (from ${startOfToday.toISOString()} to ${dueEnd.toISOString()})`
    );

    for (const book of booksDue) {
      try {
        const userId = book.borrowerId?.toString?.() ?? null;
        if (!userId) {
          console.log("[notify-due-books] skipping book with no borrowerId:", book._id?.toString?.());
          results.push({ bookId: book._id.toString(), status: "skipped", reason: "missing borrowerId" });
          continue;
        }

        // days left relative to start of today (calendar days)
        const daysLeft = daysLeftFromDate(book.dueDate, now);

        console.log(
          `[notify-due-books] processing book=${book._id?.toString?.()} title="${book.title}" dueDate=${new Date(
            book.dueDate
          ).toISOString()} daysLeft=${daysLeft}`
        );

        // throttle: check last notification timestamp
        const log = await NotificationLog.findOne({ userId, bookId: book._id.toString() }).lean();
        const lastNotifiedAt = log?.lastNotifiedAt ? new Date(log.lastNotifiedAt) : null;
        const sinceLast = lastNotifiedAt ? now.getTime() - lastNotifiedAt.getTime() : Infinity;
        const shouldNotify = force || !lastNotifiedAt || sinceLast >= THROTTLE_MS;

        if (!shouldNotify) {
          const reason = lastNotifiedAt
            ? `throttled (lastNotifiedAt=${lastNotifiedAt.toISOString()})`
            : "throttled";
          console.log(
            "[notify-due-books] skipping due to throttle for user:",
            userId,
            "book:",
            book._id.toString(),
            "lastNotifiedAt:",
            lastNotifiedAt?.toISOString?.() ?? null
          );
          results.push({ bookId: book._id.toString(), status: "skipped", reason });
          continue;
        }

        const title = "Library reminder";
        const body =
          daysLeft <= 0
            ? `Your book "${book.title}" is due today. Please return it.`
            : daysLeft === 1
            ? `You have 1 day left to submit "${book.title} ${daysLeft}".`
            : `You have ${daysLeft} days left to submit "${book.title}".`;

        const payload = {
          title,
          body,
          url: `/library/${book._id.toString()}`,
          meta: { bookId: book._id.toString(), daysLeft },
          tag: `due-book-${userId}-${book._id.toString()}`, // helpful for SW dedupe
        };

        // call sendToUser and inspect its result
        try {
          console.log("[notify-due-books] about to call sendToUser for user=", userId, "book=", book._id.toString());
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

            results.push({ bookId: book._id.toString(), status: "sent", sentCount });
            notifiedCount += sentCount;
          } else {
            console.log(
              "[notify-due-books] no devices were sent for user (sentCount=0) — skipping NotificationLog update",
              userId,
              book._id.toString()
            );
            results.push({ bookId: book._id.toString(), status: "skipped", reason: "no devices found (sentCount=0)" });
          }
        } catch (sendErr: any) {
          console.error(
            "[notify-due-books] sendToUser threw for user",
            userId,
            "book",
            book._id?.toString?.(),
            sendErr
          );
          results.push({ bookId: book._id.toString(), status: "error", reason: String(sendErr?.message ?? sendErr) });
        }
      } catch (innerErr) {
        console.error("[notify-due-books] error processing book", book._id?.toString?.(), innerErr);
        results.push({ bookId: book._id?.toString?.() ?? "unknown", status: "error", reason: String(innerErr) });
      }
    }

    console.log(`[notify-due-books] finished: checked=${booksDue.length} notified=${notifiedCount}`);

    return NextResponse.json(
      { ok: true, checked: booksDue.length, notified: notifiedCount, results },
      { status: 200 }
    );
  } catch (err) {
    console.error("notify-due-books error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
