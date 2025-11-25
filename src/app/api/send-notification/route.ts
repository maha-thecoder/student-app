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

// small concurrency helper (no external deps)
async function mapWithConcurrency<T, R>(
  inputs: T[],
  mapper: (item: T) => Promise<R>,
  concurrency = 10
) {
  const results: R[] = [];
  let i = 0;
  const workers = new Array(Math.min(concurrency, inputs.length)).fill(null).map(async () => {
    while (i < inputs.length) {
      const idx = i++;
      // eslint-disable-next-line no-await-in-loop
      results[idx] = await mapper(inputs[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

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

    // web-push options to encourage immediate delivery
    const sendOptions = {
      TTL: 60, // seconds - try to deliver within 60s
      // Request high urgency (some push services honor this header)
      headers: {
        Urgency: 'high',
      },
    };

    await connectDB();

    const subs = await Subscription.find({}).exec();

    const results: Array<{ endpoint?: string; status: string; reason?: any; durationMs?: number }> = [];

    const startAll = Date.now();
    console.log(`[send-notification] starting sends for ${subs.length} subscriptions at`, new Date(startAll).toISOString());

    await mapWithConcurrency(
      subs,
      async (doc) => {
        const sub = (doc as any).subscription;
        const t0 = Date.now();
        try {
          // send with options (TTL + Urgency)
          await webpush.sendNotification(sub, payload, sendOptions);
          const dur = Date.now() - t0;
          results.push({ endpoint: doc.endpoint, status: 'sent', durationMs: dur });
        } catch (err: any) {
          const dur = Date.now() - t0;
          console.error('web-push error for', doc.endpoint, err);
          // clean up unsubscribed endpoints
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            try {
              await Subscription.deleteOne({ endpoint: doc.endpoint });
            } catch (delErr) {
              console.error('Failed to delete expired subscription', doc.endpoint, delErr);
            }
            results.push({ endpoint: doc.endpoint, status: 'removed', durationMs: dur });
          } else {
            results.push({ endpoint: doc.endpoint, status: 'error', reason: err?.body ?? err?.message, durationMs: dur });
          }
        }
      },
      10 // concurrency: change if needed; 10 is a reasonable default
    );

    const totalMs = Date.now() - startAll;
    console.log(`[send-notification] finished sends in ${totalMs}ms; summary:`, results.filter(r => r.status === 'sent').length, 'sent');

    return NextResponse.json({ sent: results.filter(r => r.status === 'sent').length, results }, { status: 200 });
  } catch (err) {
    console.error('Send notification error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
