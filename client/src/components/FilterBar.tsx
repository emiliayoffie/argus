import { useId, useState, type KeyboardEvent } from "react";
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
import { ExamplesMenu, type Example } from "./ExamplesMenu";
import { moveFocus, useDropdown } from "../useDropdown";

type Props = {
  filters: Filters;
  onChange: (filters: Filters) => void;
  // One reset for the whole view (filters, breakdown, highlights, sort, map)
  onReset: () => void;
  canReset: boolean;
  disabled: boolean;
  // Dataset date: bounds the pickers and anchors "Last 12 months"
  asOf: string;
  // Starting-point questions, offered in a menu beside the search box
  examples: readonly Example[];
  onPickExample: (query: string) => void;
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
    moveFocus(event, focusables());
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

// One labelled From/To pair inside its own fieldset. min/max are optional so
// "expected online" can leave the upper end unbounded
function RangeFields({
  range,
  min,
  max,
  onChange,
}: {
  range: DateRange;
  min?: string;
  max?: string;
  onChange: (range: DateRange) => void;
}) {
  const fromId = useId();
  const toId = useId();
  const invalid =
    range.from !== null && range.to !== null && range.from > range.to;
  return (
    <>
      <div className="dates-row">
        <div className="menu-date">
          <label htmlFor={fromId}>From</label>
          <input
            id={fromId}
            type="date"
            min={min}
            max={max}
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
            min={min}
            max={max}
            value={range.to ?? ""}
            onChange={(e) =>
              onChange({
                ...range,
                to: e.target.value === "" ? null : e.target.value,
              })
            }
          />
        </div>
      </div>
      {invalid && (
        <p className="menu-error" role="alert">
          From is after To, so nothing matches
        </p>
      )}
    </>
  );
}

// Inclusive date ranges, one per lifecycle status; a unit in any filled
// range is shown. Native date inputs keep their own keyboard behaviour
// (arrows step days), which is why the shared hook's list-navigation keys
// aren't used here — only Escape closes
function DateMenu({
  filters,
  asOf,
  onChange,
  disabled,
}: {
  filters: Filters;
  asOf: string;
  onChange: (filters: Filters) => void;
  disabled: boolean;
}) {
  const { open, detailsProps } = useDropdown();
  const [about, setAbout] = useState(false);
  const titleId = useId();
  const aboutId = useId();
  const asOfDay = isCalendarDate(asOf.slice(0, 10)) ? asOf.slice(0, 10) : "";
  const activeCount = [
    filters.commenced,
    filters.expected,
    filters.closed,
  ].filter((r) => !isEmptyRange(r)).length;
  const active = activeCount > 0;

  return (
    <details {...detailsProps} className={active ? "menu active" : "menu"}>
      <summary
        aria-haspopup="true"
        aria-expanded={open}
        aria-disabled={disabled || undefined}
      >
        Dates
        {active && <span className="menu-count">{activeCount}</span>}
        <span aria-hidden="true"> ▾</span>
      </summary>
      <div
        className="menu-panel dates-panel"
        role="group"
        aria-labelledby={titleId}
      >
        <div className="dates-head">
          <span id={titleId} className="dates-title">
            Filter by dates
          </span>
          <button
            type="button"
            className="dates-about"
            aria-expanded={about}
            aria-controls={aboutId}
            onClick={() => setAbout((on) => !on)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5" />
              <path d="M12 7.5h.01" />
            </svg>{" "}
            About dates
          </button>
        </div>
        <div id={aboutId} className="dates-note" hidden={!about}>
          <p>
            Came online uses the published commencement date, never first-seen
            telemetry.
          </p>
          <p>
            Month- and year-only dates count from the first day of their period.
          </p>
        </div>
        <fieldset className="dates-group" disabled={disabled}>
          <legend>
            <span>Came online</span>
            <span className="dates-chip">Operating / commissioning</span>
          </legend>
          <RangeFields
            range={filters.commenced}
            max={asOfDay}
            onChange={(commenced) => onChange({ ...filters, commenced })}
          />
          <button
            type="button"
            className="menu-clear dates-preset"
            disabled={asOfDay === "" || disabled}
            onClick={() =>
              onChange({
                ...filters,
                commenced: { from: monthsBefore(asOfDay, 12), to: null },
              })
            }
          >
            Last 12 months
          </button>
        </fieldset>
        <fieldset className="dates-group" disabled={disabled}>
          <legend>
            <span>Expected online</span>
            <span className="dates-chip">Committed</span>
          </legend>
          <RangeFields
            range={filters.expected}
            min={asOfDay}
            onChange={(expected) => onChange({ ...filters, expected })}
          />
        </fieldset>
        <fieldset className="dates-group" disabled={disabled}>
          <legend>
            <span>Closed</span>
            <span className="dates-chip">Retired</span>
          </legend>
          <RangeFields
            range={filters.closed}
            max={asOfDay}
            onChange={(closed) => onChange({ ...filters, closed })}
          />
        </fieldset>
        <div className="dates-foot">
          <p className="muted">Units matching any range are shown</p>
          <button
            type="button"
            className="menu-clear"
            disabled={!active || disabled}
            onClick={() =>
              onChange({
                ...filters,
                commenced: { from: null, to: null },
                expected: { from: null, to: null },
                closed: { from: null, to: null },
              })
            }
          >
            Clear dates
          </button>
        </div>
      </div>
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
  examples,
  onPickExample,
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
        filters={filters}
        asOf={asOf}
        onChange={onChange}
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
      <ExamplesMenu
        examples={examples}
        disabled={disabled}
        onPick={onPickExample}
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
        data-tip="Reset"
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
