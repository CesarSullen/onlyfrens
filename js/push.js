import { getPushKey, savePushSubscription, deletePushSubscription } from "./api.js";

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function canAskForPush() {
  return isPushSupported() && Notification.permission === "default";
}

// On iPhone, push only works once the app is added to the home screen.
export function needsInstallForPush() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone && !isPushSupported();
}

function keyToBytes(base64Url) {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function registerDevice() {
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const { key } = await getPushKey();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyToBytes(key),
    });
  }

  await savePushSubscription(subscription.toJSON());
}

// Must be called from a tap: browsers only show the permission prompt after one.
export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  await registerDevice();
  return true;
}

// Keeps the server's copy of this device current, and moves it to whoever is signed in now.
export async function syncPush() {
  if (!isPushSupported() || Notification.permission !== "granted") return;

  try {
    await registerDevice();
  } catch {
    // Push stays as it was until the next start.
  }
}

// Called on sign out, while the session still works.
export async function disablePush() {
  if (!isPushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await deletePushSubscription(subscription.endpoint);
    await subscription.unsubscribe();
  } catch {
    // Signing out must not fail because of this.
  }
}
