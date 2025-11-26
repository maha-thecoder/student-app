// src/messagereusable/device.ts
export function getDeviceId(): string {
  if (typeof window === "undefined") return ""; // server-side: return empty string
  let id = localStorage.getItem("deviceId");
  if (id && typeof id === "string" && id.trim() !== "") return id;
  // generate a UUID-like id (fallback if crypto.randomUUID not available)
  const newId =
    (typeof crypto !== "undefined" && (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  localStorage.setItem("deviceId", newId);
  return newId;
}
