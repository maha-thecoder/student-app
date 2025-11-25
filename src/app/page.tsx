export const dynamic = "force-dynamic";
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
