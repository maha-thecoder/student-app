// src/app/library/page.tsx
import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/mongodb";
import Book from "@/models/books";
import AddBookForm from "@/src/components/bookform";
import jwt from "jsonwebtoken";
import Student from "@/models/student";
import DeleteButton from "./DeleteButton";

type BookView = {
  id: string;
  title: string;
  author?: string;
  takenDate: string;
  dueDate: string;
  borrowerRollno?: string;
};

function daysBetween(dateFromISO: string) {
  const taken = new Date(dateFromISO);
  const now = new Date();
  const ms = now.getTime() - taken.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export default async function LibraryPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("sessionToken")?.value ?? null;

  let user: { id: string; name?: string; rollno?: string } | null = null;
  let docs: any[] = [];

  if (token) {
    try {
      await connectDB();
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "mahanth");
      const studentId = decoded.sub;
      const student = await Student.findById(studentId).lean();
      if (student) {
        user = { id: student._id.toString(), name: student.name, rollno: student.rollno };
        docs = await Book.find({
          $or: [{ borrowerId: student._id }, { borrowerRollno: student.rollno }],
        })
          .sort({ takenDate: -1 })
          .lean();
      }
    } catch (err) {
      console.error("library page error:", err);
      docs = [];
    }
  }

  const books: BookView[] = (docs || []).map((b: any) => ({
    id: b._id.toString(),
    title: b.title,
    author: b.author,
    takenDate: b.takenDate?.toISOString(),
    dueDate: b.dueDate?.toISOString(),
    borrowerRollno: b.borrowerRollno,
  }));

  return (
    <main className="library-shell" style={{ paddingTop: 76 }}>
      <div className="library-inner">
        <header className="library-hero">
          <div>
            <h1 className="library-title">Library — Your Borrowed Books</h1>
            <p className="muted library-sub">Shows taken and submission dates, and days passed since taken.</p>
            {!user && (
              <p className="muted" style={{ marginTop: 6 }}>
                You are not signed in. <Link href="/login" className="link-cta">Sign in</Link> to see your borrowed books.
              </p>
            )}
          </div>

          <div className="hero-actions">
            {user ? (
              // client component
              // @ts-ignore
              <AddBookForm borrowerId={user.id} borrowerRollno={user.rollno} />
            ) : null}
          </div>
        </header>

        <section className="library-list-wrap">
          {user === null ? (
            <div className="muted">Sign in to view your books.</div>
          ) : books.length === 0 ? (
            <div className="muted">No books found for your account.</div>
          ) : (
            <div className="library-list">
              {books.map((b) => {
                const daysPassed = daysBetween(b.takenDate);
                const dueDateStr = new Date(b.dueDate).toLocaleDateString();
                const takenDateStr = new Date(b.takenDate).toLocaleDateString();
                const overdue = new Date(b.dueDate).getTime() < Date.now();

                return (
                  <article key={b.id} className="book-card">
                    <div className="book-main">
                      <div className="book-title">{b.title}</div>
                      <div className="muted book-meta">{b.author || "Unknown author"}</div>
                      {b.borrowerRollno && <div className="muted book-meta">Borrower: {b.borrowerRollno}</div>}
                    </div>

                    <div className="book-side">
                      <div className="book-dates">
                        <div className="muted small">Taken</div>
                        <div className="strong">{takenDateStr}</div>
                        <div className="muted small" style={{ marginTop: 8 }}>Submit by</div>
                        <div className="strong">{dueDateStr}</div>
                      </div>

                      <div className="book-stats">
                        <div className="days">{daysPassed}</div>
                        <div className="muted small">{daysPassed === 1 ? "day passed" : "days passed"}</div>
                      </div>

                      <div className="book-actions">
            <DeleteButton bookId={b.id} />

                        <button
                          className="btn status-btn"
                          data-overdue={overdue ? "true" : "false"}
                          aria-pressed={overdue}
                          style={{ backgroundColor: overdue ? "red" : "blue" }}
                        >
                          {overdue ? "Overdue" : "On time"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
