// src/app/components/UsePush.tsx
'use client';

import { useEffect } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string;

/**
 * Convert base64 url-safe string to Uint8Array required by PushManager.subscribe
 */
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function UsePush(): null {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers are not supported in this browser.');
      return;
    }
    if (!('PushManager' in window)) {
      console.warn('Push API not supported in this browser.');
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      console.warn('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set.');
      return;
    }

    async function registerAndSubscribe() {
      try {
        // register service worker at /sw.js (must be in public/)
        const reg = await navigator.serviceWorker.register('/sw.js');

        // existing subscription?
        let subscription = await reg.pushManager.getSubscription();

        // ask permission (if already granted, this resolves without prompting again)
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Notification permission not granted');
          return;
        }

        // subscribe if not already
        if (!subscription) {
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }

        // send subscription to server to store
        await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription }),
        });

        console.log('Push subscription created and sent to server.');
      } catch (err) {
        console.error('Push registration/subscription failed:', err);
      }
    }

    registerAndSubscribe();
  }, []);

  return null;
}
