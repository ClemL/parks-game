import type { ReactNode } from 'react';

/** A board section that folds away, with its heading as the handle. */
export function Panel({
  title,
  meta,
  open,
  onToggle,
  children,
  summary,
}: {
  title: string;
  /** Right-hand status text or element, shown whether open or folded. */
  meta?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** One-line stand-in shown while folded. */
  summary?: ReactNode;
}) {
  return (
    <section className={`panel${open ? '' : ' panel-folded'}`}>
      <div className="panel-head">
        <button type="button" className="panel-toggle" aria-expanded={open} onClick={onToggle}>
          <span className="chev" aria-hidden="true">
            ▾
          </span>
          <h2>{title}</h2>
        </button>
        {meta && <span className="panel-meta">{meta}</span>}
      </div>
      {open ? children : summary ? <div className="panel-summary">{summary}</div> : null}
    </section>
  );
}

/** A dismissible notice: an info strip with a close button. */
export function Notice({
  className,
  onClose,
  closeLabel = 'Close',
  children,
  role,
}: {
  className: string;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
  role?: 'status';
}) {
  return (
    <div className={`notice ${className}`} role={role}>
      <div className="notice-text">{children}</div>
      <button type="button" className="notice-close" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
        ✕
      </button>
    </div>
  );
}
