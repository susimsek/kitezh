"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Dropdown, Form, Modal, Spinner } from "react-bootstrap";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { PageResponse } from "@/lib/api-types";
import { adminRequest } from "@/lib/admin-api";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { AdminBreadcrumb } from "./AdminBreadcrumb";
import { DetailTabs } from "./DetailTabs";
import { DataTable } from "./DataTable";
import { ConfirmModal } from "./ConfirmModal";
import { ErrorState, LoadingState } from "./AsyncState";
import { IdentityProviderForm, type IdentityProviderFormData } from "./IdentityProviderForm";
import { PaginationControls } from "./PaginationControls";
import { ResourceFilters } from "./ResourceFilters";
import { RowActions } from "./RowActions";
import { useAdminTableState } from "./useAdminTableState";

type Provider = IdentityProviderFormData & { id: string; mapperCount: number };
type Mapper = {
  id: string;
  providerAlias: string;
  name: string;
  sourceClaim: string;
  target: string;
  mapperType: string;
  syncMode: string;
  addToIdToken: boolean;
  addToAccessToken: boolean;
};
export function IdentityProviderDetail({
  dictionary,
  id,
  tab,
}: {
  dictionary: Dictionary;
  locale: string;
  id: string;
  tab: "details" | "mappers";
}) {
  const { accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const copy = dictionary.admin.identityProviders;
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showMapper, setShowMapper] = useState(false);
  const [mapper, setMapper] = useState<Mapper | null>(null);
  const [mapperSaving, setMapperSaving] = useState(false);
  const [mapperToDelete, setMapperToDelete] = useState<Mapper | null>(null);
  const { page, query, setPage, setQuery, setSize, setSort, size, sort, clearFilters } =
    useAdminTableState(10, false, "name,asc");
  const [mappers, setMappers] = useState<PageResponse<Mapper> | null>(null);
  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    adminRequest<Provider>(accessToken, { url: `/api/admin/identity-providers/${id}` })
      .then((r) => {
        if (r.status >= 300) throw new Error();
        setProvider(r.data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accessToken, id]);
  const loadMappers = useCallback(() => {
    if (!accessToken || tab !== "mappers") return;
    adminRequest<PageResponse<Mapper>>(accessToken, {
      url: `/api/admin/identity-providers/${id}/mappers?q=${encodeURIComponent(query)}&page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`,
    })
      .then((r) => {
        if (r.status >= 300) throw new Error();
        setMappers(r.data);
      })
      .catch(() => setMappers(null));
  }, [accessToken, id, page, query, size, sort, tab]);
  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(loadMappers, 0);
    return () => window.clearTimeout(timer);
  }, [loadMappers]);
  const formInitial = useMemo<Partial<IdentityProviderFormData>>(
    () => (provider ? { ...provider, clientSecret: "" } : {}),
    [provider],
  );
  if (loading) return <LoadingState />;
  if (error || !provider) return <ErrorState message={copy.notFound} />;
  const deleteMapper = async (row: Mapper) => {
    if (!accessToken) return;
    const response = await adminRequest(accessToken, {
      url: `/api/admin/identity-providers/${id}/mappers/${row.id}`,
      method: "DELETE",
    });
    if (response.status >= 300) {
      alerts.addError(copy.mapperError);
      return;
    }
    alerts.addAlert(copy.deleted);
    loadMappers();
  };
  const saveMapper = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) return;
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    setMapperSaving(true);
    try {
      const response = await adminRequest(accessToken, {
        url: mapper
          ? `/api/admin/identity-providers/${id}/mappers/${mapper.id}`
          : `/api/admin/identity-providers/${id}/mappers`,
        method: mapper ? "PUT" : "POST",
        data: {
          ...data,
          addToIdToken: data.addToIdToken === "on",
          addToAccessToken: data.addToAccessToken === "on",
        },
      });
      if (response.status >= 300) throw new Error();
      alerts.addAlert(mapper ? copy.mapperSaved : copy.mapperCreated);
      setShowMapper(false);
      loadMappers();
    } catch {
      alerts.addError(copy.mapperError);
    } finally {
      setMapperSaving(false);
    }
  };
  return (
    <div className="d-grid gap-3">
      <AdminBreadcrumb
        items={[
          { label: dictionary.admin.nav.identityProviders, href: "/admin/identity-providers" },
          { label: provider.displayName },
        ]}
      />
      <DetailTabs
        tabs={[
          { key: "details", label: copy.details, href: `/admin/identity-providers/${id}/details` },
          { key: "mappers", label: copy.mappers, href: `/admin/identity-providers/${id}/mappers` },
        ]}
        active={tab}
      />
      <Card className="admin-panel-card">
        <Card.Body>
          {tab === "details" ? (
            <IdentityProviderForm dictionary={dictionary} id={id} initial={formInitial} />
          ) : (
            <>
              <div className="admin-detail-heading mb-3">
                <div>
                  <h2 className="h5 mb-1">{copy.mappers}</h2>
                </div>
                <Button
                  onClick={() => {
                    setMapper(null);
                    setShowMapper(true);
                  }}
                >
                  <AdminActionIcon action="add" />
                  {copy.createMapper}
                </Button>
              </div>
              <ResourceFilters
                query={query}
                searchLabel={copy.mapperSearch}
                sort={{
                  label: dictionary.admin.resources.sort,
                  value: sort,
                  options: [
                    {
                      value: "name,asc",
                      label: `${copy.mapperName} · ${dictionary.admin.resources.ascending}`,
                    },
                    {
                      value: "sourceClaim,asc",
                      label: `${copy.sourceClaim} · ${dictionary.admin.resources.ascending}`,
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
                resultCount={mappers?.totalElements ?? 0}
                recordsLabel={dictionary.admin.resources.records}
                onQueryChange={setQuery}
              />
              <DataTable
                isEmpty={!mappers?.content.length}
                emptyMessage={copy.mapperEmpty}
                footer={
                  mappers && mappers.totalElements > 0 ? (
                    <PaginationControls
                      page={page}
                      totalPages={mappers.totalPages}
                      totalElements={mappers.totalElements}
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
                    <th>{copy.mapperName}</th>
                    <th>{copy.sourceClaim}</th>
                    <th>{copy.target}</th>
                    <th>{copy.mapperType}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {mappers?.content.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.sourceClaim}</td>
                      <td>{row.target}</td>
                      <td>
                        <Badge bg="secondary">{row.mapperType}</Badge>
                      </td>
                      <td className="text-end">
                        <RowActions label={row.name}>
                          <Dropdown.Item
                            onClick={() => {
                              setMapper(row);
                              setShowMapper(true);
                            }}
                          >
                            <AdminActionIcon action="edit" />
                            {"Edit"}
                          </Dropdown.Item>
                          <Dropdown.Item onClick={() => setMapperToDelete(row)}>
                            <AdminActionIcon action="delete" />
                            {"Delete"}
                          </Dropdown.Item>
                        </RowActions>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </>
          )}
        </Card.Body>
      </Card>
      <Modal show={showMapper} onHide={() => setShowMapper(false)}>
        <Form onSubmit={saveMapper}>
          <Modal.Header closeButton>
            <Modal.Title>{mapper ? copy.editMapper : copy.createMapper}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{copy.mapperName}</Form.Label>
              <Form.Control name="name" required defaultValue={mapper?.name ?? ""} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{copy.sourceClaim}</Form.Label>
              <Form.Control name="sourceClaim" required defaultValue={mapper?.sourceClaim ?? ""} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{copy.target}</Form.Label>
              <Form.Control name="target" required defaultValue={mapper?.target ?? ""} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{copy.mapperType}</Form.Label>
              <Form.Select name="mapperType" defaultValue={mapper?.mapperType ?? "user-attribute"}>
                <option value="user-attribute">user-attribute</option>
                <option value="claim">claim</option>
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>{copy.syncMode}</Form.Label>
              <Form.Select name="syncMode" defaultValue={mapper?.syncMode ?? "inherit"}>
                <option value="inherit">inherit</option>
                <option value="legacy">legacy</option>
                <option value="import">import</option>
                <option value="read_only">read_only</option>
                <option value="force">force</option>
              </Form.Select>
            </Form.Group>
            <Form.Check
              className="mt-3"
              name="addToIdToken"
              label={copy.addToIdToken}
              defaultChecked={mapper?.addToIdToken}
            />
            <Form.Check
              name="addToAccessToken"
              label={copy.addToAccessToken}
              defaultChecked={mapper?.addToAccessToken}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowMapper(false)}>
              {dictionary.admin.common.cancel}
            </Button>
            <Button type="submit" disabled={mapperSaving}>
              {mapperSaving ? <Spinner animation="border" size="sm" className="me-2" /> : null}
              {dictionary.admin.common.save}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <ConfirmModal
        show={mapperToDelete !== null}
        message={copy.deleteConfirm}
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={"Delete"}
        onCancel={() => setMapperToDelete(null)}
        onConfirm={() => {
          if (mapperToDelete) void deleteMapper(mapperToDelete);
          setMapperToDelete(null);
        }}
      />
    </div>
  );
}
