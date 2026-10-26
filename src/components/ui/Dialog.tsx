'use client';
import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
export function Dialog({
  title,
  onClose,
  children,
  variant = 'center',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  // 'drawer' slides in from the left edge, next to the menu button that opens it.
  variant?: 'center' | 'drawer';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [closing, setClosing] = useState(false);
  // User-initiated closes leave along the path they arrived on before unmounting.
  const requestClose = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) onClose();
    else setClosing(true);
  };
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current!;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const siblings = [...document.body.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !el.contains(root),
    );
    const previousInert = siblings.map((el) => el.inert);
    siblings.forEach((el) => {
      el.inert = true;
    });
    const elements = () =>
      [
        ...root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length > 0);
    (elements()[0] ?? root).focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === 'Tab') {
        const items = elements();
        const first = items[0],
          last = items.at(-1);
        if (!first) {
          e.preventDefault();
          root.focus();
        } else if (
          e.shiftKey &&
          (document.activeElement === first || !root.contains(document.activeElement))
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || !root.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    // Focus cannot escape via programmatic focus while the modal is open.
    const focus = (e: FocusEvent) => {
      if (!root.contains(e.target as Node)) (elements()[0] ?? root).focus();
    };
    document.addEventListener('keydown', key);
    document.addEventListener('focusin', focus);
    return () => {
      siblings.forEach((el, i) => {
        el.inert = previousInert[i];
      });
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', key);
      document.removeEventListener('focusin', focus);
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className={`modal-overlay${variant === 'drawer' ? ' modal-overlay--drawer' : ''}`}
      data-state={closing ? 'closing' : 'open'}
      onClick={requestClose}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal-content${variant === 'drawer' ? ' modal-drawer' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="Close dialog"
            onClick={requestClose}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
