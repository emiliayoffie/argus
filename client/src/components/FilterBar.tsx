import { useId } from "react";
import { EMPTY_FILTERS } from "../domain/filter";
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
  disabled: boolean;
};

// One facet as a group of checkboxes. Checking several means "any of these"
function FacetGroup<T extends string>({
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
  const toggle = (value: T, checked: boolean) =>
    onChange(
      checked ? [...selected, value] : selected.filter((v) => v !== value),
    );
  return (
    <fieldset className="facet" disabled={disabled}>
      <legend>{title}</legend>
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
    </fieldset>
  );
}

// Base filters: OR within a group, AND across groups, plus a name search
export function FilterBar({ filters, onChange, disabled }: Props) {
  const searchId = useId();
  const isEmpty =
    filters.states.length === 0 &&
    filters.techGroups.length === 0 &&
    filters.statuses.length === 0 &&
    filters.search === "";
  return (
    <section className="toolbar" aria-labelledby="filters-heading">
      <h2 id="filters-heading" className="visually-hidden">
        Filters
      </h2>
      <FacetGroup
        title="State / region"
        dim="state"
        options={STATES}
        selected={filters.states}
        onChange={(states) => onChange({ ...filters, states })}
        disabled={disabled}
      />
      <FacetGroup
        title="Technology"
        dim="techGroup"
        options={TECH_GROUPS}
        selected={filters.techGroups}
        onChange={(techGroups) => onChange({ ...filters, techGroups })}
        disabled={disabled}
      />
      <FacetGroup
        title="Status"
        dim="status"
        options={STATUSES}
        selected={filters.statuses}
        onChange={(statuses) => onChange({ ...filters, statuses })}
        disabled={disabled}
      />
      <div className="toolbar-search">
        <label htmlFor={searchId}>Search</label>
        <input
          id={searchId}
          type="search"
          placeholder="Facility name or code"
          value={filters.search}
          maxLength={SEARCH_MAX_LENGTH}
          disabled={disabled}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          disabled={disabled || isEmpty}
        >
          Reset filters
        </button>
        <p className="muted">
          Groups combine: a facility is listed when one of its units matches
          every group.
        </p>
      </div>
    </section>
  );
}
