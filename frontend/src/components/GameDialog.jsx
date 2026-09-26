// Game-style confirm dialog: centered white card, gradient pill for the main choice,
// plain text button for the other.
export default function GameDialog({ title, message, confirmLabel = 'Yes', cancelLabel, onConfirm, onCancel, busy = false }) {
  return (
    <div className="dialog-layer" onClick={onCancel && !busy ? onCancel : undefined}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="dialog-title">{title}</h2>
        {message && <p>{message}</p>}
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
