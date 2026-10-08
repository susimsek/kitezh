"use client";

import { useEffect, useState } from "react";
import Link from "@/routing/Link";
import { Badge, Dropdown } from "react-bootstrap";

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

type Role = { name: string; description?: string | null };

export function RolesTable({ dictionary }: { dictionary: Dictionary }) {
  const { access, accessToken } = useAdminAuth();
  const copy = dictionary.admin.roles;
  const [roles, setRoles] = useState<Role[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const { clearFilters, page, query, setPage, setQuery, setSize, setSort, size, sort } =
    useAdminTableState(10, false, "name,asc");

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<PageResponse<Role>>(accessToken, {
      url: `/api/admin/roles?q=${encodeURIComponent(query)}&page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`,
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setRoles(response.data.content);
        setTotalPages(response.data.totalPages);
        setTotalElements(response.data.totalElements);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accessToken, page, query, refresh, size, sort]);

  const deleteRole = async (role: string) => {
    if (!access?.manageRoles || !accessToken) return;
    setSaving(true);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/roles/${encodeURIComponent(role)}`,
        method: "DELETE",
      });
      if (response.status >= 300) throw new Error();
      setLoading(true);
      if (roles.length === 1 && page > 0) {
        setPage(page - 1);
      } else {
        setRefresh((current) => current + 1);
      }
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
          access?.manageRoles ? (
            <Link className="btn btn-primary" href="/admin/roles/new">
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
        isEmpty={roles.length === 0}
      >
        <thead>
          <tr>
            <th>{copy.name}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.name}>
              <td data-label={copy.name}>
                <Link
                  className="text-decoration-none"
                  href={`/admin/roles/${encodeURIComponent(role.name)}`}
                >
                  <span className="font-monospace d-block">{role.name}</span>
                  {role.description && (
                    <span className="small text-body-secondary">{role.description}</span>
                  )}
                </Link>
              </td>
              <td className="text-end">
                <div className="d-inline-flex align-items-center gap-2">
                  {(role.name === "ROLE_ADMIN" || role.name === "ROLE_USER") && (
                    <Badge bg="secondary">{copy.protected}</Badge>
                  )}
                  <RowActions label={`${role.name} ${dictionary.admin.common.actions}`}>
                    <Dropdown.Item as={Link} href={`/admin/roles/${encodeURIComponent(role.name)}`}>
                      <AdminActionIcon action="edit" />
                      {dictionary.admin.resources.edit}
                    </Dropdown.Item>
                    {access?.manageRoles &&
                      role.name !== "ROLE_ADMIN" &&
                      role.name !== "ROLE_USER" && (
                        <>
                          <Dropdown.Divider />
                          <Dropdown.Item
                            className="text-danger"
                            disabled={saving}
                            onClick={() => setRoleToDelete(role.name)}
                          >
                            <AdminActionIcon action="delete" />
                            {copy.delete}
                          </Dropdown.Item>
                        </>
                      )}
                  </RowActions>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <ConfirmModal
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={copy.delete}
        message={copy.deleteConfirm}
        onCancel={() => setRoleToDelete(null)}
        onConfirm={() => {
          if (roleToDelete) void deleteRole(roleToDelete);
          setRoleToDelete(null);
        }}
        show={roleToDelete !== null}
      />
    </>
  );
}
