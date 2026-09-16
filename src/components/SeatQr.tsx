import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { PublicSeat } from '../net/protocol';

/** The URL a phone opens to take a seat. */
export function handUrl(code: string, seat: number, token: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/hand?t=${code}&s=${seat}&k=${token}`;
}

/**
 * One seat's QR code. Drawn on a canvas by the bundled encoder rather than
 * fetched from an image service, so a table works on a dead hotel network — and
 * so nobody's seat token travels to a third party.
 */
export function SeatQr({
  seat,
  url,
  hidden,
  onToggle,
}: {
  seat: PublicSeat;
  url: string;
  hidden: boolean;
  onToggle: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (hidden || !canvas.current) return;
    QRCode.toCanvas(canvas.current, url, { width: 168, margin: 1 }).catch(() => setFailed(true));
  }, [url, hidden]);

  const taken = seat.kind !== 'open';

  return (
    <div className={`seat-card${taken ? ' seat-taken' : ''}`}>
      <div className="seat-head">
        <span className="seat-number">Seat {seat.seat + 1}</span>
        <span className={`seat-state seat-state-${seat.kind}`}>
          {seat.kind === 'human' ? `✓ ${seat.name}` : seat.kind === 'cpu' ? 'CPU' : 'open'}
        </span>
      </div>

      {hidden ? (
        <button type="button" className="seat-reveal" onClick={onToggle}>
          <span aria-hidden="true">👁</span> Show code
        </button>
      ) : (
        <>
          <canvas ref={canvas} className="seat-qr" aria-label={`QR code for seat ${seat.seat + 1}`} />
          {failed && <p className="muted">Could not draw the code — use the link instead.</p>}
          {/* Typing beats scanning on a locked-down phone camera. */}
          <a className="seat-link" href={url} target="_blank" rel="noreferrer">
            open link
          </a>
          <button type="button" className="seat-hide" onClick={onToggle} title="Hide this code">
            ✕ Hide
          </button>
        </>
      )}
    </div>
  );
}
