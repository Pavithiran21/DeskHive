import { useEffect } from 'react';

/**
 * Closes a popover or dropdown on Esc or on a click outside `ref`. On Esc the focus goes back to
 * the button that opened it (returnFocusRef).
 */
export function useDismiss(open, ref, onClose, returnFocusRef) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        onClose();
      }
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
        returnFocusRef?.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, ref, onClose, returnFocusRef]);
}
