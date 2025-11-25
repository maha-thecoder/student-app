// src/app/api/auth/link-subscriptions/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import Subscription from '@/models/Subscription';

const JWT_SECRET = process.env.JWT_SECRET || 'mahanth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const deviceId = body?.deviceId;
    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId required' }, { status: 400 });
    }

    // extract user id from HttpOnly cookie
    const cookieStore =await cookies();
    const token = cookieStore.get('sessionToken')?.value ?? null;
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let userId: string | null = null;
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      userId = decoded?.sub ?? null;
    } catch (err) {
      console.warn('Invalid session token in link-subscriptions:', err);
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    await connectDB();

    const now = new Date();
    // attach any subscriptions having this deviceId to this userId
    const result = await Subscription.updateMany(
      { deviceId },
      { $set: { userId, lastSeenAt: now, isActive: true } }
    );

return NextResponse.json(
  { success: true, matched: result.matchedCount ?? 0 },
  { status: 200 }
);
  } catch (err) {
    console.error('link-subscriptions error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
