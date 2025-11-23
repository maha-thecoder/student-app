import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Student from "@/models/student";
import bcrypt from "bcryptjs";


const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const name = String(body.name || "").trim();
    const rollno = String(body.rollno || "").trim();
    const password = String(body.password || "");

    if (!name || !rollno || !password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
    }

    // check if user already exists
    const existing = await Student.findOne({ rollno }).lean();
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    // hash the password
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await Student.create({ name, rollno, password: hashed });

    // return safe response (do NOT return password)
    return NextResponse.json({
      success: true,
      user: { id: user._id.toString(), name: user.name, rollno: user.rollno, createdAt: user.createdAt },
    }, { status: 201 });
  } catch (err: any) {
    console.error("signup error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}