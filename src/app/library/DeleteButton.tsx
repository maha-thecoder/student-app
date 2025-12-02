// src/app/library/DeleteButton.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";

type Props = {
  bookId: string;
};

export default function DeleteButton({ bookId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this book?")) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/books/${bookId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Failed to delete book");
        return;
      }
      // refresh server component data
      router.refresh();
    } catch (err) {
      console.error("delete error:", err);
      alert("Failed to delete book");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      className="btn btn-danger"
      disabled={loading}
      aria-busy={loading}
    >
      {loading ? "Deleting…" : "Delete"}
    </button>
  );
}
