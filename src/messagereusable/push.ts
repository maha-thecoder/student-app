// src/src/messagereusable/push.ts
import webpush from "web-push";
import Subscription from "@/models/Subscription";
import connectDB from "@/lib/mongodb";

/**
 * Result types:
 * {
 *   sent: number,
 *   results: [
 *     { endpoint, status: 'ok'|'failed'|'skipped', code?: number, error?: string }
 *   ]
 * }
 *
 * This function:
 *  - loads subscriptions for a userId,
 *  - dedupes by endpoint,
 *  - attempts webpush.sendNotification for each,
 *  - deletes expired endpoints (410/404) from DB,
 *  - returns detailed results.
 */

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const CONTACT = process.env.VAPID_CONTACT || "mailto:you@example.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(CONTACT, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch (e) {
    // Keep going; we will surface errors when sending
    // eslint-disable-next-line no-console
    console.warn("web-push vapid setup warning:", e);
  }
} else {
  // eslint-disable-next-line no-console
  console.warn("VAPID keys are not set (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY). Push will likely fail.");
}

export async function sendToUser(userId: string, payload: any, opts?: { targetDeviceId?: string }) {
  await connectDB(); // ensure DB connected (safe no-op if already connected)

  // find subscriptions by userId
  const query: any = { userId: userId.toString() };
  if (opts?.targetDeviceId) query.deviceId = opts.targetDeviceId;

  const subs = await Subscription.find(query).lean();

  if (!subs || subs.length === 0) {
    return { sent: 0, results: [], matched: [] };
  }

  // dedupe by endpoint
  const seen = new Set<string>();
  const uniqueSubs = subs.filter((s: any) => {
    const ep = s.endpoint || s.subscription?.endpoint || (s.subscription ? s.subscription.endpoint : null);
    if (!ep) return false;
    if (seen.has(ep)) return false;
    seen.add(ep);
    return true;
  });

  const results: Array<any> = [];
  let sent = 0;

  const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
  const sendOptions = { TTL: 60, headers: { Urgency: "high" } };

  await Promise.all(
    uniqueSubs.map(async (s: any) => {
      const subObj = s.subscription || (s.endpoint ? s : null);
      const endpoint = subObj?.endpoint || s.endpoint;
      if (!subObj || !endpoint) {
        results.push({ endpoint: endpoint || null, status: "skipped", reason: "invalid subscription object" });
        return;
      }

      try {
        // sendNotification will throw on network/auth errors
        await webpush.sendNotification(subObj, payloadStr, sendOptions);
        results.push({ endpoint, status: "ok" });
        sent += 1;
      } catch (err: any) {
        // web-push error: inspect err.statusCode if present
        const code = err?.statusCode ?? err?.status ?? null;
        const message = (err && err.stack) || String(err);

        results.push({ endpoint, status: "failed", code, error: message });

        // cleanup expired subscriptions (410 = Gone, 404 = Not Found)
        if (code === 410 || code === 404) {
          try {
            await Subscription.deleteOne({ $or: [{ endpoint }, { "subscription.endpoint": endpoint }] });
            // eslint-disable-next-line no-console
            console.log("[sendToUser] removed expired subscription", endpoint);
          } catch (delErr) {
            // eslint-disable-next-line no-console
            console.error("[sendToUser] failed to delete expired subscription", endpoint, delErr);
          }
        }
      }
    })
  );

  // return a structured result
  return { sent, results, matched: uniqueSubs.map((s: any) => ({ endpoint: s.subscription?.endpoint || s.endpoint })) };
}

export default sendToUser;
