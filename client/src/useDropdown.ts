import { useEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, SyntheticEvent } from "react";

// The plumbing every <details> dropdown shares: open state, close on
// outside pointerdown or on focus leaving, Escape closes and returns focus
// to the summary. Per-menu key handling stays in the component so date
// inputs can keep their native arrow-key behaviour
export function useDropdown() {
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  const close = (returnFocus: boolean) => {
    const el = details.current;
    if (!el?.open) return;
    el.open = false;
    if (returnFocus) el.querySelector("summary")?.focus();
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const el = details.current;
      if (
        el?.open &&
        event.target instanceof Node &&
        !el.contains(event.target)
      )
        close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key === "Escape" && details.current?.open) {
      event.preventDefault();
      close(true);
    }
  };

  const detailsProps = {
    ref: details,
    onToggle: (e: SyntheticEvent<HTMLDetailsElement>) =>
      setOpen(e.currentTarget.open),
    onKeyDown,
    onBlur: (e: FocusEvent<HTMLDetailsElement>) => {
      // Focus moved to something outside the menu (Tab out): close without
      // stealing focus back. A blur with no target is ignored: iOS Safari
      // doesn't focus a tapped control, so closing here would swallow the tap.
      // Taps outside are handled by the document pointerdown listener
      if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget))
        close(false);
    },
  };

  return { details, open, close, detailsProps };
}
