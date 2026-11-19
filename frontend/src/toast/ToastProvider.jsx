import { IconAlertTriangle, IconCheck, IconX } from '@tabler/icons-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ToastContext } from './ToastContext';

const SUCCESS_MS = 5000;

/**
 * DeskHive's toast: a light rose card with a solid rose round icon, top centre (an error is pale red).
 * The live region is always in the page, so a screen reader hears each new toast.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, Icon, action, error = false }) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current.slice(-2), { id, message, Icon, action, error }]);
      if (!error) {
        window.setTimeout(() => dismiss(id), SUCCESS_MS);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts">
        {toasts.map((toast) => {
          const Icon = toast.Icon ?? (toast.error ? IconAlertTriangle : IconCheck);
          return (
            <div key={toast.id} className={toast.error ? 'toast err' : 'toast'} role={toast.error ? 'alert' : 'status'}>
              <span className="ic" aria-hidden="true">
                <Icon />
              </span>
              <span>
                {toast.message}
                {toast.action && (
                  <Link to={toast.action.to} onClick={() => dismiss(toast.id)}>
                    {toast.action.label}
                  </Link>
                )}
              </span>
              {toast.error && (
                <button type="button" className="x" aria-label="Close" onClick={() => dismiss(toast.id)}>
                  <IconX />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
