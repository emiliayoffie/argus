import type { ReactNode } from "react";

// Editorial "01 / Title" heading. The number is decoration; the h2 names
// the section, and the optional line under it says what the section shows
export function SectionHeading({
  number,
  id,
  title,
  children,
}: {
  number: string;
  id: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <span className="section-number" aria-hidden="true">
        {number}
      </span>
      <h2 id={id}>{title}</h2>
      {children !== undefined && <p className="section-sub">{children}</p>}
    </div>
  );
}
