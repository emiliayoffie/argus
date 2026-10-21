import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  label,
  STATES,
  STATUSES,
  TECH_GROUPS,
  type Dimension,
  type Filters,
} from "../domain/types";
import { SEARCH_MAX_LENGTH } from "../domain/url";

type Props = {
  filters: Filters;
  onChange: (filters: Filters) => void;
  // One reset for the whole view (filters, breakdown, highlights, sort, map)
  onReset: () => void;
  canReset: boolean;
  disabled: boolean;
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
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  const focusables = () =>
    Array.from(
      details.current?.querySelectorAll<HTMLElement>(
        "input:not(:disabled), button:not(:disabled)",
      ) ?? [],
    );

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
    if (!details.current?.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
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

  return (
    <details
      ref={details}
      className={selected.length ? "menu active" : "menu"}
      onToggle={(e) => {
        const isOpen = e.currentTarget.open;
        setOpen(isOpen);
        if (isOpen) focusables()[0]?.focus();
      }}
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        // Focus left the whole menu (Tab out): close without stealing focus back
        if (!e.currentTarget.contains(e.relatedTarget)) close(false);
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

// Base filters as a slim toolbar: three menus, search, and the one Reset for
// the whole view
export function FilterBar({
  filters,
  onChange,
  onReset,
  canReset,
  disabled,
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
      <button type="button" onClick={onReset} disabled={disabled || !canReset}>
        Reset view
      </button>
    </section>
  );
}
