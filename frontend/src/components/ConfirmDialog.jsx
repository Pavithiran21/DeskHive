import { Dialog } from './Dialog';
import { Alert } from './StatePanels';

/**
 * "Delete B7?" style confirmation: the safe button is focused first and on the left; the destructive
 * one is red. A refusal from the server (for example 409 HAS_DEPENDENTS) shows inside and keeps it open.
 */
export function ConfirmDialog({ open, title, description, keepLabel, confirmLabel, busyLabel, onClose, onConfirm, busy, error, children }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      title={title}
      description={description}
      footer={
        <>
          <button type="button" className="btn btn-line" data-autofocus onClick={onClose} disabled={busy}>
            {keepLabel}
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </>
      }
    >
      {children}
      {error && <Alert message={error.message} />}
    </Dialog>
  );
}
