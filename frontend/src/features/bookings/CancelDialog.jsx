import { Dialog } from '../../components/Dialog';
import { Alert } from '../../components/StatePanels';
import { spaceShort } from '../../lib/bookingText';
import { formatDay, formatRange } from '../../lib/time';

/** "Cancel this booking?" with "Keep booking" focused first. A refusal shows inside, and the dialog stays open. */
export function CancelDialog({ booking, open, onClose, onConfirm, busy, error }) {
  if (!booking) {
    return null;
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      title="Cancel this booking?"
      description={`${spaceShort(booking.space)} on ${formatDay(booking.date)}, ${formatRange(booking.startTime, booking.endTime)} becomes free for others. This can't be undone.`}
      footer={
        <>
          <button type="button" className="btn btn-line" data-autofocus onClick={onClose} disabled={busy}>
            Keep booking
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Cancelling…' : 'Cancel booking'}
          </button>
        </>
      }
    >
      {error && <Alert message={error.message} />}
    </Dialog>
  );
}
