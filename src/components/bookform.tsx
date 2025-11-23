"use client";

import React, { useEffect, useRef, useState } from "react";

type AddBookFormProps = {
  borrowerId: string;
  borrowerRollno?: string;
};

type FormState = {
  title: string;
  author: string;
  takenDate: string;
  dueDate: string;
};

type CheckResult = {
  exists: boolean;
  book?: {
    id: string;
    title: string;
    author?: string;
    takenDate?: string;
    dueDate?: string;
  };
};

const DEFAULT_LOAN_DAYS = 7;
function addDaysISO(isoDate: string, days: number) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AddBookForm({ borrowerId, borrowerRollno }: AddBookFormProps) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [exists, setExists] = useState<CheckResult | null>(null);

  const [form, setForm] = useState<FormState>({
    title: "",
    author: "",
    takenDate: new Date().toISOString().slice(0, 10),
    dueDate: addDaysISO(new Date().toISOString().slice(0, 10), DEFAULT_LOAN_DAYS),
  });

  const [dueDateTouched, setDueDateTouched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const titleRef = useRef<HTMLInputElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 30);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      resetForm();
    }
    return () => {
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function resetForm() {
    const todayISO = new Date().toISOString().slice(0, 10);
    setForm({
      title: "",
      author: "",
      takenDate: todayISO,
      dueDate: addDaysISO(todayISO, DEFAULT_LOAN_DAYS),
    });
    setMessage(null);
    setLoading(false);
    setExists(null);
    setChecking(false);
    setDueDateTouched(false);
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "dueDate") {
      setDueDateTouched(true);
      setForm((p) => ({ ...p, dueDate: value }));
      return;
    }
    if (name === "takenDate") {
      if (!dueDateTouched) {
        const newDue = addDaysISO(value, DEFAULT_LOAN_DAYS);
        setForm((p) => ({ ...p, takenDate: value, dueDate: newDue }));
      } else {
        setForm((p) => ({ ...p, takenDate: value }));
      }
      return;
    }
    setForm((p) => ({ ...p, [name]: value }));
  };

  // debounce title check
  useEffect(() => {
    const title = form.title.trim();
    if (!title || !borrowerId) {
      setExists(null);
      return;
    }
    const t = setTimeout(() => checkBookExists(title), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title, borrowerId]);

  const checkBookExists = async (title: string) => {
    setChecking(true);
    setExists(null);
    try {
      const url = `/api/library/check?title=${encodeURIComponent(title)}&borrowerId=${encodeURIComponent(
        borrowerId
      )}`;
      const res = await fetch(url);
      const json: CheckResult = await res.json();
      setExists(json);
      setMessage(json.exists ? "A copy already recorded — date fields disabled." : null);
    } catch (err) {
      console.error("check error", err);
      setExists(null);
      setMessage("Could not check existing books. Try again.");
    } finally {
      setChecking(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/library/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          borrowerId,
          borrowerRollno,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Failed to add book");
      } else {
        setMessage("Book added!");
        setTimeout(() => {
          setOpen(false);
          window.location.reload();
        }, 700);
      }
    } catch (err) {
      console.error("submit err", err);
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  };

  const onBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary" aria-expanded={open}>
        Add Book
      </button>

      {open && (
        <div
          ref={modalRef}
          onMouseDown={onBackdropClick}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            backdropFilter: "blur(6px)",
            background: "rgba(2,6,23,0.65)",
            padding: 20,
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            role="document"
            className="card modal-card"
            style={{
              border: "1px solid rgba(255,255,255,0.95)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22 }}>Add New Book</h2>
                <div className="muted" style={{ marginTop: 6 }}>
                  Add a book to your borrowed list. If a copy already exists, date fields are disabled.
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn btn-secondary"
                  aria-label="Close"
                  style={{ borderColor: "white" }}
                >
                  Close
                </button>
              </div>
            </div>

            <form onSubmit={submit} className="form" style={{ marginTop: 14 }}>
              <div>
                <label style={{ marginBottom: 8 }}>Title</label>
                <input
                  ref={titleRef}
                  name="title"
                  value={form.title}
                  onChange={onChange}
                  className="input"
                  placeholder="Book title"
                  required
                />
                {checking ? <div className="muted" style={{ marginTop: 6 }}>Checking for existing book…</div> : null}
              </div>

              <div>
                <label style={{ marginBottom: 8 }}>Author</label>
                <input
                  name="author"
                  value={form.author}
                  onChange={onChange}
                  className="input"
                  placeholder="Author (optional)"
                />
              </div>

              {exists && exists.exists && exists.book ? (
                <div className="form-card" style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700 }}>{exists.book.title}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    This book was previously recorded for you.
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 18 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Taken
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {exists.book.takenDate ? new Date(exists.book.takenDate).toLocaleDateString() : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Due
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {exists.book.dueDate ? new Date(exists.book.dueDate).toLocaleDateString() : "-"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="date-row" style={{ marginTop: 6, display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ marginBottom: 8 }}>Taken Date</label>
                    <input type="date" name="takenDate" value={form.takenDate} onChange={onChange} className="input" />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ marginBottom: 8 }}>Due Date</label>
                    <input type="date" name="dueDate" value={form.dueDate} onChange={onChange} className="input" />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  {loading ? "Adding…" : "Add Book"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
              </div>

              {message && (
                <div className={`msg ${message.includes("added") ? "success" : "error"}`} style={{ marginTop: 10 }}>
                  {message}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
