"use client";
import { useDictionary, useLocale } from "@/i18n/client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Form, Offcanvas } from "react-bootstrap";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { DataTable } from "@/components/admin/DataTable";
import { ResourceFilters } from "@/components/admin/ResourceFilters";
import { PaginationControls } from "@/components/admin/PaginationControls";
import { useAdminTableState } from "@/components/admin/useAdminTableState";
import { ViewHeader } from "@/components/admin/ViewHeader";
import { ActionIcon } from "@/components/shared/ActionIcon";

export type Event = {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: string | null;
  occurredAt: string;
};

export default function AdminEventsPage() {
  const locale = useLocale();
  const { access, accessToken } = useAdminAuth();
  const dictionary = useDictionary();
  const copy = dictionary.admin.events;
  const [events, setEvents] = useState<Event[]>([]);
  const [selected, setSelected] = useState<Event | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [clearDialog, setClearDialog] = useState(false);
  const [clearError, setClearError] = useState(false);
  const [clearSucceeded, setClearSucceeded] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const {
    action,
    clearFilters,
    from,
    page,
    query,
    setAction,
    setFrom,
    setPage,
    setQuery,
    setSize,
    setSort,
    setTargetId,
    setTargetType,
    setTo,
    size,
    sort,
    targetId,
    targetType,
    to,
  } = useAdminTableState(10, false, "occurredAt,desc");

  useEffect(() => {
    if (!accessToken) return;
    const search = new URLSearchParams({
      page: String(page),
      size: String(size),
      sort,
    });
    if (query.trim()) search.set("q", query.trim());
    if (action) search.set("action", action);
    if (targetType) search.set("targetType", targetType);
    if (targetId.trim()) search.set("targetId", targetId.trim());
    if (from) search.set("from", new Date(`${from}T00:00:00`).toISOString());
    if (to) search.set("to", new Date(`${to}T23:59:59.999`).toISOString());
    adminRequest<PageResponse<Event>>(accessToken, {
      url: `/api/admin/events?${search}`,
    }).then((r) => {
      if (r.status < 300) {
        setEvents(r.data.content);
        setTotal(r.data.totalElements);
        setTotalPages(r.data.totalPages);
      }
    });
  }, [accessToken, action, from, page, query, reloadVersion, size, sort, targetId, targetType, to]);

  const clearEvents = async () => {
    if (!accessToken) return;
    setClearing(true);
    setClearError(false);
    setClearSucceeded(false);
    try {
      const response = await adminRequest(accessToken, {
        method: "DELETE",
        url: "/api/admin/events",
      });
      if (response.status >= 300) throw new Error();
      setClearDialog(false);
      setSelected(null);
      setPage(0);
      setClearSucceeded(true);
      setReloadVersion((current) => current + 1);
    } catch {
      setClearError(true);
    } finally {
      setClearing(false);
    }
  };

  const types = useMemo(() => [...new Set(events.map((event) => event.action))].sort(), [events]);
  const activeFilters = [
    query && { label: copy.search, value: query, onRemove: () => setQuery("") },
    action && { label: copy.action, value: action, onRemove: () => setAction("") },
    targetType && { label: copy.targetType, value: targetType, onRemove: () => setTargetType("") },
    targetId && { label: copy.targetId, value: targetId, onRemove: () => setTargetId("") },
    from && { label: copy.from, value: from, onRemove: () => setFrom("") },
    to && { label: copy.to, value: to, onRemove: () => setTo("") },
  ].filter(Boolean) as { label: string; value: string; onRemove: () => void }[];
  return (
    <>
      <ViewHeader
        title={copy.title}
        description={copy.subtitle}
        status={
          <Badge bg="secondary">
            {total} {copy.records}
          </Badge>
        }
      />
      {clearSucceeded && (
        <Alert variant="success" className="mb-4">
          {copy.clearAllSuccess}
        </Alert>
      )}
      {access?.manageEvents && (
        <div className="admin-form-actions mb-4">
          <Button variant="danger" onClick={() => setClearDialog(true)}>
            <ActionIcon action="delete" />
            {copy.clearAll}
          </Button>
          {clearError && <span className="text-danger">{copy.clearAllError}</span>}
        </div>
      )}
      <ResourceFilters
        query={query}
        searchLabel={copy.search}
        onQueryChange={setQuery}
        sort={{
          label: dictionary.admin.resources.sort,
          value: sort,
          options: [
            { value: "occurredAt,desc", label: dictionary.admin.resources.newest },
            { value: "occurredAt,asc", label: dictionary.admin.resources.oldest },
          ],
          onChange: setSort,
        }}
        activeFilters={activeFilters}
        clearFiltersLabel={copy.clearFilters}
        onClearFilters={clearFilters}
        resultCount={total}
        recordsLabel={copy.records}
        filterToggle={
          <Button
            aria-expanded={showFilters}
            onClick={() => setShowFilters((current) => !current)}
            size="sm"
            variant="secondary"
          >
            <ActionIcon action="filter" />
            {showFilters ? copy.hideFilters : copy.filterEvents}
          </Button>
        }
        childrenClassName="admin-resource-filter-controls"
      >
        {showFilters && (
          <>
            <Form.Select
              aria-label={copy.action}
              className="admin-resource-filter-control"
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              <option value="">{copy.allActions}</option>
              {types.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Form.Select>
            <Form.Select
              aria-label={copy.targetType}
              className="admin-resource-filter-control"
              value={targetType}
              onChange={(event) => setTargetType(event.target.value)}
            >
              <option value="">{copy.allTargetTypes}</option>
              <option value="client">{copy.targetTypes.client}</option>
              <option value="user">{copy.targetTypes.user}</option>
              <option value="session">{copy.targetTypes.session}</option>
              <option value="consent">{copy.targetTypes.consent}</option>
              <option value="key">{copy.targetTypes.key}</option>
              <option value="role">{copy.targetTypes.role}</option>
              <option value="client-scope">{copy.targetTypes.clientScope}</option>
            </Form.Select>
            <Form.Control
              className="admin-resource-filter-control"
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              placeholder={copy.targetId}
              aria-label={copy.targetId}
            />
            <Form.Control
              className="admin-resource-filter-control"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              aria-label={copy.from}
            />
            <Form.Control
              className="admin-resource-filter-control"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              aria-label={copy.to}
            />
          </>
        )}
      </ResourceFilters>
      <DataTable
        isEmpty={events.length === 0}
        emptyMessage={copy.empty}
        footer={
          <PaginationControls
            page={page}
            totalPages={totalPages}
            totalElements={total}
            size={size}
            rowsPerPage={dictionary.admin.resources.rowsPerPage}
            pageLabel={dictionary.admin.resources.page}
            previous={dictionary.admin.resources.previous}
            next={dictionary.admin.resources.next}
            first={dictionary.admin.resources.first}
            last={dictionary.admin.resources.last}
            onPageChange={setPage}
            onSizeChange={setSize}
          />
        }
      >
        <thead>
          <tr>
            <th>{copy.time}</th>
            <th>{copy.action}</th>
            <th>{copy.actor}</th>
            <th>{copy.target}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr className="admin-clickable-row" key={e.id} onClick={() => setSelected(e)}>
              <td>{new Date(e.occurredAt).toLocaleString(locale)}</td>
              <td>
                <Badge bg="secondary" className="font-monospace">
                  {e.action}
                </Badge>
              </td>
              <td>{e.actor}</td>
              <td>
                <div>{e.targetType}</div>
                <div className="small text-body-secondary text-break">{e.targetId}</div>
              </td>
              <td className="text-end text-body-secondary">›</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <Offcanvas
        placement="end"
        show={selected !== null}
        onHide={() => setSelected(null)}
        className="admin-event-drawer"
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>{copy.details}</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {selected && (
            <dl className="admin-event-details">
              <dt>ID</dt>
              <dd className="font-monospace text-break">{selected.id}</dd>
              <dt>{copy.time}</dt>
              <dd>{new Date(selected.occurredAt).toLocaleString(locale)}</dd>
              <dt>{copy.action}</dt>
              <dd>
                <code>{selected.action}</code>
              </dd>
              <dt>{copy.actor}</dt>
              <dd>{selected.actor}</dd>
              <dt>{copy.targetType}</dt>
              <dd>{selected.targetType}</dd>
              <dt>{copy.target}</dt>
              <dd className="text-break">{selected.targetId}</dd>
              {selected.details && (
                <>
                  <dt>{copy.details}</dt>
                  <dd className="text-break">{selected.details}</dd>
                </>
              )}
            </dl>
          )}
        </Offcanvas.Body>
      </Offcanvas>
      <ConfirmModal
        show={clearDialog}
        message={copy.clearAllMessage}
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={copy.clearAll}
        busy={clearing}
        onCancel={() => setClearDialog(false)}
        onConfirm={clearEvents}
      />
    </>
  );
}
