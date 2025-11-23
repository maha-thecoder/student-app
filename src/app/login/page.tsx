"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

type UserData = {  rollno: string,password:"" };

export default function HomePage() {
  const router=useRouter()
  const [userdata, setUserdata] = useState<UserData>({  rollno: "" ,password:""});
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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userdata),
      });

      const json = await res.json();

      if (!res.ok) {
        setMessage(`❌ ${json.error || "Failed to create"}`);
      } else {
        setMessage(`✅ Created (id: ${json.id})`);
        console.log('SUCESS')
        setUserdata({ rollno: "",password:"" });
        router.push("/")
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
            <label htmlFor="rollno">Roll Number</label>
            <input id="rollno" name="rollno" type="text" placeholder="Roll number" value={userdata.rollno} onChange={handleChange} required />
          </div>
            <div>
            <label htmlFor="rollno">enter password</label>
            <input id="password" name="password" type="password" placeholder="enter password" value={userdata.password} onChange={handleChange} required />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "logging..." : "login"}
            </button>
           
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            create an account
            <button type="submit" className="btn btn-primary">
            signup
            </button>
           
          </div>
        </form>

      </section>
    </main>
  );
}
