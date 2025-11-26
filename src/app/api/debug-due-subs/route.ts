// src/app/api/debug-due-subs/route.ts
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Book from "@/models/books";
import Subscription from "@/models/Subscription";

export async function GET(req: Request) {
  await connectDB();
  const now = new Date();
  const dueEnd = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const booksDue = await Book.find({
    dueDate: { $gte: now, $lte: dueEnd },
    borrowerId: { $exists: true, $ne: null },
  }).lean();

  const out: any[] = [];
  for (const b of booksDue) {
    const userId = b.borrowerId?.toString?.();
    const subs = userId ? await Subscription.find({ userId }).lean() : [];
    out.push({
      bookId: b._id.toString(),
      title: b.title,
      dueDate: new Date(b.dueDate).toISOString(),
      borrowerId: userId,
      subscriptionsFound: subs.length,
      subsPreview: subs.slice(0, 5).map((s: any) => ({
        _id: s._id?.toString?.(),
        endpoint: s.subscription?.endpoint || s.endpoint || null,
        deviceId: s.deviceId || null,
        userId: s.userId || null,
        isActive: s.isActive || null,
      })),
    });
  }

  return NextResponse.json({ now: now.toISOString(), dueEnd: dueEnd.toISOString(), count: out.length, results: out });
}
