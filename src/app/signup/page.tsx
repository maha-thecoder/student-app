"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type UserData = { name: string; rollno: string; password: string };

export default function SignupPage() {
  const router = useRouter();
  const [userdata, setUserdata] = useState<UserData>({ name: "", rollno: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserdata((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userdata),
      });

      const json = await res.json();

      if (!res.ok) {
        setMessage(`❌ ${json.error || "Failed to create account"}`);
      } else {
        setUserdata({ name: "", rollno: "", password: "" });
        // success feedback then redirect to sign in
        router.push("/auth/login");
      }
    } catch (err) {
      setMessage("❌ Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-center">
      <section className="card" aria-labelledby="form-title">
        <div className="card-header">
          <div className="logo-dot" aria-hidden>
            S
          </div>
          <div>
            <h1 id="form-title" className="font-weight: 600 text-2xl center italic center">Create Student Account</h1>
            <p className="muted" style={{ marginTop: 6,marginBottom:10 }}>
              Register to borrow books, track submissions and access quick tools.
            </p>
          </div>
        </div>

        <form className="form" onSubmit={handleSubmit} aria-describedby="form-message">
          <div>
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Student full name"
              value={userdata.name}
              onChange={handleChange}
              required
              autoComplete="name"
              className="input"
              style={{color:"black"}}
            />
          </div>

          <div>
            <label htmlFor="rollno">Roll number</label>
            <input
              id="rollno"
              name="rollno"
              type="text"
              placeholder="e.g. 21CS1001"
              value={userdata.rollno}
              onChange={handleChange}
              required
              autoComplete="username"
              className="input"
              style={{color:"black"}}
            />
          </div>

          <div>
            <label htmlFor="password">Create password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Create a secure password"
              value={userdata.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              className="input"
              style={{color:"black"}}
            />
          </div>

          {/* messages */}
          {message && (
            <div id="form-message" className="msg error" role="status" aria-live="polite" style={{ marginTop: 8 }}>
              {message}
            </div>
          )}

          <div className="form-actions" style={{ marginTop: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} aria-disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create account"}
            </button>

            {/* Sign in link (do NOT submit the form) */}
         
          </div>
          <div className="pagetransfer">
            Already have an account <Link href="/login" className="btn btn-secondary" aria-label="Sign in to existing account">
              Sign in
            </Link>
            </div>
        </form>
      </section>
    </main>
  );
}
