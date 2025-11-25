export function getDeviceId(): string {
  if (typeof window === "undefined") return "no-window";

  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("deviceId", id);
  }
  return id;
}
