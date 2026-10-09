"use client";

import Link from "@/routing/Link";
import { useEffect, useRef, useState } from "react";
import { Dropdown, Spinner } from "react-bootstrap";

import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";

import { AdminActionIcon } from "./AdminActionIcon";
import { useAdminAuth } from "./AdminAuthProvider";
import { ConfirmModal } from "./ConfirmModal";
import { DataTable } from "./DataTable";
import { ErrorState, LoadingState } from "./AsyncState";
import { Icon } from "@/components/shared/Icon";
import { PaginationControls } from "./PaginationControls";
import { ResourceFilters } from "./ResourceFilters";
import { RowActions } from "./RowActions";
import type { UserProfileDefinition } from "./UserProfileAttributeForm";
import { useAdminTableState } from "./useAdminTableState";

export default function AdminUserProfileSettings({ dictionary }: { dictionary: Dictionary }) {
  const { access, accessToken } = useAdminAuth();
  const copy = dictionary.admin.userProfileSettings;
  const [definitions, setDefinitions] = useState<UserProfileDefinition[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserProfileDefinition | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const pointerDragId = useRef<number | null>(null);
  const pointerTargetIndex = useRef<number | null>(null);
  const { clearFilters, page, query, setPage, setQuery, setSize, setSort, size, sort } =
    useAdminTableState(10, false, "displayOrder,asc");

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<PageResponse<UserProfileDefinition>>(accessToken, {
      url: `/api/admin/settings/user-profile/page?q=${encodeURIComponent(query)}&page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`,
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setDefinitions(response.data.content);
        setTotalPages(response.data.totalPages);
        setTotalElements(response.data.totalElements);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accessToken, page, query, refresh, size, sort]);

  const canReorder =
    Boolean(access?.isAdmin) &&
    !query &&
    page === 0 &&
    sort === "displayOrder,asc" &&
    totalElements <= size &&
    definitions.length > 1;

  const persistOrder = async (
    nextDefinitions: UserProfileDefinition[],
    previousDefinitions: UserProfileDefinition[],
  ) => {
    if (!accessToken) return;
    setReordering(true);
    try {
      const response = await adminRequest<UserProfileDefinition[]>(accessToken, {
        method: "PUT",
        url: "/api/admin/settings/user-profile/order",
        data: { ids: nextDefinitions.map(({ id }) => id) },
      });
      if (response.status >= 300) throw new Error();
      setDefinitions(response.data.slice(0, size));
      setError(false);
    } catch {
      setDefinitions(previousDefinitions);
      setError(true);
    } finally {
      setDraggedId(null);
      setReordering(false);
    }
  };

  const moveDefinition = (id: number, targetIndex: number) => {
    if (reordering || !canReorder || targetIndex < 0 || targetIndex >= definitions.length) return;
    const sourceIndex = definitions.findIndex((definition) => definition.id === id);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;
    const nextDefinitions = [...definitions];
    const [moved] = nextDefinitions.splice(sourceIndex, 1);
    nextDefinitions.splice(targetIndex, 0, moved);
    setDraggedId(id);
    setDefinitions(nextDefinitions);
    void persistOrder(nextDefinitions, definitions);
  };

  const startPointerDrag = (id: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (reordering || !canReorder) return;
    event.preventDefault();
    event.currentTarget.focus();
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    pointerDragId.current = id;
    pointerTargetIndex.current = definitions.findIndex((definition) => definition.id === id);
    setDraggedId(id);
  };

  const updatePointerDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerDragId.current === null) return;
    const row = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("tr[data-profile-definition-id]");
    if (!row) return;
    const targetId = Number(row.dataset.profileDefinitionId);
    const targetIndex = definitions.findIndex((definition) => definition.id === targetId);
    if (targetIndex >= 0) pointerTargetIndex.current = targetIndex;
  };

  const finishPointerDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerDragId.current === null) return;
    if (
      typeof event.currentTarget.hasPointerCapture === "function" &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const id = pointerDragId.current;
    const targetIndex = pointerTargetIndex.current;
    pointerDragId.current = null;
    pointerTargetIndex.current = null;
    setDraggedId(null);
    if (targetIndex !== null) moveDefinition(id, targetIndex);
  };

  const remove = async () => {
    if (!accessToken || !access?.isAdmin || !deleteTarget) return;
    setDeleting(deleteTarget.id);
    try {
      const response = await adminRequest(accessToken, {
        method: "DELETE",
        url: `/api/admin/settings/user-profile/${deleteTarget.id}`,
      });
      if (response.status >= 300) throw new Error();
      setDeleteTarget(null);
      setLoading(true);
      if (definitions.length === 1 && page > 0) setPage(page - 1);
      else setRefresh((value) => value + 1);
    } catch {
      setError(true);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <LoadingState />;
  if (error && definitions.length === 0) return <ErrorState message={copy.error} />;

  return (
    <>
      {error && <ErrorState message={copy.error} />}
      <div className="admin-detail-heading mb-3">
        <div>
          <h2 className="h5 mb-1">{copy.title}</h2>
          <p className="text-body-secondary mb-0">{copy.subtitle}</p>
        </div>
        {access?.isAdmin && (
          <Link className="btn btn-primary text-nowrap" href="/admin/settings/user-profile/new">
            <AdminActionIcon action="add" />
            {copy.create}
          </Link>
        )}
      </div>
      <ResourceFilters
        onQueryChange={setQuery}
        query={query}
        searchLabel={copy.search}
        sort={{
          label: dictionary.admin.resources.sort,
          value: sort,
          options: [
            {
              value: "displayOrder,asc",
              label: `${copy.displayOrder} · ${dictionary.admin.resources.ascending}`,
            },
            {
              value: "displayOrder,desc",
              label: `${copy.displayOrder} · ${dictionary.admin.resources.descending}`,
            },
            { value: "name,asc", label: `${copy.name} · ${dictionary.admin.resources.ascending}` },
            {
              value: "name,desc",
              label: `${copy.name} · ${dictionary.admin.resources.descending}`,
            },
          ],
          onChange: setSort,
        }}
        activeFilters={
          query ? [{ label: copy.search, value: query, onRemove: () => setQuery("") }] : []
        }
        clearFiltersLabel={dictionary.admin.resources.clearFilters}
        onClearFilters={clearFilters}
        resultCount={totalElements}
        recordsLabel={copy.records}
      />
      <DataTable
        isEmpty={definitions.length === 0}
        emptyMessage={copy.empty}
        footer={
          totalElements > 0 ? (
            <PaginationControls
              next={dictionary.admin.resources.next}
              previous={dictionary.admin.resources.previous}
              first={dictionary.admin.resources.first}
              last={dictionary.admin.resources.last}
              rowsPerPage={dictionary.admin.resources.rowsPerPage}
              pageLabel={dictionary.admin.resources.page}
              onPageChange={setPage}
              onSizeChange={setSize}
              page={page}
              size={size}
              totalElements={totalElements}
              totalPages={totalPages}
            />
          ) : undefined
        }
      >
        <thead>
          <tr>
            <th aria-label={copy.reorder} />
            <th>{copy.name}</th>
            <th>{copy.type}</th>
            <th>{copy.displayOrder}</th>
            <th>{copy.rules}</th>
            <th>{copy.enabled}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {definitions.map((definition, index) => (
            <tr
              key={definition.id}
              data-profile-definition-id={definition.id}
              onDragOver={(event) => {
                if (canReorder && !reordering) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                moveDefinition(definition.id, index);
              }}
            >
              <td data-label={copy.reorder}>
                {canReorder && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary profile-reorder-handle"
                    aria-label={`${copy.reorder}: ${definition.displayName}`}
                    disabled={reordering}
                    onPointerDown={(event) => startPointerDrag(definition.id, event)}
                    onPointerMove={updatePointerDrag}
                    onPointerUp={finishPointerDrag}
                    onPointerCancel={finishPointerDrag}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        moveDefinition(definition.id, index - 1);
                      }
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        moveDefinition(definition.id, index + 1);
                      }
                    }}
                  >
                    {reordering && draggedId === definition.id ? (
                      <Spinner animation="border" aria-hidden="true" size="sm" />
                    ) : (
                      <Icon icon="bars" />
                    )}
                  </button>
                )}
              </td>
              <td data-label={copy.name}>
                <Link
                  className="text-decoration-none"
                  href={`/admin/settings/user-profile/${definition.id}`}
                >
                  <span className="fw-semibold">{definition.displayName}</span>
                </Link>
                <div className="small text-body-secondary font-monospace">{definition.name}</div>
              </td>
              <td data-label={copy.type}>
                {copy.types[definition.type.toLowerCase() as keyof typeof copy.types]}
              </td>
              <td data-label={copy.displayOrder}>{definition.displayOrder}</td>
              <td data-label={copy.rules}>
                {[
                  definition.required && copy.required,
                  definition.multivalued && copy.multivalued,
                  definition.pattern,
                ]
                  .filter(Boolean)
                  .join(" · ") || copy.noRules}
              </td>
              <td data-label={copy.enabled}>{definition.enabled ? copy.yes : copy.no}</td>
              <td className="text-end">
                <RowActions label={`${definition.displayName} ${dictionary.admin.common.actions}`}>
                  <Dropdown.Item as={Link} href={`/admin/settings/user-profile/${definition.id}`}>
                    <AdminActionIcon action="edit" />
                    {copy.edit}
                  </Dropdown.Item>
                  {access?.isAdmin && !definition.builtIn && (
                    <>
                      <Dropdown.Divider />
                      <Dropdown.Item
                        className="text-danger"
                        disabled={deleting === definition.id}
                        onClick={() => setDeleteTarget(definition)}
                      >
                        <AdminActionIcon action="delete" />
                        {copy.delete}
                      </Dropdown.Item>
                    </>
                  )}
                </RowActions>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <ConfirmModal
        show={deleteTarget !== null}
        busy={deleting !== null}
        message={copy.deleteConfirm}
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={copy.delete}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
      />
    </>
  );
}
