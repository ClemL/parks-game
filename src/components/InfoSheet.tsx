import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Touch devices have no hover, so every `title` on the board is invisible on a
 * phone. This carries the same explanations in a sheet that any element can
 * open by being tapped.
 */

export interface InfoEntry {
  title: string;
  icon?: string;
  lines: (string | { label: string; value: string })[];
}

const InfoContext = createContext<{
  show: (entry: InfoEntry) => void;
  entry: InfoEntry | null;
  close: () => void;
}>({ show: () => {}, entry: null, close: () => {} });

export function InfoProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<InfoEntry | null>(null);
  const show = useCallback((next: InfoEntry) => setEntry(next), []);
  const close = useCallback(() => setEntry(null), []);
  const value = useMemo(() => ({ show, entry, close }), [show, entry, close]);
  return <InfoContext.Provider value={value}>{children}</InfoContext.Provider>;
}

export function useInfo() {
  return useContext(InfoContext);
}

/** The sheet itself: bottom-anchored on a phone, a small card on a desktop. */
export function InfoSheet() {
  const { entry, close } = useInfo();
  if (!entry) return null;
  return (
    <div className="info-scrim" onClick={close} role="presentation">
      <div
        className="info-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={entry.title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="info-head">
          {entry.icon && (
            <span className="info-icon" aria-hidden="true">
              {entry.icon}
            </span>
          )}
          <h3>{entry.title}</h3>
          <button type="button" className="notice-close" onClick={close} aria-label="Close">
            ✕
          </button>
        </header>
        <dl className="info-body">
          {entry.lines.map((line, i) =>
            typeof line === 'string' ? (
              <p key={i}>{line}</p>
            ) : (
              <div key={i} className="info-row">
                <dt>{line.label}</dt>
                <dd>{line.value}</dd>
              </div>
            ),
          )}
        </dl>
      </div>
    </div>
  );
}
