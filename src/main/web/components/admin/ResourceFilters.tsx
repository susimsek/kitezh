import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Badge, Button, Form, InputGroup } from "react-bootstrap";

import { ActionIcon } from "@/components/shared/ActionIcon";

export function ResourceFilters({
  query,
  searchLabel,
  onQueryChange,
  filterToggle,
  children,
  sort,
  activeFilters = [],
  clearFiltersLabel,
  onClearFilters,
  resultCount,
  recordsLabel,
  childrenClassName,
}: {
  query: string;
  searchLabel: string;
  onQueryChange: (value: string) => void;
  filterToggle?: React.ReactNode;
  children?: React.ReactNode;
  sort?: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
  };
  activeFilters?: { label: string; value: string; onRemove: () => void }[];
  clearFiltersLabel?: string;
  onClearFilters?: () => void;
  resultCount?: number;
  recordsLabel?: string;
  childrenClassName?: string;
}) {
  const [value, setValue] = useState(query);
  const lastNotifiedQuery = useRef(query);
  const syncingQuery = useRef(false);
  const notifyQueryChange = useEffectEvent(onQueryChange);
  useEffect(() => {
    if (query === lastNotifiedQuery.current) return;
    lastNotifiedQuery.current = query;
    syncingQuery.current = true;
    setValue(query);
  }, [query]);
  useEffect(() => {
    if (value === query) return;
    if (syncingQuery.current) {
      syncingQuery.current = false;
      return;
    }
    const timeout = window.setTimeout(() => notifyQueryChange(value), 300);
    return () => window.clearTimeout(timeout);
  }, [query, value]);
  return (
    <div className="admin-resource-filters p-3 border-bottom">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <InputGroup className="admin-search-input">
          <InputGroup.Text>
            <ActionIcon action="search" className="m-0" />
          </InputGroup.Text>
          <Form.Control
            aria-label={searchLabel}
            onChange={(event) => {
              syncingQuery.current = false;
              setValue(event.target.value);
            }}
            placeholder={searchLabel}
            value={value}
          />
        </InputGroup>
        {filterToggle}
        {sort && (
          <Form.Select
            aria-label={sort.label}
            className="admin-resource-filter-control"
            value={sort.value}
            onChange={(event) => sort.onChange(event.target.value)}
          >
            {sort.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Form.Select>
        )}
        {children && (
          <div className={`ms-auto d-flex flex-wrap gap-2 ${childrenClassName ?? ""}`}>
            {children}
          </div>
        )}
      </div>
      {(activeFilters.length > 0 || resultCount !== undefined) && (
        <div className="admin-active-filters mt-3">
          {resultCount !== undefined && (
            <span className="text-body-secondary small">
              {resultCount} {recordsLabel}
            </span>
          )}
          {activeFilters.map((filter) => (
            <Badge bg="secondary" key={`${filter.label}-${filter.value}`}>
              {filter.label}: {filter.value}
              <button
                aria-label={`${filter.label}: ${filter.value}`}
                className="admin-filter-remove"
                type="button"
                onClick={filter.onRemove}
              >
                <ActionIcon action="cancel" className="m-0" />
              </button>
            </Badge>
          ))}
          {activeFilters.length > 0 && clearFiltersLabel && onClearFilters && (
            <Button size="sm" variant="link" className="p-0" onClick={onClearFilters}>
              <ActionIcon action="cancel" />
              {clearFiltersLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
