"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Form, InputGroup, ListGroup, Spinner } from "react-bootstrap";

import Link from "@/routing/Link";
import { adminRequest } from "@/lib/admin-api";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { useAdminAuth } from "./AdminAuthProvider";
import type { Dictionary } from "@/i18n/get-dictionary";

type SearchResult = {
  type: "user" | "client" | "role" | "group";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

type SearchResponse = { results: SearchResult[] };

type Props = { dictionary: Dictionary };

const RESULT_TYPES: SearchResult["type"][] = ["user", "client", "role", "group"];

export function AdminGlobalSearch({ dictionary }: Props) {
  const { accessToken } = useAdminAuth();
  const copy = dictionary.admin.globalSearch;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const groupedResults = useMemo(
    () =>
      RESULT_TYPES.map((type) => ({
        type,
        results: results.filter((result) => result.type === type),
      })).filter((group) => group.results.length > 0),
    [results],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("admin-global-search")?.focus();
      }
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!accessToken || normalizedQuery.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      adminRequest<SearchResponse>(accessToken, {
        url: `/api/admin/search?q=${encodeURIComponent(normalizedQuery)}`,
        signal: controller.signal,
      })
        .then((response) => {
          if (response.status >= 300) throw new Error("Global search failed");
          setResults(response.data.results);
        })
        .catch(() => {
          if (!controller.signal.aborted) setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [accessToken, query]);

  const showResults = open && query.trim().length >= 2;

  return (
    <div className={`admin-global-search${showResults ? " has-results" : ""}`}>
      <InputGroup>
        <InputGroup.Text>
          <ActionIcon action="search" className="" />
        </InputGroup.Text>
        <Form.Control
          id="admin-global-search"
          type="search"
          value={query}
          placeholder={copy.placeholder}
          aria-label={copy.ariaLabel}
          aria-expanded={showResults}
          aria-controls="admin-global-search-results"
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (nextQuery.trim().length < 2) {
              setResults([]);
              setLoading(false);
            }
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              event.currentTarget.blur();
            }
          }}
        />
        {loading && (
          <InputGroup.Text aria-label={copy.loading}>
            <Spinner animation="border" size="sm" role="status">
              <span className="visually-hidden">{copy.loading}</span>
            </Spinner>
          </InputGroup.Text>
        )}
        <InputGroup.Text className="admin-search-shortcut d-none d-md-flex">⌘K</InputGroup.Text>
      </InputGroup>
      {showResults && (
        <div
          id="admin-global-search-results"
          className="admin-global-search-results"
          role="listbox"
        >
          {groupedResults.length > 0 ? (
            groupedResults.map((group) => (
              <div key={group.type} className="admin-global-search-group">
                <div className="admin-global-search-heading">
                  {copy.types[group.type]}
                  <Badge bg="secondary" pill>
                    {group.results.length}
                  </Badge>
                </div>
                <ListGroup variant="flush">
                  {group.results.map((result) => (
                    <ListGroup.Item
                      key={`${result.type}-${result.id}`}
                      as={Link}
                      href={result.href}
                      action
                      role="option"
                      onClick={() => setOpen(false)}
                    >
                      <span className="fw-semibold d-block text-truncate">{result.title}</span>
                      {result.subtitle && (
                        <span className="small text-body-secondary d-block text-truncate">
                          {result.subtitle}
                        </span>
                      )}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </div>
            ))
          ) : loading ? null : (
            <ListGroup variant="flush">
              <ListGroup.Item className="admin-global-search-empty" role="status">
                {copy.noResults}
              </ListGroup.Item>
            </ListGroup>
          )}
        </div>
      )}
    </div>
  );
}
