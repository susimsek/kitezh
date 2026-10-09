"use client";

import Link from "@/routing/Link";
import { useEffect, useState } from "react";
import { Dropdown } from "react-bootstrap";

import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { ConfirmModal } from "./ConfirmModal";
import { DataTable } from "./DataTable";
import { ErrorState, LoadingState } from "./AsyncState";
import { PaginationControls } from "./PaginationControls";
import { ResourceFilters } from "./ResourceFilters";
import { RowActions } from "./RowActions";
import { useAdminTableState } from "./useAdminTableState";
import { AdminPageHeader } from "./AdminPageHeader";

type Group = { id: number; name: string; path: string; roles: string[]; userCount: number };

export function GroupsTable({ dictionary }: { dictionary: Dictionary }) {
  const { access, accessToken } = useAdminAuth();
  const copy = dictionary.admin.groups;
  const [groups, setGroups] = useState<Group[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const { clearFilters, page, query, setPage, setQuery, setSize, setSort, size, sort } =
    useAdminTableState(10, false, "name,asc");

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<PageResponse<Group>>(accessToken, {
      url: `/api/admin/groups?q=${encodeURIComponent(query)}&page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`,
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setGroups(response.data.content);
        setTotalPages(response.data.totalPages);
        setTotalElements(response.data.totalElements);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accessToken, page, query, refresh, size, sort]);

  const remove = async (group: Group) => {
    if (!access?.manageUsers || !accessToken) return;
    setSaving(true);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/groups/${group.id}`,
        method: "DELETE",
      });
      if (response.status >= 300) throw new Error();
      setLoading(true);
      if (groups.length === 1 && page > 0) setPage(page - 1);
      else setRefresh((current) => current + 1);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  return (
    <>
      {error && <ErrorState message={copy.operationError} />}
      <AdminPageHeader
        title={copy.title}
        description={copy.subtitle}
        actions={
          access?.manageUsers ? (
            <Link className="btn btn-primary" href="/admin/groups/new">
              <AdminActionIcon action="add" />
              {copy.create}
            </Link>
          ) : undefined
        }
      />
      <ResourceFilters
        onQueryChange={setQuery}
        query={query}
        searchLabel={dictionary.admin.resources.search}
        sort={{
          label: dictionary.admin.resources.sort,
          value: sort,
          options: [
            { value: "name,asc", label: `${copy.name} · ${dictionary.admin.resources.ascending}` },
            {
              value: "name,desc",
              label: `${copy.name} · ${dictionary.admin.resources.descending}`,
            },
          ],
          onChange: setSort,
        }}
        activeFilters={
          query
            ? [
                {
                  label: dictionary.admin.resources.search,
                  value: query,
                  onRemove: () => setQuery(""),
                },
              ]
            : []
        }
        clearFiltersLabel={dictionary.admin.resources.clearFilters}
        onClearFilters={clearFilters}
        resultCount={totalElements}
        recordsLabel={dictionary.admin.resources.records}
      ></ResourceFilters>
      <DataTable
        emptyMessage={dictionary.admin.resources.empty}
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
        isEmpty={groups.length === 0}
      >
        <thead>
          <tr>
            <th>{copy.name}</th>
            <th>{copy.roleMappings}</th>
            <th>{copy.members}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.id}>
              <td data-label={copy.name}>
                <Link className="text-decoration-none" href={`/admin/groups/${group.id}/details`}>
                  {group.path}
                </Link>
              </td>
              <td data-label={copy.roleMappings}>{group.roles.length}</td>
              <td data-label={copy.members}>{group.userCount}</td>
              <td className="text-end">
                <RowActions label={`${group.path} ${dictionary.admin.common.actions}`}>
                  <Dropdown.Item as={Link} href={`/admin/groups/${group.id}/details`}>
                    <AdminActionIcon action="edit" />
                    {copy.settings}
                  </Dropdown.Item>
                  {access?.manageUsers && (
                    <>
                      <Dropdown.Divider />
                      <Dropdown.Item
                        className="text-danger"
                        disabled={saving}
                        onClick={() => setGroupToDelete(group)}
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
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={copy.delete}
        message={copy.deleteConfirm}
        onCancel={() => setGroupToDelete(null)}
        onConfirm={() => {
          if (groupToDelete) void remove(groupToDelete);
          setGroupToDelete(null);
        }}
        show={groupToDelete !== null}
      />
    </>
  );
}
