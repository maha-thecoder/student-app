// src/app/api/notify-due-books/route.ts
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Book from "@/models/books";
import NotificationLog from "@/models/NotificationLog";
import { sendToUser } from "@/src/messagereusable/push";

const MS_HOUR = 1000 * 60 * 60;

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

    // 2) connect DB
    await connectDB();

    // 3) find books due within 2 days
    const now = new Date();
    const dueEnd = new Date(now.getTime() + 2 * 24 * MS_HOUR);

    const booksDue = await Book.find({
      dueDate: { $gte: now, $lte: dueEnd },
      borrowerId: { $exists: true, $ne: null },
    }).lean();

    if (!booksDue || booksDue.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, notified: 0 }, { status: 200 });
    }

    let notifiedCount = 0;
    for (const book of booksDue) {
      try {
        const userId = book.borrowerId?.toString?.() ?? null;
        if (!userId) continue;

        // days left
        const msLeft = new Date(book.dueDate).getTime() - now.getTime();
        const daysLeft = Math.ceil(msLeft / MS_HOUR / 24);

        // get last notification for this user+book
        const log = await NotificationLog.findOne({ userId, bookId: book._id.toString() }).lean();
        const shouldNotify =
          !log || !log.lastNotifiedAt || (now.getTime() - new Date(log.lastNotifiedAt).getTime()) >= 6 * MS_HOUR;

        if (!shouldNotify) continue;

        const title = "Library reminder";
        const body =
          daysLeft <= 0
            ? `Your book "${book.title}" is due today. Please return it.`
            : daysLeft === 1
            ? `You have 1 day left to submit "${book.title}".`
            : `You have ${daysLeft} days left to submit "${book.title}".`;

        const payload = { title, body, url: `/library/${book._id.toString()}`, meta: { bookId: book._id.toString(), daysLeft } };

        try {
          await sendToUser(userId, payload); // sends to user's devices (concurrency handled in helper)
          notifiedCount++;

          await NotificationLog.updateOne(
            { userId, bookId: book._id.toString() },
            { $set: { lastNotifiedAt: now } },
            { upsert: true }
          );
        } catch (sendErr) {
          console.error("Failed to send notification for", userId, book._id, sendErr);
        }
      } catch (innerErr) {
        console.error("Error processing book", book._id, innerErr);
      }
    }

    return NextResponse.json({ ok: true, checked: booksDue.length, notified: notifiedCount }, { status: 200 });
  } catch (err) {
    console.error("notify-due-books error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
