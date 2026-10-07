"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Form, Spinner } from "react-bootstrap";
import Link from "@/routing/Link";

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
import { useAdminTableState } from "./useAdminTableState";

type Organization = {
  id: number;
  alias: string;
  name: string;
  enabled: boolean;
  description?: string | null;
};

export function OrganizationsTable({ dictionary }: { dictionary: Dictionary }) {
  const { access, accessToken } = useAdminAuth();
  const copy = dictionary.admin.organizations;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alias, setAlias] = useState("");
  const [name, setName] = useState("");
  const { clearFilters, page, query, setPage, setQuery, setSize, setSort, size, sort } =
    useAdminTableState(10, false, "alias,asc");

  const load = useCallback(() => {
    if (!accessToken) return;
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

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!access?.manageOrganizations || !accessToken || saving) return;
    setSaving(true);
    try {
      const response = await adminRequest<Organization>(accessToken, {
        url: "/api/admin/organizations",
        method: "POST",
        data: { alias, name, enabled: true, attributes: {} },
      });
      if (response.status >= 300) throw new Error();
      setAlias("");
      setName("");
      setShowCreate(false);
      setError(false);
      load();
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
          access?.manageOrganizations ? (
            <Button className="btn-primary" onClick={() => setShowCreate((current) => !current)}>
              <AdminActionIcon action="add" />
              {copy.create}
            </Button>
          ) : undefined
        }
      />
      {showCreate && access?.manageOrganizations && (
        <Card className="admin-panel-card mb-4">
          <Card.Body>
            <Form onSubmit={create} className="row g-3">
              <Form.Group className="col-md-5" controlId="organization-alias">
                <Form.Label>{copy.alias}</Form.Label>
                <Form.Control
                  value={alias}
                  onChange={(event) => setAlias(event.target.value)}
                  required
                />
              </Form.Group>
              <Form.Group className="col-md-5" controlId="organization-name">
                <Form.Label>{copy.name}</Form.Label>
                <Form.Control
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </Form.Group>
              <div className="col-md-2 d-flex align-items-end">
                <Button type="submit" className="btn-primary w-100" disabled={saving}>
                  {saving ? (
                    <Spinner animation="border" size="sm" aria-hidden="true" />
                  ) : (
                    <AdminActionIcon action="save" />
                  )}
                  <span className="visually-hidden">{copy.create}</span>
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}
      <ResourceFilters
        onQueryChange={setQuery}
        query={query}
        searchLabel={dictionary.admin.resources.search}
        sort={{
          label: dictionary.admin.resources.sort,
          value: sort,
          options: [
            {
              value: "alias,asc",
              label: `${copy.alias} · ${dictionary.admin.resources.ascending}`,
            },
            {
              value: "alias,desc",
              label: `${copy.alias} · ${dictionary.admin.resources.descending}`,
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
      />
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
        isEmpty={organizations.length === 0}
      >
        <thead>
          <tr>
            <th>{copy.alias}</th>
            <th>{copy.name}</th>
            <th>{copy.status}</th>
          </tr>
        </thead>
        <tbody>
          {organizations.map((organization) => (
            <tr key={organization.id}>
              <td data-label={copy.alias}>
                <Link href={`/admin/organizations/${organization.id}/overview`}>
                  {organization.alias}
                </Link>
              </td>
              <td data-label={copy.name}>{organization.name}</td>
              <td data-label={copy.status}>
                {organization.enabled ? copy.enabled : copy.disabled}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </>
  );
}
