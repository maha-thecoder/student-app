import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Book from "@/models/books";

// Define the type for params
interface Params {
  params: {
    id: string;
  };
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await connectDB();

    const { id } = params;

    const deleted = await Book.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: "Book deleted" });
  } catch (err) {
    console.error("DELETE /books/[id] error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
