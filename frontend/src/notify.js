// System notifications (phone or desktop) through the browser's Notification API.
// They only work while the app is open or in a background tab; alerts with the app fully closed
// would need the backend to send push messages.

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

// Must be called from a tap or click; browsers ignore permission requests otherwise.
export async function requestNotifications() {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

const NOTIFICATION_ICON = 'icons/icon-192.png';

// Desktop browsers accept `new Notification(...)` directly.
function showDirectly(alert) {
  try {
    const notification = new Notification(alert.title, { body: alert.body, tag: alert.id, icon: NOTIFICATION_ICON });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

// Shows a system notification if the user allowed them. The tag stops the same alert from
// appearing twice. Installed apps on Android only allow notifications through the service
// worker, so that is tried first; desktop browsers fall back to showing it directly.
export function sendSystemNotification(alert) {
  if (notificationPermission() !== 'granted') return false;
  const worker = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
  if (worker?.getRegistration) {
    worker
      .getRegistration()
      .then((registration) =>
        registration
          ? registration.showNotification(alert.title, { body: alert.body, tag: alert.id, icon: NOTIFICATION_ICON, badge: NOTIFICATION_ICON })
          : showDirectly(alert),
      )
      .catch(() => showDirectly(alert));
    return true;
  }
  return showDirectly(alert);
}
