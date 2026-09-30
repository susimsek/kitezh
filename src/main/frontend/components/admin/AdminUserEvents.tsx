"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Form, Offcanvas } from "react-bootstrap";
import { useDictionary, useLocale } from "@/i18n/client";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { useAdminAuth } from "./AdminAuthProvider";
import { ConfirmModal } from "./ConfirmModal";
import { DataTable } from "./DataTable";
import { PaginationControls } from "./PaginationControls";
import { ResourceFilters } from "./ResourceFilters";
import { useAdminTableState } from "./useAdminTableState";
import { ViewHeader } from "./ViewHeader";
import { DetailTabs } from "./DetailTabs";
import { ActionIcon } from "@/components/shared/ActionIcon";

type UserEvent = {
  id: string;
  username: string;
  type: "LOGIN_SUCCESS" | "LOGIN_FAILURE";
  clientId?: string | null;
  ipAddress?: string | null;
  occurredAt: string;
};

export default function AdminUserEvents() {
  const dictionary = useDictionary();
  const copy = dictionary.admin.events;
  const locale = useLocale();
  const { access, accessToken } = useAdminAuth();
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [selected, setSelected] = useState<UserEvent | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [clearDialog, setClearDialog] = useState(false);
  const [clearError, setClearError] = useState(false);
  const [clearSucceeded, setClearSucceeded] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [ipAddress, setIpAddress] = useState("");
  const { clientId, clearFilters, from, page, query, setClientId, setFrom, setPage, setQuery, setSize, setSort, setTo, setUsername, size, sort, to, username } = useAdminTableState(10, false, "occurredAt,desc");
  const [type, setType] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    const search = new URLSearchParams({ page: String(page), size: String(size), sort });
    if (query.trim()) search.set("q", query.trim());
    if (type) search.set("type", type);
    if (username.trim()) search.set("username", username.trim());
    if (clientId.trim()) search.set("clientId", clientId.trim());
    if (ipAddress.trim()) search.set("ipAddress", ipAddress.trim());
    if (from) search.set("from", new Date(`${from}T00:00:00`).toISOString());
    if (to) search.set("to", new Date(`${to}T23:59:59.999`).toISOString());
    adminRequest<PageResponse<UserEvent>>(accessToken, { url: `/api/admin/user-events?${search}` }).then((response) => {
      if (response.status < 300) {
        setEvents(response.data.content);
        setTotal(response.data.totalElements);
        setTotalPages(response.data.totalPages);
      }
    });
  }, [accessToken, clientId, from, ipAddress, page, query, reloadVersion, size, sort, to, type, username]);

  const clearEvents = async () => {
    if (!accessToken) return;
    setClearing(true);
    setClearError(false);
    try {
      const response = await adminRequest(accessToken, { method: "DELETE", url: "/api/admin/user-events" });
      if (response.status >= 300) throw new Error();
      setClearDialog(false);
      setClearSucceeded(true);
      setSelected(null);
      setPage(0);
      setReloadVersion((value) => value + 1);
    } catch {
      setClearError(true);
    } finally {
      setClearing(false);
    }
  };

  const activeFilters = useMemo(() => [
    query && { label: copy.search, value: query, onRemove: () => setQuery("") },
    type && { label: copy.type, value: type, onRemove: () => setType("") },
    username && { label: copy.username, value: username, onRemove: () => setUsername("") },
    clientId && { label: copy.clientId, value: clientId, onRemove: () => setClientId("") },
    ipAddress && { label: copy.ipAddress, value: ipAddress, onRemove: () => setIpAddress("") },
    from && { label: copy.from, value: from, onRemove: () => setFrom("") },
    to && { label: copy.to, value: to, onRemove: () => setTo("") },
  ].filter(Boolean) as { label: string; value: string; onRemove: () => void }[], [clientId, copy, from, ipAddress, query, setClientId, setFrom, setQuery, setTo, setUsername, to, type, username]);

  return <>
    <ViewHeader title={copy.userTitle} description={copy.userSubtitle} status={<Badge bg="secondary">{total} {copy.userRecords}</Badge>} />
    <DetailTabs tabs={[{ key: "admin", label: copy.adminTab, href: "/admin/events" }, { key: "user", label: copy.userTab, href: "/admin/events/user" }]} active="user" />
    {clearSucceeded && <Alert variant="success" className="mb-4">{copy.userClearAllSuccess}</Alert>}
    {access?.manageEvents && <div className="admin-form-actions mb-4"><Button variant="danger" onClick={() => setClearDialog(true)}><ActionIcon action="delete" />{copy.userClearAll}</Button>{clearError && <span className="text-danger">{copy.userClearAllError}</span>}</div>}
    <ResourceFilters query={query} searchLabel={copy.userSearch} onQueryChange={setQuery} sort={{ label: dictionary.admin.resources.sort, value: sort, options: [{ value: "occurredAt,desc", label: dictionary.admin.resources.newest }, { value: "occurredAt,asc", label: dictionary.admin.resources.oldest }], onChange: setSort }} activeFilters={activeFilters} clearFiltersLabel={copy.clearFilters} onClearFilters={() => { clearFilters(); setType(""); setIpAddress(""); }} resultCount={total} recordsLabel={copy.userRecords} filterToggle={<Button aria-expanded={showFilters} onClick={() => setShowFilters((value) => !value)} size="sm" variant="secondary"><ActionIcon action="filter" />{showFilters ? copy.hideFilters : copy.userFilter}</Button>} childrenClassName="admin-resource-filter-controls">
      {showFilters && <><Form.Select aria-label={copy.type} className="admin-resource-filter-control" value={type} onChange={(event) => setType(event.target.value)}><option value="">{copy.allTypes}</option><option value="LOGIN_SUCCESS">{copy.loginSuccess}</option><option value="LOGIN_FAILURE">{copy.loginFailure}</option></Form.Select><Form.Control className="admin-resource-filter-control" aria-label={copy.username} value={username} onChange={(event) => setUsername(event.target.value)} placeholder={copy.username} /><Form.Control className="admin-resource-filter-control" aria-label={copy.clientId} value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder={copy.clientId} /><Form.Control className="admin-resource-filter-control" aria-label={copy.ipAddress} value={ipAddress} onChange={(event) => setIpAddress(event.target.value)} placeholder={copy.ipAddress} /><Form.Control className="admin-resource-filter-control" type="date" aria-label={copy.from} value={from} onChange={(event) => setFrom(event.target.value)} /><Form.Control className="admin-resource-filter-control" type="date" aria-label={copy.to} value={to} onChange={(event) => setTo(event.target.value)} /></>}
    </ResourceFilters>
    <DataTable isEmpty={events.length === 0} emptyMessage={copy.userEmpty} footer={<PaginationControls page={page} totalPages={totalPages} totalElements={total} size={size} rowsPerPage={dictionary.admin.resources.rowsPerPage} pageLabel={dictionary.admin.resources.page} previous={dictionary.admin.resources.previous} next={dictionary.admin.resources.next} first={dictionary.admin.resources.first} last={dictionary.admin.resources.last} onPageChange={setPage} onSizeChange={setSize} />}>
      <thead><tr><th>{copy.time}</th><th>{copy.type}</th><th>{copy.username}</th><th>{copy.clientId}</th><th>{copy.ipAddress}</th><th /></tr></thead>
      <tbody>{events.map((event) => <tr className="admin-clickable-row" key={event.id} onClick={() => setSelected(event)}><td>{new Date(event.occurredAt).toLocaleString(locale)}</td><td><Badge bg="secondary" className="font-monospace">{event.type}</Badge></td><td>{event.username}</td><td>{event.clientId || "—"}</td><td>{event.ipAddress || "—"}</td><td className="text-end text-body-secondary">›</td></tr>)}</tbody>
    </DataTable>
    <Offcanvas placement="end" show={selected !== null} onHide={() => setSelected(null)} className="admin-event-drawer"><Offcanvas.Header closeButton><Offcanvas.Title>{copy.userDetails}</Offcanvas.Title></Offcanvas.Header><Offcanvas.Body>{selected && <dl className="admin-event-details"><dt>ID</dt><dd className="font-monospace text-break">{selected.id}</dd><dt>{copy.time}</dt><dd>{new Date(selected.occurredAt).toLocaleString(locale)}</dd><dt>{copy.type}</dt><dd><code>{selected.type}</code></dd><dt>{copy.username}</dt><dd>{selected.username}</dd><dt>{copy.clientId}</dt><dd>{selected.clientId || "—"}</dd><dt>{copy.ipAddress}</dt><dd>{selected.ipAddress || "—"}</dd></dl>}</Offcanvas.Body></Offcanvas>
    <ConfirmModal show={clearDialog} message={copy.userClearAllMessage} cancelLabel={dictionary.admin.common.cancel} confirmLabel={copy.userClearAll} busy={clearing} onCancel={() => setClearDialog(false)} onConfirm={clearEvents} />
  </>;
}
