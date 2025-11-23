"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
type UserData = { name: string; rollno: string,password:string };

export default function HomePage() {
  const router=useRouter()
  const [userdata, setUserdata] = useState<UserData>({ name: "", rollno: "",password:"" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserdata(prev => ({ ...prev, [name]: value }));
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
        setMessage(`❌ ${json.error || "Failed to create"}`);
      } else {
        setUserdata({ name: "", rollno: "" ,password:""});
        router.push('/')
        
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
          <div className="logo-dot">S</div>
          <div>
            <h1 id="form-title">Register Student</h1>
          </div>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" placeholder="Student name" value={userdata.name} onChange={handleChange} required />
          </div>

          <div>
            <label htmlFor="rollno">Roll Number</label>
            <input id="rollno" name="rollno" type="text" placeholder="Roll number" value={userdata.rollno} onChange={handleChange} required />
          </div>

          <div>
            <label htmlFor="rollno">create password</label>
            <input id="password" name="password" type="password" placeholder="create a password" value={userdata.password} onChange={handleChange} required />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Account"}
            </button>
            
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            already have an account
            <button type="submit" className="btn btn-primary" >
                login
            </button>
            
          </div>

          
        </form>

      </section>
    </main>
  );
}
