// src/app/api/subscribe/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import Subscription from '@/models/Subscription';

const JWT_SECRET = process.env.JWT_SECRET || 'mahanth';

export async function POST(req: Request) {
  try {
    // 1. Read subscription from request
    const body = await req.json();
    const subscription = body?.subscription;
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'No subscription provided' }, { status: 400 });
    }

    // 2. Read cookie (synchronously) and extract token if present
    const cookieStore =await cookies();            // <-- no `await`
    const token = cookieStore.get('sessionToken')?.value ?? null;

    // 3. Attempt to decode token if present
    let userId: string | null = null;
    if (token) {
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        userId = decoded?.sub ?? null;
      } catch (err) {
        // token invalid/expired — log and continue (we still store the subscription but without userId)
        console.warn('Invalid or expired session token when subscribing:', err);
        userId = null;
      }
    } else {
      // no token found: user is anonymous or not logged in
      userId = null;
    }

    // 4. Save/upsert subscription. Only include userId if non-null.
    await connectDB();

    const update: any = {
      endpoint: subscription.endpoint,
      subscription,
      updatedAt: new Date(),
    };
    if (userId) update.userId = userId;

    await Subscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 5. Return success
    return NextResponse.json({ ok: true, userId: userId ?? null }, { status: 201 });
  } catch (err) {
    console.error('subscribe error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
