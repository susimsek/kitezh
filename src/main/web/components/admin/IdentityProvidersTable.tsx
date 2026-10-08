"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Dropdown } from "react-bootstrap";
import Link from "@/routing/Link";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { Icon } from "@/components/shared/Icon";
import { providerIcon } from "@/lib/provider-icons";
import { DataTable } from "./DataTable";
import { ConfirmModal } from "./ConfirmModal";
import { ErrorState, LoadingState } from "./AsyncState";
import { PaginationControls } from "./PaginationControls";
import { ResourceFilters } from "./ResourceFilters";
import { RowActions } from "./RowActions";
import { useAdminTableState } from "./useAdminTableState";
import { AdminPageHeader } from "./AdminPageHeader";

export type IdentityProvider = {
  id: string;
  registrationId: string;
  providerType: string;
  displayName: string;
  alias: string;
  iconKey: string;
  enabled: boolean;
  configured: boolean;
  hideOnLogin: boolean;
  mapperCount: number;
};

export function IdentityProvidersTable({ dictionary }: { dictionary: Dictionary }) {
  const { access, accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const copy = dictionary.admin.identityProviders;
  const [rows, setRows] = useState<IdentityProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [providerToDelete, setProviderToDelete] = useState<IdentityProvider | null>(null);
  const { clearFilters, page, query, setPage, setQuery, setSize, setSort, size, sort } =
    useAdminTableState(10, false, "guiOrder,asc");
  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    adminRequest<PageResponse<IdentityProvider>>(accessToken, {
      url: `/api/admin/identity-providers?q=${encodeURIComponent(query)}&page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`,
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setRows(response.data.content);
        setTotalPages(response.data.totalPages);
        setTotalElements(response.data.totalElements);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accessToken, page, query, size, sort]);
  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const remove = async (row: IdentityProvider) => {
    if (!accessToken) return;
    const response = await adminRequest(accessToken, {
      url: `/api/admin/identity-providers/${row.id}`,
      method: "DELETE",
    });
    if (response.status >= 300) {
      alerts.addError(copy.deleteError);
      return;
    }
    alerts.addAlert(copy.deleted);
    load();
  };
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={copy.loadError} />;
  return (
    <>
      <AdminPageHeader
        title={copy.title}
        description={copy.subtitle}
        actions={
          access?.isAdmin ? (
            <Link href="/admin/identity-providers/new" className="btn btn-primary">
              <AdminActionIcon action="add" />
              {copy.create}
            </Link>
          ) : undefined
        }
      />
      <ResourceFilters
        query={query}
        searchLabel={copy.search}
        sort={{
          label: dictionary.admin.resources.sort,
          value: sort,
          options: [
            {
              value: "guiOrder,asc",
              label: `${copy.order} · ${dictionary.admin.resources.ascending}`,
            },
            {
              value: "displayName,asc",
              label: `${copy.name} · ${dictionary.admin.resources.ascending}`,
            },
            {
              value: "displayName,desc",
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
        onQueryChange={(value) => {
          setLoading(true);
          setQuery(value);
        }}
      ></ResourceFilters>
      <DataTable
        isEmpty={!rows.length}
        emptyMessage={copy.empty}
        footer={
          totalElements > 0 ? (
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
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
          ) : undefined
        }
      >
        <thead>
          <tr>
            <th>{copy.name}</th>
            <th>{copy.type}</th>
            <th>{copy.status}</th>
            <th>{copy.mappers}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link
                  href={`/admin/identity-providers/${row.id}/details`}
                  className="fw-semibold text-decoration-none"
                >
                  <span className="d-inline-flex align-items-center gap-2">
                    <Icon icon={providerIcon(row.iconKey)} />
                    {row.displayName}
                  </span>
                </Link>
                <div className="small text-body-secondary font-monospace">{row.alias}</div>
              </td>
              <td>{row.providerType}</td>
              <td>
                <Badge bg={row.enabled ? "success" : "secondary"}>
                  {row.enabled ? copy.enabled : copy.disabled}
                </Badge>
                {row.configured && (
                  <Badge bg="info" className="ms-1">
                    {copy.configured}
                  </Badge>
                )}
              </td>
              <td>{row.mapperCount}</td>
              <td className="text-end">
                <RowActions label={`${row.displayName} ${dictionary.admin.common.actions}`}>
                  <Dropdown.Item as={Link} href={`/admin/identity-providers/${row.id}/details`}>
                    <AdminActionIcon action="edit" />
                    {"Edit"}
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => setProviderToDelete(row)}>
                    <AdminActionIcon action="delete" />
                    {"Delete"}
                  </Dropdown.Item>
                </RowActions>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <ConfirmModal
        show={providerToDelete !== null}
        message={copy.deleteConfirm}
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={"Delete"}
        onCancel={() => setProviderToDelete(null)}
        onConfirm={() => {
          if (providerToDelete) void remove(providerToDelete);
          setProviderToDelete(null);
        }}
      />
    </>
  );
}
