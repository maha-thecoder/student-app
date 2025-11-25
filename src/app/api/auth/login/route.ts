// src/app/api/auth/login/route.ts

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Student from "@/models/student";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken"
import { cookies } from "next/headers";
import { sendToUser } from "@/src/messagereusable/push";


export async function POST(req: Request) {
  try {
    await connectDB();
    const JWT_SECRET='mahanth'

    const { rollno, password } = await req.json();

    if (!rollno || !password) {
      return NextResponse.json(
        { error: "Roll number and password are required" },
        { status: 400 }
      );
    }

    // 1. CHECK IF STUDENT EXISTS
    const user = await Student.findOne({ rollno }).lean();

    if (!user) {
      return NextResponse.json(
        { error: "Invalid roll number or password" },
        { status: 401 }
      );
    }

    // 2. COMPARE PASSWORD
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid roll number or password" },
        { status: 401 }
      );
    }

   

    // 3. SUCCESS
    const response= NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        rollno: user.rollno,
      },
    });
     const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax" as const,
      // example: set cookie for 7 days
      maxAge: 60 * 60 * 24 * 7,
    };

     const token = jwt.sign({ sub: user._id.toString() }, JWT_SECRET, { expiresIn: "7d" });


        response.cookies.set("sessionToken", token, cookieOptions);

        const payload = {
      title: 'Welcome back!',
      body: `Good to see you, ${user.name}`,
      url: '/dashboard',
    };

        sendToUser(user._id.toString(), payload).catch((e) => console.error('login push failed', e));


        return response


  } catch (err) {
    console.error("login error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
    
  }
  
}
