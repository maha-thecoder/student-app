import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Book from "@/models/books";


export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();

    const title = String(body.title || "").trim();
    const author = String(body.author || "").trim();
    const takenDate = body.takenDate ? new Date(body.takenDate) : new Date();
    const dueDate = body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const borrowerRollno = String(body.borrowerRollno || "").trim() || undefined;
    const borrowerId=body.borrowerId

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const created = await Book.create({ title, author, takenDate, dueDate, borrowerRollno,borrowerId });

    return NextResponse.json({ success: true, id: created._id.toString() }, { status: 201 });
  } catch (err: any) {
    console.error("add book error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}