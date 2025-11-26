// src/app/api/library/add/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Book from "@/models/books";
import NotificationLog from "@/models/NotificationLog";
import { sendToUser } from "@/src/messagereusable/push";

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();

    const title = String(body.title || "").trim();
    const author = String(body.author || "").trim();
    const takenDate = body.takenDate ? new Date(body.takenDate) : new Date();
    const dueDate = body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const borrowerRollno = String(body.borrowerRollno || "").trim() || undefined;
    const borrowerId = body.borrowerId;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // create the book
    const created = await Book.create({ title, author, takenDate, dueDate, borrowerRollno, borrowerId });

    // --- safe immediate notify (non-blocking) ---
    (async () => {
      try {
        const book = created;
        if (!book?.borrowerId) return;
        const borrowerIdStr = book.borrowerId.toString?.() ?? book.borrowerId;

        const now = new Date();
        const due = new Date(book.dueDate);
        const msLeft = due.getTime() - now.getTime();
        const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

        // only notify if due within 0..2 days
        if (msLeft < 0 || msLeft > TWO_DAYS_MS) {
          console.log("[library/add] new book not in notify window; skipping immediate notify", {
            bookId: book._id?.toString?.(),
            due: due.toISOString(),
          });
          return;
        }

        // throttle check (6 hours)
        const log = await NotificationLog.findOne({ userId: borrowerIdStr, bookId: book._id?.toString?.() }).lean();
        // Note: above line had a typo in some contexts; ensure it's book._id
        const lastNotifiedAt = log?.lastNotifiedAt ? new Date(log.lastNotifiedAt) : null;
        const sinceLast = lastNotifiedAt ? now.getTime() - lastNotifiedAt.getTime() : Infinity;
        const THROTTLE_MS = 6 * 60 * 60 * 1000; // 6 hours

        if (lastNotifiedAt && sinceLast < THROTTLE_MS) {
          console.log("[library/add] skipping notify due to throttle for", borrowerIdStr, "book", book._id.toString());
          return;
        }

        const titleMsg = "Library reminder";
        const bodyMsg =
          daysLeft <= 0
            ? `Your book "${book.title}" is due today. Please return it.`
            : daysLeft === 1
            ? `You have 1 day left to submit "${book.title}".`
            : `You have ${daysLeft} days left to submit "${book.title}".`;

        const payload = {
          title: titleMsg,
          body: bodyMsg,
          url: `/library/${book._id.toString()}`,
          meta: { bookId: book._id.toString(), daysLeft },
          tag: `due-book-${borrowerIdStr}-${book._id.toString()}`,
        };

        try {
          const sendResult = await sendToUser(borrowerIdStr, payload);
          console.log("[library/add] sendToUser result for user", borrowerIdStr, "book", book._id.toString(), sendResult);

          // === Safe extraction of sent count (TypeScript-friendly) ===
          const sentCount =
            typeof sendResult === "number"
              ? sendResult
              : ((sendResult as any)?.sent ?? (sendResult as any)?.sentCount ?? 0);

          if (sentCount > 0) {
            await NotificationLog.updateOne(
              { userId: borrowerIdStr, bookId: book._id.toString() },
              { $set: { lastNotifiedAt: new Date() } },
              { upsert: true }
            );
          }
        } catch (err) {
          console.error("[library/add] immediate notify failed for user", borrowerIdStr, "book", book._id.toString(), err);
        }
      } catch (err) {
        console.error("[library/add] immediate notify outer error:", err);
      }
    })();
    // --- end immediate notify ---

    return NextResponse.json({ success: true, id: created._id.toString() }, { status: 201 });
  } catch (err: any) {
    console.error("add book error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
