// src/app/api/send-notification/route.ts
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Subscription from '@/models/Subscription';
import webpush from 'web-push';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:you@example.com', VAPID_PUBLIC, VAPID_PRIVATE);
} else {
  console.warn('VAPID keys missing in env - notifications will fail.');
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  [k: string]: any;
};

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get('x-api-key') ?? '';
    if (process.env.ADMIN_API_KEY && apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const title = body.title ?? 'Hello';
    const message = body.body ?? 'This is a test notification';
    const url = body.url ?? '/';
    const payload = JSON.stringify({ title, body: message, url });

    await connectDB();

    const subs = await Subscription.find({}).exec();

    const results: Array<{ endpoint?: string; status: string; reason?: any }> = [];

    for (const doc of subs) {
      const sub = (doc as any).subscription;
      try {
        await webpush.sendNotification(sub, payload);
        results.push({ endpoint: doc.endpoint, status: 'sent' });
      } catch (err: any) {
        console.error('web-push error for', doc.endpoint, err);
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await Subscription.deleteOne({ endpoint: doc.endpoint });
          results.push({ endpoint: doc.endpoint, status: 'removed' });
        } else {
          results.push({ endpoint: doc.endpoint, status: 'error', reason: err?.body ?? err?.message });
        }
      }
    }

    return NextResponse.json({ sent: results.filter(r => r.status === 'sent').length, results }, { status: 200 });
  } catch (err) {
    console.error('Send notification error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
