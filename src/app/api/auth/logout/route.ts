// /app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const res = NextResponse.json({ success: true });

    // Clear the cookie by setting Max-Age=0 (or empty value)
    res.cookies.set("sessionToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 0, // effectively deletes the cookie
    });

    return res;
  } catch (err) {
    console.error("logout error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
