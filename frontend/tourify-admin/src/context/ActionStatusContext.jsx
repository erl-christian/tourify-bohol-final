import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ActionStatusModal from '../components/ActionStatusModal';

const ActionStatusContext = createContext(null);

const CLOSED = {
  open: false,
  type: 'loading',
  title: '',
  message: '',
  closeable: true,
  closeLabel: 'OK',
  autoCloseMs: 0,
};

export function ActionStatusProvider({ children }) {
  const [modal, setModal] = useState(CLOSED);

  const close = useCallback(() => setModal(CLOSED), []);

  useEffect(() => {
    if (!modal.open || !modal.autoCloseMs) return undefined;
    const timer = window.setTimeout(() => setModal(CLOSED), modal.autoCloseMs);
    return () => window.clearTimeout(timer);
  }, [modal]);

  const showLoading = useCallback((message = 'Please wait...', title = 'Processing') => {
    setModal({
      open: true,
      type: 'loading',
      title,
      message,
      closeable: false,
      closeLabel: 'OK',
      autoCloseMs: 0,
    });
  }, []);

  const showSuccess = useCallback((message, options = {}) => {
    setModal({
      open: true,
      type: 'success',
      title: options.title ?? 'Success',
      message,
      closeable: options.closeable ?? true,
      closeLabel: options.closeLabel ?? 'OK',
      autoCloseMs: options.autoCloseMs ?? 1500,
    });
  }, []);

  const showError = useCallback((message, options = {}) => {
    setModal({
      open: true,
      type: 'error',
      title: options.title ?? 'Something went wrong',
      message,
      closeable: true,
      closeLabel: options.closeLabel ?? 'OK',
      autoCloseMs: 0,
    });
  }, []);

  const value = useMemo(
    () => ({ showLoading, showSuccess, showError, close }),
    [showLoading, showSuccess, showError, close],
  );

  return (
    <ActionStatusContext.Provider value={value}>
      {children}
      <ActionStatusModal
        open={modal.open}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        closeable={modal.closeable}
        closeLabel={modal.closeLabel}
        onClose={close}
      />
    </ActionStatusContext.Provider>
  );
}

export function useActionStatus() {
  const context = useContext(ActionStatusContext);
  if (!context) {
    throw new Error('useActionStatus must be used within ActionStatusProvider.');
  }
  return context;
}
