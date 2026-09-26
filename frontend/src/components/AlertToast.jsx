// A trigger alert: slides in over the map as a banner, or sits inline as a card.
// Offers to turn on system notifications while the browser hasn't been asked yet.
import { useState } from 'react';
import { notificationPermission, requestNotifications, sendSystemNotification } from '../notify';
import Enemy from './Enemy';

export default function AlertToast({ alert, remaining = 0, inline = false, onDismiss, onOpen }) {
  const [permission, setPermission] = useState(notificationPermission);

  async function enableNotifications() {
    const result = await requestNotifications();
    setPermission(result);
    if (result === 'granted') sendSystemNotification(alert);
  }

  return (
    <aside className={`alert-toast${inline ? ' inline' : ''}`} role="status" aria-live="polite">
      <div className="alert-enemy" aria-hidden="true">
        <Enemy type={alert.enemy} level={alert.level} size={54} />
      </div>
      <div className="alert-body">
        <p className="alert-title">{alert.title}</p>
        <p className="alert-text">{inline ? alert.body : alert.summary}</p>
        <div className="alert-actions">
          {onOpen && (
            <button className="text-button small" onClick={onOpen}>
              See demo score
            </button>
          )}
          {permission === 'default' && (
            <button className="text-button small" onClick={enableNotifications}>
              Turn on notifications
            </button>
          )}
          {remaining > 0 && <span className="alert-more">+{remaining} more</span>}
        </div>
      </div>
      {onDismiss && (
        <button className="alert-close" onClick={onDismiss} aria-label="Dismiss alert">
          ×
        </button>
      )}
    </aside>
  );
}
