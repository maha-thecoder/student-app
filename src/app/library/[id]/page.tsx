// app/library/[id]/page.tsx
import React from "react";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import Book from "@/models/books";
import { Types } from "mongoose";

type Props = { params: { id: string } };

export default async function BookDetailsPage({ params }: Props) {
  const { id } = params;

  // Validate id quickly to avoid Mongoose casting errors
  if (!Types.ObjectId.isValid(id)) {
    return notFound();
  }

  try {
    await connectDB();
    const book = await Book.findById(id).lean();
    if (!book) return notFound();

    const takenDateStr = book.takenDate ? new Date(book.takenDate).toLocaleDateString() : "N/A";
    const dueDateStr = book.dueDate ? new Date(book.dueDate).toLocaleDateString() : "N/A";
    const overdue = book.dueDate ? new Date(book.dueDate).getTime() < Date.now() : false;

    return (
      <main style={{ padding: 24 }}>
        <h1>{book.title}</h1>
        <p className="muted">{book.author || "Unknown author"}</p>

        <section style={{ marginTop: 12 }}>
          <div>
            <strong>Taken:</strong> {takenDateStr}
          </div>
          <div>
            <strong>Due:</strong> {dueDateStr} {overdue ? <span style={{ color: "red" }}> (Overdue)</span> : null}
          </div>
          <div style={{ marginTop: 12 }}>
            <strong>Borrower roll no:</strong> {book.borrowerRollno ?? "—"}
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <a href="/library" className="btn">Back to list</a>
        </section>
      </main>
    );
  } catch (err) {
    // log server error; do not expose details to users
    console.error("book details error:", err);
    // show notFound or a friendly error page
    return notFound();
  }
}
