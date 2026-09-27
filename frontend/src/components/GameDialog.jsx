// Game-style confirm dialog: centered white card, gradient pill for the main choice,
// plain text button for the other. Tapping outside calls onDismiss (or onCancel).
// `media` shows above the title (a picture); `children` show below the message.
export default function GameDialog({ title, message, media, children, confirmLabel = 'Yes', cancelLabel, onConfirm, onCancel, onDismiss, busy = false }) {
  const dismiss = onDismiss || onCancel;
  return (
    <div className="dialog-layer" onClick={dismiss && !busy ? dismiss : undefined}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={(event) => event.stopPropagation()}>
        {media}
        <h2 id="dialog-title">{title}</h2>
        {message && <p>{message}</p>}
        {children}
        <button className="pill-button" onClick={onConfirm} disabled={busy} autoFocus>
          {confirmLabel}
        </button>
        {cancelLabel && (
          <button className="text-button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
        )}
      </div>
    </div>
  );
}
