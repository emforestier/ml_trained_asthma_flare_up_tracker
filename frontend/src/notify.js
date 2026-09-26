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

// Shows a system notification if the user allowed them. The tag stops the same alert
// from appearing twice.
export function sendSystemNotification(alert) {
  if (notificationPermission() !== 'granted') return false;
  try {
    const notification = new Notification(alert.title, { body: alert.body, tag: alert.id });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}
