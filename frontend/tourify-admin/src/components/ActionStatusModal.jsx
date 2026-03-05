import { useEffect } from 'react';
import { IoCloseOutline, IoWarningOutline } from 'react-icons/io5';

function ActionStatusModal({
  open,
  type,
  title,
  message,
  closeLabel = 'OK',
  closeable = true,
  onClose,
}) {
  useEffect(() => {
    if (!open || !closeable) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, closeable, onClose]);

  if (!open) return null;

  const renderVisual = () => {
    if (type === 'loading') {
      return (
        <div className="status-modal-spinner" aria-hidden="true">
          <span />
        </div>
      );
    }

    if (type === 'success') {
      return (
        <div className="status-modal-check" aria-hidden="true">
          <span />
          <span />
        </div>
      );
    }

    return (
      <div className="status-modal-error-icon" aria-hidden="true">
        <IoWarningOutline />
      </div>
    );
  };

  return (
    <div
      className="modal-backdrop status-modal-backdrop"
      role={type === 'loading' ? 'dialog' : 'alertdialog'}
      aria-modal="true"
      aria-live={type === 'loading' ? 'polite' : 'assertive'}
      onClick={closeable ? onClose : undefined}
    >
      <div className="modal-card status-modal-card" onClick={(event) => event.stopPropagation()}>
        {closeable ? (
          <button
            type="button"
            className="modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            <IoCloseOutline />
          </button>
        ) : null}

        <div className={`status-modal-visual status-modal-visual--${type}`}>
          {renderVisual()}
        </div>

        <div className="status-modal-text">
          <h3>{title}</h3>
          <p>{message}</p>
        </div>

        {closeable ? (
          <div className="modal-actions status-modal-actions">
            <button type="button" className="primary-cta" onClick={onClose}>
              {closeLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ActionStatusModal;
