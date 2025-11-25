// src/lib/push.ts
import webpush from 'web-push';
import connectDB from '@/lib/mongodb';
import Subscription from '@/models/Subscription';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:you@example.com', VAPID_PUBLIC, VAPID_PRIVATE);
} else {
  console.warn('VAPID keys missing — push will fail without them');
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  [k: string]: any;
};

type Result = { endpoint?: string; status: 'sent' | 'removed' | 'error'; reason?: any };

/**
 * Send payload to subscriptions of a single userId.
 */
export async function sendToUser(userId: string, payload: PushPayload): Promise<Result[]> {
  await connectDB();
  const subs = await Subscription.find({ userId }).lean().exec();
  const results: Result[] = [];

  for (const doc of subs) {
    const subscription = (doc as any).subscription;
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      results.push({ endpoint: doc.endpoint, status: 'sent' });
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await Subscription.deleteOne({ endpoint: doc.endpoint });
        results.push({ endpoint: doc.endpoint, status: 'removed' });
      } else {
        results.push({ endpoint: doc.endpoint, status: 'error', reason: err?.body ?? err?.message });
      }
    }
  }

  return results;
}

/**
 * Send payload to all subscriptions in DB.
 */
export async function sendToAll(payload: PushPayload): Promise<Result[]> {
  await connectDB();
  const subs = await Subscription.find({}).lean().exec();
  const results: Result[] = [];

  for (const doc of subs) {
    const subscription = (doc as any).subscription;
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      results.push({ endpoint: doc.endpoint, status: 'sent' });
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await Subscription.deleteOne({ endpoint: doc.endpoint });
        results.push({ endpoint: doc.endpoint, status: 'removed' });
      } else {
        results.push({ endpoint: doc.endpoint, status: 'error', reason: err?.body ?? err?.message });
      }
    }
  }

  return results;
}
