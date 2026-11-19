import { useEffect, useId, useRef } from 'react';

/**
 * A centred dialog over a dark scrim, built on the native <dialog> with showModal(): the browser
 * traps focus, Esc closes it and the page behind is inert. The safe button carries data-autofocus,
 * so it gets the focus first ("Keep booking", "Keep access", "Keep my account").
 */
export function Dialog({ open, onClose, title, description, children, footer, busy = false }) {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('[data-autofocus]')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleCancel(event) {
    // Esc: close through the parent's state, and never while a request is running.
    event.preventDefault();
    if (!busy) {
      onClose();
    }
  }

  return (
    <dialog
      ref={ref}
      className="dlg"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
    >
      {open && (
        <>
          <div className="mb">
            <h2 id={titleId}>{title}</h2>
            {description && (
              <p id={descriptionId} className="muted sm" style={{ margin: '6px 0 12px' }}>
                {description}
              </p>
            )}
            {children}
          </div>
          {footer && <div className="mf">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
