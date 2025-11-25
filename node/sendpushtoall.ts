// scripts/sendPushToAll.ts
import webpush from "web-push";
import connectDB from '@/lib/mongodb';
import Subscription from "@/models/Subscription";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!;

if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.error("❌ Missing VAPID keys!");
  process.exit(1);
}

webpush.setVapidDetails(
  "mailto:you@example.com",
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

(async () => {
  await connectDB();

  const subs = await Subscription.find({});
  if (subs.length === 0) {
    console.log("⚠️ No subscriptions found in DB");
    process.exit(0);
  }

  console.log(`📨 Sending push to ${subs.length} subscribers...`);

  const payload = JSON.stringify({
    title: "Hello!",
    body: "This is a test notification from script.",
    url: "/",
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub.subscription, payload);
      console.log(`✔ Sent to: ${sub.endpoint}`);
    } catch (err: any) {
      console.error(`❌ Failed for ${sub.endpoint}`, err.body || err.message);
      // auto-clean dead subscriptions
      if (err.statusCode === 410 || err.statusCode === 404) {
        await Subscription.deleteOne({ endpoint: sub.endpoint });
        console.log(`🗑 Removed expired subscription: ${sub.endpoint}`);
      }
    }
  }

  console.log("🎉 Done sending!");
  process.exit(0);
})();
