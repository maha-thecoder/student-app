import Link from "next/link";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/mongodb";
import Student from "@/models/student";
import type { Metadata } from "next";



export const metadata: Metadata = {
  title: "Student Portal",
  description: "Quick actions — library, submissions, attendance, add students",
};


type ServerUser = { id: string; name: string; rollno: string } | null;


async function getServerUser(): Promise<ServerUser> {
  try {
    const cookieStore = await cookies();
    const token =cookieStore.get("sessionToken")?.value;
    if (!token) return null;

    await connectDB();
    const user = await Student.findOne({token}).lean();
    if (!user) return null;
    return { id: user._id.toString(), name: user.name, rollno: user.rollno };
  } catch (err) {
    // If anything fails, return null — page still renders quickly
    console.error("getServerUser error:", err);
    return null;
  }
}


export default async function Homepage() {
  const user = await getServerUser();

  // Minimal, important features — keep the array data-driven and small
  const features = [
    {
      id: "library",
      title: "Library",
      description: "notifies the submission date,add books taken by the user",
      href: "/library",
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 19V5a1 1 0 011-1h3v16H5a1 1 0 01-1-1zM9 4h6v16H9V4zM17 4h2a1 1 0 011 1v14h-3V4z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      id: "book-submission",
      title: "Book Submission",
      description: "Submit assignments, lab reports or project documents.",
      href: "/library",
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 20h9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M4 6h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 6V4a4 4 0 018 0v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      id: "bus-attendance",
      title: "Bus Attendance",
      description: "Mark or review attendance on the campus bus route.",
      href: "/attendance/bus",
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 13v-5a3 3 0 013-3h12a3 3 0 013 3v5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M7 17h.01M17 17h.01M7 13h10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      id: "add-students",
      title: "Add Students",
      description: "Quickly add new student profiles and credentials.",
      href: "/students/new",
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 12a5 5 0 100-10 5 5 0 000 10zM6 20v-1a4 4 0 014-4h4a4 4 0 014 4v1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M19 8v6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M22 11h-6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    // Add a couple of "non-university" features that are useful
    {
      id: "quick-links",
      title: "Quick Links",
      description: "Create custom quick links for classes, groups, or vendors.",
      href: "/quick-links",
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M10 14l2-2 4 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 12v6a2 2 0 01-2 2h-6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 6v6a2 2 0 002 2h6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    }
  ];

  return (
    <main className="page-center">
      <div className="card w-100%">


        <section className="mb-6">
          <h1 className="text-2xl">Quick actions</h1>
          <p className="muted">Fast access to the most-used features — minimal, focused, and fast to load.</p>
        </section>

        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-20">
            {features.map((f) => (
              <Link
                key={f.id}
                href={f.href}
                className="border rounded-lg p-4 flex gap-3 items-start hover:shadow-sm transition-shadow"
                aria-label={f.title}
              >
                <div className="text-accent flex-shrink-0">{f.icon}</div>
                <div>
                  <div className="font-semibold">{f.title}</div>
                  <div className="muted" style={{ marginTop: 4 }}>{f.description}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );

  
}
