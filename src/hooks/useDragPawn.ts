import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { MoveOption } from '../game/engine';

/** Below this, a pointer down is a tap that selects rather than a drag. */
const DRAG_THRESHOLD = 6;

/**
 * Lets a pawn be dragged from its card to the site it is walking to, which is
 * how the game is played on a shared tablet. A tap still selects, and a drag
 * that ends anywhere illegal snaps the pawn back, so the board stays the only
 * judge of a legal move.
 */
export function useDragPawn({
  moves,
  onMove,
  onSelect,
  enabled,
}: {
  moves: MoveOption[];
  onMove: (option: MoveOption) => void;
  onSelect: (hikerId: string) => void;
  enabled: boolean;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const from = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  /**
   * The site under the pointer. The pawn has to be made transparent to the
   * pointer first: it is drawn over the card it is being dragged to, but its
   * place in the document is still the card it came from, so hit-testing
   * through it would always answer "where it started".
   */
  const siteUnder = (pawn: HTMLElement, x: number, y: number): number | null => {
    const held = pawn.style.pointerEvents;
    pawn.style.pointerEvents = 'none';
    try {
      for (const element of document.elementsFromPoint(x, y)) {
        const site = (element as HTMLElement).closest?.('.site') as HTMLElement | null;
        if (site?.dataset.site) return Number(site.dataset.site);
      }
      return null;
    } finally {
      pawn.style.pointerEvents = held;
    }
  };

  const onPointerDown = useCallback(
    (hikerId: string) => (event: ReactPointerEvent<HTMLElement>) => {
      onSelect(hikerId);
      if (!enabled || event.button !== 0) return;
      from.current = { x: event.clientX, y: event.clientY, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [enabled, onSelect],
  );

  const onPointerMove = useCallback(
    (hikerId: string) => (event: ReactPointerEvent<HTMLElement>) => {
      const start = from.current;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

      start.moved = true;
      setDragging(hikerId);
      const pawn = event.currentTarget;
      pawn.style.transform = `translate(${dx}px, ${dy}px) scale(1.25)`;
      pawn.style.zIndex = '9';
      setOver(siteUnder(pawn, event.clientX, event.clientY));
    },
    [],
  );

  const onPointerUp = useCallback(
    (hikerId: string) => (event: ReactPointerEvent<HTMLElement>) => {
      const start = from.current;
      from.current = null;
      const pawn = event.currentTarget;
      const dropped = start?.moved ? siteUnder(pawn, event.clientX, event.clientY) : null;

      pawn.style.transform = '';
      pawn.style.zIndex = '';
      setDragging(null);
      setOver(null);
      if (dropped === null) return;

      const option = moves.find((m) => m.hikerId === hikerId && m.to === dropped);
      if (option) onMove(option);
    },
    [moves, onMove],
  );

  return {
    /** The hiker currently in the air, if any. */
    dragging,
    /** The site the pointer is over, for highlighting the drop target. */
    over,
    handlers: (hikerId: string) => ({
      onPointerDown: onPointerDown(hikerId),
      onPointerMove: onPointerMove(hikerId),
      onPointerUp: onPointerUp(hikerId),
      onPointerCancel: onPointerUp(hikerId),
    }),
  };
}
