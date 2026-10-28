import type { ReactNode } from "react";

// Editorial "01 / Title" heading. The number is decoration; the h2 names
// the section, and the optional line under it says what the section shows
export function SectionHeading({
  number,
  id,
  title,
  children,
  actions,
}: {
  number: string;
  id: string;
  title: string;
  children?: ReactNode;
  // Controls for the section, held at the right end of the heading rule
  actions?: ReactNode;
}) {
  return (
    <div
      className={
        actions !== undefined
          ? "section-heading has-actions"
          : "section-heading"
      }
    >
      <span className="section-number" aria-hidden="true">
        {number}
      </span>
      <h2 id={id}>{title}</h2>
      {actions !== undefined && (
        <div className="section-actions">{actions}</div>
      )}
      {children !== undefined && <p className="section-sub">{children}</p>}
    </div>
  );
}
