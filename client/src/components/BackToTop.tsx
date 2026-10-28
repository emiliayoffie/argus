import { useSyncExternalStore } from "react";

// Scroll position is external state, so subscribe to it instead of mirroring it in useState
const subscribe = (notify: () => void) => {
  window.addEventListener("scroll", notify, { passive: true });
  window.addEventListener("resize", notify);
  return () => {
    window.removeEventListener("scroll", notify);
    window.removeEventListener("resize", notify);
  };
};
// Shown once the first screenful has scrolled away
const pastFirstScreen = () => window.scrollY > window.innerHeight;

// Floating shortcut to the top of a long page. Stays in the DOM and fades via
// visibility so it leaves the tab order while hidden
export function BackToTop() {
  const visible = useSyncExternalStore(subscribe, pastFirstScreen, () => false);
  return (
    <button
      type="button"
      className="back-to-top"
      data-visible={visible}
      aria-label="Back to top"
      onClick={() => {
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        // The button hides once the page is at the top, so hand focus to the wordmark
        document
          .querySelector<HTMLElement>(".masthead h1 a")
          ?.focus({ preventScroll: true });
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </button>
  );
}
