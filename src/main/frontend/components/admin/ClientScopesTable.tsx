"use client";

import { useEffect, useState } from "react";
import Link from "@/routing/Link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Dropdown, Form, Modal, Spinner } from "react-bootstrap";
import { useForm } from "@/lib/form";
import { z } from "zod";

import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { AdminPageHeader } from "./AdminPageHeader";
import { ConfirmModal } from "./ConfirmModal";
import { DataTable } from "./DataTable";
import { ErrorState, LoadingState } from "./AsyncState";
import { PaginationControls } from "./PaginationControls";
import { ResourceFilters } from "./ResourceFilters";
import { RowActions } from "./RowActions";
import { useAdminTableState } from "./useAdminTableState";

export type ClientScope = {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  builtIn: boolean;
  createdAt: string;
  updatedAt: string;
};

type Values = { name: string; displayName: string; description: string };

const EMPTY: Values = { name: "", displayName: "", description: "" };

export function ClientScopesTable({ dictionary }: { dictionary: Dictionary }) {
  const copy = dictionary.admin.clientScopes;
  const common = dictionary.admin.common;
  const { access, accessToken } = useAdminAuth();
  const { addAlert, addError } = useConsoleAlerts();
  const [items, setItems] = useState<ClientScope[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<ClientScope | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ClientScope | null>(null);
  const { clearFilters, page, query, setPage, setQuery, setSize, setSort, size, sort } =
    useAdminTableState(10, false, "name,asc");
  const clientScopeSchema = z.object({
    name: z.string().trim().min(1, common.validation.required).max(100, common.validation.max100),
    displayName: z.string().max(200, common.validation.max200),
    description: z.string().max(500, common.validation.max500),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(clientScopeSchema),
    mode: "onChange",
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<PageResponse<ClientScope>>(accessToken, {
      url: `/api/admin/client-scopes?q=${encodeURIComponent(query)}&page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`,
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setItems(response.data.content);
        setTotalPages(response.data.totalPages);
        setTotalElements(response.data.totalElements);
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [accessToken, page, query, reload, size, sort]);

  const openEdit = (scope: ClientScope) => {
    setEditing(scope);
    reset({
      name: scope.name,
      displayName: scope.displayName ?? "",
      description: scope.description ?? "",
    });
    setShowEditor(true);
  };
  const save = async (values: Values) => {
    if (!access?.manageClients || !accessToken) return;
    setSaving(true);
    const response = await adminRequest<ClientScope>(accessToken, {
      url: `/api/admin/client-scopes/${encodeURIComponent(editing?.id ?? "")}`,
      method: "PUT",
      data: values,
    });
    setSaving(false);
    if (response.status >= 300) {
      addError(copy.operationError);
      return;
    }
    setShowEditor(false);
    addAlert(copy.saved);
    setReload((current) => current + 1);
  };
  const remove = async () => {
    if (!access?.manageClients || !accessToken || !deleting) return;
    const response = await adminRequest(accessToken, {
      url: `/api/admin/client-scopes/${encodeURIComponent(deleting.id)}`,
      method: "DELETE",
    });
    setDeleting(null);
    if (response.status >= 300) {
      addError(
        response.status === 400
          ? deleting.builtIn
            ? copy.protectedError
            : copy.assignedDeleteError
          : copy.operationError,
      );
      return;
    }
    addAlert(copy.deleted);
    setReload((current) => current + 1);
  };

  if (loading && items.length === 0) return <LoadingState />;
  if (failed) return <ErrorState message={copy.operationError} />;

  return (
    <>
      <AdminPageHeader
        title={copy.title}
        description={copy.subtitle}
        actions={
          access?.manageClients ? (
            <Link className="btn btn-primary" href="/admin/client-scopes/new">
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
        onQueryChange={(value) => {
          setLoading(true);
          setQuery(value);
        }}
      ></ResourceFilters>
      <DataTable
        isEmpty={items.length === 0}
        emptyMessage={copy.empty}
        footer={
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
            onSizeChange={(nextSize) => {
              setLoading(true);
              setSize(nextSize);
            }}
          />
        }
      >
        <thead>
          <tr>
            <th>{copy.name}</th>
            <th>{copy.displayName}</th>
            <th>{copy.description}</th>
            <th className="admin-actions-column" />
          </tr>
        </thead>
        <tbody>
          {items.map((scope) => (
            <tr key={scope.id}>
              <td className="font-monospace fw-semibold">
                <Link
                  className="text-decoration-none"
                  href={`/admin/client-scopes/${encodeURIComponent(scope.id)}`}
                >
                  {scope.name}
                </Link>
                {scope.builtIn && (
                  <span className="badge text-bg-secondary ms-2">{copy.builtIn}</span>
                )}
              </td>
              <td>{scope.displayName || "—"}</td>
              <td className="text-body-secondary">{scope.description || "—"}</td>
              <td className="text-end">
                {access?.manageClients && (
                  <RowActions label={`${scope.name} ${common.actions}`}>
                    <Dropdown.Item
                      as={Link}
                      href={`/admin/client-scopes/${encodeURIComponent(scope.id)}`}
                    >
                      <AdminActionIcon action="view" />
                      {dictionary.admin.resources.details}
                    </Dropdown.Item>
                    {!scope.builtIn && (
                      <>
                        <Dropdown.Divider />
                        <button
                          className="dropdown-item"
                          type="button"
                          onClick={() => openEdit(scope)}
                        >
                          <AdminActionIcon action="edit" />
                          {copy.edit}
                        </button>
                        <div className="dropdown-divider" />
                        <button
                          className="dropdown-item text-danger"
                          type="button"
                          onClick={() => setDeleting(scope)}
                        >
                          <AdminActionIcon action="delete" />
                          {copy.delete}
                        </button>
                      </>
                    )}
                  </RowActions>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <Modal show={showEditor} onHide={() => setShowEditor(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? copy.edit : copy.create}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form id="client-scope-form" onSubmit={handleSubmit(save)}>
            <Form.Group className="mb-3">
              <Form.Label>{copy.name}</Form.Label>
              <Form.Control autoFocus isInvalid={Boolean(errors.name)} {...register("name")} />
              <Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{copy.displayName}</Form.Label>
              <Form.Control isInvalid={Boolean(errors.displayName)} {...register("displayName")} />
              <Form.Control.Feedback type="invalid">
                {errors.displayName?.message}
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Group>
              <Form.Label>{copy.description}</Form.Label>
              <Form.Control
                as="textarea"
                isInvalid={Boolean(errors.description)}
                rows={3}
                {...register("description")}
              />
              <Form.Control.Feedback type="invalid">
                {errors.description?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditor(false)}>
            <AdminActionIcon action="cancel" />
            {common.cancel}
          </Button>
          <Button disabled={saving} form="client-scope-form" type="submit">
            {saving ? (
              <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
            ) : (
              <AdminActionIcon action="save" />
            )}
            {common.save}
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        show={deleting !== null}
        message={copy.deleteConfirm}
        cancelLabel={common.cancel}
        confirmLabel={copy.delete}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
    </>
  );
}
