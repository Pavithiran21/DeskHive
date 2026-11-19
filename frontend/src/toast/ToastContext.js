import { createContext, useContext } from 'react';

/**
 * { showToast({ message, Icon?, action?: { label, to }, error? }) }
 * Success toasts close after 5 seconds; error toasts stay until closed.
 */
export const ToastContext = createContext(null);

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return value;
}
