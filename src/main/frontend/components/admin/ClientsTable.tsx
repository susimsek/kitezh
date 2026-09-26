"use client";

import { useEffect, useState } from "react";
import { Badge, Dropdown } from "react-bootstrap";
import Link from "@/routing/Link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { PaginationControls } from "./PaginationControls";
import { ResourceFilters } from "./ResourceFilters";
import { DataTable } from "./DataTable";
import { ErrorState, LoadingState } from "./AsyncState";
import { useAdminTableState } from "./useAdminTableState";
import { RowActions } from "./RowActions";
import { AdminPageHeader } from "./AdminPageHeader";

export type AdminClient = {
  id: string;
  clientId: string;
  clientName: string;
  authorizationGrantTypes: string[];
  clientAuthenticationMethods: string[];
  scopes: string[];
  requireAuthorizationConsent: boolean;
  requireProofKey: boolean;
  requireDpop: boolean;
  requireDpopJkt: boolean;
  dpopRefreshTokenOnly: boolean;
  dpopSigningAlgorithms: string[];
};

export function ClientsTable({ dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const { access, accessToken } = useAdminAuth();
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const { clearFilters, page, query, setPage, setQuery, setSize, setSort, size, sort } =
    useAdminTableState(10, false, "clientId,asc");
  useEffect(() => {
    if (!accessToken) return;
    adminRequest<PageResponse<AdminClient>>(accessToken, {
      url: `/api/admin/clients?q=${encodeURIComponent(query)}&page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`,
    })
      .then((r) => {
        if (r.status >= 300) throw new Error();
        setClients(r.data.content);
        setTotalPages(r.data.totalPages);
        setTotalElements(r.data.totalElements);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accessToken, page, query, size, sort]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={dictionary.admin.clients.loadError} />;
  return (
    <>
      <AdminPageHeader
        title={dictionary.admin.clients.title}
        description={dictionary.admin.clients.subtitle}
        actions={
          access?.manageClients ? (
            <Link href="/admin/clients/new" className="btn btn-primary">
              <AdminActionIcon action="add" />
              {dictionary.admin.clients.create}
            </Link>
          ) : undefined
        }
      />
      <ResourceFilters
        query={query}
        searchLabel={dictionary.admin.clients.search}
        sort={{
          label: dictionary.admin.resources.sort,
          value: sort,
          options: [
            {
              value: "clientId,asc",
              label: `${dictionary.admin.clients.clientId} · ${dictionary.admin.resources.ascending}`,
            },
            {
              value: "clientId,desc",
              label: `${dictionary.admin.clients.clientId} · ${dictionary.admin.resources.descending}`,
            },
            {
              value: "clientName,asc",
              label: `${dictionary.admin.clients.clientName} · ${dictionary.admin.resources.ascending}`,
            },
            {
              value: "clientName,desc",
              label: `${dictionary.admin.clients.clientName} · ${dictionary.admin.resources.descending}`,
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
        onQueryChange={(v) => {
          setLoading(true);
          setQuery(v);
        }}
      ></ResourceFilters>
      <DataTable
        isEmpty={clients.length === 0}
        emptyMessage={dictionary.admin.clients.empty}
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
              onPageChange={(p) => {
                setLoading(true);
                setPage(p);
              }}
              onSizeChange={(s) => {
                setLoading(true);
                setSize(s);
              }}
            />
          ) : undefined
        }
      >
        <thead>
          <tr>
            <th>{dictionary.admin.clients.client}</th>
            <th>{dictionary.admin.clients.grants}</th>
            <th>{dictionary.admin.clients.scopes}</th>
            <th>{dictionary.admin.clients.security}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id}>
              <td>
                <Link
                  className="fw-semibold text-decoration-none"
                  href={`/admin/clients/${encodeURIComponent(c.id)}/settings`}
                >
                  {c.clientName}
                </Link>
                <div className="small text-body-secondary font-monospace">{c.clientId}</div>
              </td>
              <td>
                {c.authorizationGrantTypes.map((g) => (
                  <Badge bg="secondary" className="me-1" key={g}>
                    {g}
                  </Badge>
                ))}
              </td>
              <td>
                {c.scopes.slice(0, 4).map((s) => (
                  <Badge bg="secondary" className="me-1" key={s}>
                    {s}
                  </Badge>
                ))}
                {c.scopes.length > 4 && (
                  <span className="small text-body-secondary">+{c.scopes.length - 4}</span>
                )}
              </td>
              <td>
                <Badge bg={c.requireProofKey ? "success" : "secondary"}>
                  PKCE{" "}
                  {c.requireProofKey ? dictionary.admin.common.on : dictionary.admin.common.off}
                </Badge>
                <Badge bg={c.requireDpop ? "success" : "secondary"} className="ms-1">
                  DPoP {c.requireDpop ? dictionary.admin.common.on : dictionary.admin.common.off}
                </Badge>
                {c.requireDpopJkt && (
                  <Badge bg="success" className="ms-1">
                    dpop_jkt {dictionary.admin.common.on}
                  </Badge>
                )}
                {c.dpopRefreshTokenOnly && (
                  <Badge bg="info" className="ms-1">
                    DPoP refresh
                  </Badge>
                )}
                <Badge bg="secondary" className="ms-1">
                  DPoP {(c.dpopSigningAlgorithms ?? ["RS256", "ES256"]).join("/")}
                </Badge>
              </td>
              <td className="text-end">
                <RowActions label={`${c.clientName} ${dictionary.admin.common.actions}`}>
                  <Dropdown.Item
                    as={Link}
                    href={`/admin/clients/${encodeURIComponent(c.id)}/settings`}
                  >
                    <AdminActionIcon action="edit" />
                    {dictionary.admin.clients.edit}
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
