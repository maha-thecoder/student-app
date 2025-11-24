"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type UserData = { rollno: string; password: string };

export default function LoginPage() {
  const router = useRouter();
  const [userdata, setUserdata] = useState<UserData>({ rollno: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserdata((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userdata),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(`❌ ${json.error || "Login failed"}`);
      } else {
        // On successful login your API should set cookie/session and optionally return user info
        setMessage("✅ Logged in — redirecting…");
        setUserdata({ rollno: "", password: "" });
        // give the message a moment to be visible, then navigate
        setTimeout(() => router.push("/"), 500);
      }
    } catch (err) {
      setMessage("❌ Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-center">
      <section className="card" aria-labelledby="login-title">
        <div className="card-header">
          <div className="logo-dot" aria-hidden>
            
          </div>
          <div>
            <h1 id="login-title" className="font-weight: 600 text-2xl center italic center">Sign In</h1>
            <p className="muted" style={{ marginTop: 10,marginBottom:10 }}>
              Sign in with your roll number to access the student portal.
            </p>
          </div>
        </div>

        <form className="form" onSubmit={handleSubmit} aria-describedby="login-message">
          <div>
            <label htmlFor="rollno">Roll number</label>
            <input
              id="rollno"
              name="rollno"
              type="text"
              placeholder="e.g. 21CS1001"
              value={userdata.rollno}
              onChange={handleChange}
              autoComplete="username"
              required
              className="input"
              style={{color:"black"}}
            />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              value={userdata.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
              className="input"
              style={{color:"black"}}

            />
          </div>

          {message && (
            <div id="login-message" className={`msg ${message.startsWith("✅") ? "success" : "error"}`} role="status" aria-live="polite" style={{ marginTop: 8 }}>
              {message}
            </div>
          )}

          <div className="form-actions" style={{ marginTop: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} aria-disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>

           
          </div>
          <div className="pagetransfer">
                      create an account <Link href="/signup" className="btn btn-secondary" aria-label="Sign in to existing account">
                        create account
                      </Link>
                      </div>
        </form>
      </section>
    </main>
  );
}
