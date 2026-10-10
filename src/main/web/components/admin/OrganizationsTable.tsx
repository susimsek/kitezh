"use client";

import Link from "@/routing/Link";
import { useEffect, useState } from "react";
import { Dropdown } from "react-bootstrap";

import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { AdminPageHeader } from "./AdminPageHeader";
import { DataTable } from "./DataTable";
import { ErrorState, LoadingState } from "./AsyncState";
import { PaginationControls } from "./PaginationControls";
import { ResourceFilters } from "./ResourceFilters";
import { RowActions } from "./RowActions";
import { useAdminTableState } from "./useAdminTableState";

type Organization = {
  id: number;
  alias: string;
  name: string;
  displayName?: string | null;
  enabled: boolean;
  memberCount: number;
  domainCount: number;
  groupCount: number;
};

export function OrganizationsTable({ dictionary }: { dictionary: Dictionary }) {
  const { access, accessToken } = useAdminAuth();
  const copy = dictionary.admin.organizations;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { clearFilters, page, query, setPage, setQuery, setSize, setSort, size, sort } =
    useAdminTableState(10, false, "name,asc");

  useEffect(() => {
    if (!accessToken) return;
    // Loading state is synchronized with the organization request lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    adminRequest<PageResponse<Organization>>(accessToken, {
      url: `/api/admin/organizations?q=${encodeURIComponent(query)}&page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`,
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setOrganizations(response.data.content);
        setTotalPages(response.data.totalPages);
        setTotalElements(response.data.totalElements);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accessToken, page, query, size, sort]);

  if (loading) return <LoadingState />;
  return (
    <>
      {error && <ErrorState message={copy.operationError} />}
      <AdminPageHeader
        title={copy.title}
        description={copy.subtitle}
        actions={
          access?.manageOrganizations || access?.isAdmin ? (
            <Link className="btn btn-primary" href="/admin/organizations/new">
              <AdminActionIcon action="add" />
              {copy.create}
            </Link>
          ) : undefined
        }
      />
      <ResourceFilters
        onQueryChange={setQuery}
        query={query}
        searchLabel={copy.search}
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
          query ? [{ label: copy.search, value: query, onRemove: () => setQuery("") }] : []
        }
        clearFiltersLabel={dictionary.admin.resources.clearFilters}
        onClearFilters={clearFilters}
        resultCount={totalElements}
        recordsLabel={dictionary.admin.resources.records}
      />
      <DataTable
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
        isEmpty={organizations.length === 0}
      >
        <thead>
          <tr>
            <th>{copy.name}</th>
            <th>{copy.alias}</th>
            <th>{copy.members}</th>
            <th>{copy.domains}</th>
            <th>{copy.groups}</th>
            <th>{copy.enabled}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {organizations.map((organization) => (
            <tr key={organization.id}>
              <td data-label={copy.name}>
                <Link
                  className="text-decoration-none"
                  href={`/admin/organizations/${organization.id}`}
                >
                  {organization.displayName || organization.name}
                </Link>
              </td>
              <td data-label={copy.alias}>{organization.alias}</td>
              <td data-label={copy.members}>{organization.memberCount}</td>
              <td data-label={copy.domains}>{organization.domainCount}</td>
              <td data-label={copy.groups}>{organization.groupCount}</td>
              <td data-label={copy.enabled}>{organization.enabled ? "✓" : "—"}</td>
              <td className="text-end">
                <RowActions label={`${organization.name} ${dictionary.admin.common.actions}`}>
                  <Dropdown.Item as={Link} href={`/admin/organizations/${organization.id}`}>
                    <AdminActionIcon action="edit" />
                    {copy.settings}
                  </Dropdown.Item>
                </RowActions>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </>
  );
}
