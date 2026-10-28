import { useDropdown } from "../useDropdown";

export type Example = { question: string; hint: string; query: string };

// "Examples" opens a floating list of starting-point questions, so
// the presets stay available without taking space in the page. Picking one
// closes the list and returns focus to the trigger
export function ExamplesMenu({
  examples,
  disabled,
  onPick,
}: {
  examples: readonly Example[];
  disabled: boolean;
  onPick: (query: string) => void;
}) {
  const { details, open, close, detailsProps } = useDropdown();
  const { onToggle, ...restDetailsProps } = detailsProps;

  return (
    <details
      className="menu examples"
      {...restDetailsProps}
      onToggle={(e) => {
        onToggle(e);
        if (e.currentTarget.open)
          details.current?.querySelector<HTMLElement>("a")?.focus();
      }}
    >
      <summary
        aria-haspopup="true"
        aria-expanded={open}
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          // The presets need the dataset, so there is nothing to open yet
          if (disabled) event.preventDefault();
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12 2c.6 5.6 4.4 9.4 10 10-5.6.6-9.4 4.4-10 10-.6-5.6-4.4-9.4-10-10 5.6-.6 9.4-4.4 10-10Z" />
        </svg>
        Examples
        <span aria-hidden="true"> ▾</span>
      </summary>
      <nav className="menu-panel examples-panel" aria-label="Example questions">
        <p className="examples-title">Start with a question</p>
        <ul>
          {examples.map((e) => (
            <li key={e.query}>
              <a
                href={`?${e.query}`}
                onClick={(event) => {
                  // Same as following the link, without a full page reload
                  event.preventDefault();
                  onPick(e.query);
                  close(true);
                }}
              >
                <span>
                  <span className="examples-q">{e.question}</span>
                  <span className="examples-hint">{e.hint}</span>
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M7 17 17 7M7 7h10v10" />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
