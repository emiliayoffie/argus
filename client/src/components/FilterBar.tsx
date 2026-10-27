import { useId, type KeyboardEvent } from "react";
import { isCalendarDate, monthsBefore } from "../domain/format";
import { isEmptyRange } from "../domain/filter";
import {
  label,
  STATES,
  STATUSES,
  TECH_GROUPS,
  type DateRange,
  type Dimension,
  type Filters,
} from "../domain/types";
import { SEARCH_MAX_LENGTH } from "../domain/url";
import { useDropdown } from "../useDropdown";

type Props = {
  filters: Filters;
  onChange: (filters: Filters) => void;
  // One reset for the whole view (filters, breakdown, highlights, sort, map)
  onReset: () => void;
  canReset: boolean;
  disabled: boolean;
  // Dataset date: bounds the pickers and anchors "Last 12 months"
  asOf: string;
};

// A native <details> dropdown holding a checkbox list. OR within the menu;
// the toolbar ANDs the menus together. Keyboard: Enter/Space opens and
// focuses the first option, Up/Down/Home/End move, Space or Enter toggles,
// Escape closes and returns focus to the button, Tabbing out or clicking
// outside closes
function FilterMenu<T extends string>({
  title,
  dim,
  options,
  selected,
  onChange,
  disabled,
}: {
  title: string;
  dim: Dimension;
  options: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  disabled: boolean;
}) {
  const { details, open, detailsProps } = useDropdown();

  const focusables = () =>
    Array.from(
      details.current?.querySelectorAll<HTMLElement>(
        "input:not(:disabled), button:not(:disabled)",
      ) ?? [],
    );

  const onKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (!details.current?.open) return;
    if (
      event.key === "Enter" &&
      event.target instanceof HTMLInputElement &&
      event.target.type === "checkbox"
    ) {
      event.preventDefault();
      event.target.click();
      return;
    }
    const items = focusables();
    const active = document.activeElement;
    const index = active instanceof HTMLElement ? items.indexOf(active) : -1;
    const moveTo = (i: number) => {
      event.preventDefault();
      items[(i + items.length) % items.length]?.focus();
    };
    if (event.key === "ArrowDown") moveTo(index + 1);
    else if (event.key === "ArrowUp") moveTo(index - 1);
    else if (event.key === "Home") moveTo(0);
    else if (event.key === "End") moveTo(items.length - 1);
  };

  const toggle = (value: T, checked: boolean) =>
    onChange(
      checked ? [...selected, value] : selected.filter((v) => v !== value),
    );

  const { onToggle, ...restDetailsProps } = detailsProps;

  return (
    <details
      {...restDetailsProps}
      className={selected.length ? "menu active" : "menu"}
      onToggle={(e) => {
        onToggle(e);
        if (e.currentTarget.open) focusables()[0]?.focus();
      }}
      onKeyDown={(e) => {
        detailsProps.onKeyDown(e);
        if (!e.defaultPrevented) onKeyDown(e);
      }}
    >
      <summary
        aria-haspopup="true"
        aria-expanded={open}
        aria-disabled={disabled || undefined}
      >
        {title}
        {selected.length > 0 && (
          <span className="menu-count">{selected.length}</span>
        )}
        <span aria-hidden="true"> ▾</span>
      </summary>
      <fieldset className="menu-panel" disabled={disabled}>
        <legend className="visually-hidden">{title}</legend>
        {options.map((value) => (
          <label key={value}>
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={(e) => toggle(value, e.target.checked)}
            />{" "}
            {label(dim, value)}
          </label>
        ))}
        <button
          type="button"
          className="menu-clear"
          disabled={selected.length === 0}
          onClick={() => onChange([])}
        >
          Clear
        </button>
        <p className="muted menu-hint">
          Menus combine: a facility is listed when one of its units matches
          every menu.
        </p>
      </fieldset>
    </details>
  );
}

// "Came online" as an inclusive date range. Native date inputs keep their
// own keyboard behaviour (arrows step days), which is why the shared hook's
// list-navigation keys aren't used here — only Escape closes
function DateMenu({
  range,
  asOf,
  onChange,
  disabled,
}: {
  range: DateRange;
  asOf: string;
  onChange: (range: DateRange) => void;
  disabled: boolean;
}) {
  const { open, detailsProps } = useDropdown();
  const fromId = useId();
  const toId = useId();
  const asOfDay = isCalendarDate(asOf.slice(0, 10)) ? asOf.slice(0, 10) : "";
  const active = !isEmptyRange(range);
  const invalid =
    range.from !== null && range.to !== null && range.from > range.to;

  return (
    <details {...detailsProps} className={active ? "menu active" : "menu"}>
      <summary
        aria-haspopup="true"
        aria-expanded={open}
        aria-disabled={disabled || undefined}
      >
        Dates
        {active && <span className="menu-count">1</span>}
        <span aria-hidden="true"> ▾</span>
      </summary>
      <fieldset className="menu-panel" disabled={disabled}>
        <legend>Came online</legend>
        <div className="menu-date">
          <label htmlFor={fromId}>From</label>
          <input
            id={fromId}
            type="date"
            max={asOfDay}
            value={range.from ?? ""}
            onChange={(e) =>
              onChange({
                ...range,
                from: e.target.value === "" ? null : e.target.value,
              })
            }
          />
        </div>
        <div className="menu-date">
          <label htmlFor={toId}>To</label>
          <input
            id={toId}
            type="date"
            max={asOfDay}
            value={range.to ?? ""}
            onChange={(e) =>
              onChange({
                ...range,
                to: e.target.value === "" ? null : e.target.value,
              })
            }
          />
        </div>
        {invalid && (
          <p className="menu-error" role="alert">
            From is after To, so nothing matches
          </p>
        )}
        <div className="menu-actions">
          <button
            type="button"
            className="menu-clear"
            disabled={asOfDay === ""}
            onClick={() =>
              onChange({ from: monthsBefore(asOfDay, 12), to: null })
            }
          >
            Last 12 months
          </button>
          <button
            type="button"
            className="menu-clear"
            disabled={!active}
            onClick={() => onChange({ from: null, to: null })}
          >
            Clear
          </button>
        </div>
        <p className="muted menu-hint">
          Operating and commissioning units whose commencement date is in the
          range. Month- and year-only dates count from the start of their
          period.
        </p>
      </fieldset>
    </details>
  );
}

// Base filters as a slim toolbar: three menus, search, and the one Reset for
// the whole view
export function FilterBar({
  filters,
  onChange,
  onReset,
  canReset,
  disabled,
  asOf,
}: Props) {
  const searchId = useId();
  return (
    <section className="toolbar" aria-labelledby="filters-heading">
      <h2 id="filters-heading" className="visually-hidden">
        Filters
      </h2>
      <FilterMenu
        title="State / region"
        dim="state"
        options={STATES}
        selected={filters.states}
        onChange={(states) => onChange({ ...filters, states })}
        disabled={disabled}
      />
      <FilterMenu
        title="Technology"
        dim="techGroup"
        options={TECH_GROUPS}
        selected={filters.techGroups}
        onChange={(techGroups) => onChange({ ...filters, techGroups })}
        disabled={disabled}
      />
      <FilterMenu
        title="Status"
        dim="status"
        options={STATUSES}
        selected={filters.statuses}
        onChange={(statuses) => onChange({ ...filters, statuses })}
        disabled={disabled}
      />
      <DateMenu
        range={filters.commenced}
        asOf={asOf}
        onChange={(commenced) => onChange({ ...filters, commenced })}
        disabled={disabled}
      />
      <label htmlFor={searchId} className="visually-hidden">
        Search facilities
      </label>
      <input
        id={searchId}
        className="toolbar-search"
        type="search"
        placeholder="Search facility name or code"
        value={filters.search}
        maxLength={SEARCH_MAX_LENGTH}
        disabled={disabled}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />
      <button
        type="button"
        className="icon-button"
        onClick={(e) => {
          e.currentTarget.classList.add("spinning");
          onReset();
        }}
        onAnimationEnd={(e) => e.currentTarget.classList.remove("spinning")}
        disabled={disabled || !canReset}
        aria-label="Reset filters and view"
        title="Reset"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M13.6 8a5.6 5.6 0 1 1-1.7-4" />
          <path d="M14 1.8v2.6h-2.6" />
        </svg>
      </button>
    </section>
  );
}
