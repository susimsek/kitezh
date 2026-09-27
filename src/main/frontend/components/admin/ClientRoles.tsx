"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@/lib/form";
import { z } from "zod";
import { Badge, Button, Card, Form, Spinner } from "react-bootstrap";

import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { ConfirmModal } from "./ConfirmModal";
import { DataTable } from "./DataTable";
import { ErrorState, LoadingState } from "./AsyncState";
import { PaginationControls } from "./PaginationControls";
import { useAdminTableState } from "./useAdminTableState";

type ClientRole = { id: number; clientId: string; name: string; description: string | null };
type RoleUser = { id: number; username: string; enabled: boolean };
type RoleGroup = { id: number; name: string; path: string };
type RoleDetail = {
  role: ClientRole;
  users: PageResponse<RoleUser>;
  groups: PageResponse<RoleGroup>;
  userCount: number;
  groupCount: number;
};

export function ClientRoles({
  clientId,
  dictionary,
}: {
  clientId: string;
  dictionary: Dictionary;
}) {
  const copy = dictionary.admin.clients.roles;
  const validation = dictionary.admin.common.validation;
  const { access, accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const [roles, setRoles] = useState<ClientRole[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selected, setSelected] = useState<ClientRole | null>(null);
  const [detail, setDetail] = useState<RoleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<ClientRole | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [suggestions, setSuggestions] = useState<RoleUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<RoleUser | null>(null);
  const [groupQuery, setGroupQuery] = useState("");
  const [groupSuggestions, setGroupSuggestions] = useState<RoleGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<RoleGroup | null>(null);
  const { page, setPage, setSize, size } = useAdminTableState(10, false, "name,asc");
  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(1, validation.required)
      .max(100, validation.max100)
      .regex(/^[A-Za-z0-9._:-]+$/, copy.nameFormat),
    description: z.string().trim().max(500, validation.max500),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { name: "", description: "" },
  });

  const loadRoles = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await adminRequest<PageResponse<ClientRole>>(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/roles?page=${page}&size=${size}&sort=name,asc`,
      });
      if (response.status >= 300) throw new Error();
      setRoles(response.data.content);
      setTotalElements(response.data.totalElements);
      setTotalPages(response.data.totalPages);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken, clientId, page, size]);

  const loadDetail = async (role: ClientRole) => {
    if (!accessToken) return;
    setDetailLoading(true);
    try {
      const response = await adminRequest<RoleDetail>(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${role.id}?page=0&size=10&sort=username,asc`,
      });
      if (response.status >= 300) {
        alerts.addError(copy.operationError);
        return;
      }
      setSelected(role);
      setDetail(response.data);
      reset({ name: role.name, description: role.description ?? "" });
      setShowForm(false);
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadRoles(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadRoles]);

  useEffect(() => {
    if (!accessToken || !selected || userQuery.trim().length < 2) {
      const timeout = window.setTimeout(() => setSuggestions([]), 0);
      return () => window.clearTimeout(timeout);
    }
    const timeout = window.setTimeout(() => {
      adminRequest<PageResponse<RoleUser>>(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${selected.id}/available-users?q=${encodeURIComponent(userQuery.trim())}&page=0&size=10`,
      })
        .then((response) => setSuggestions(response.status < 300 ? response.data.content : []))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [accessToken, clientId, selected, userQuery]);

  useEffect(() => {
    if (!accessToken || !selected || groupQuery.trim().length < 2) {
      const timeout = window.setTimeout(() => setGroupSuggestions([]), 0);
      return () => window.clearTimeout(timeout);
    }
    const timeout = window.setTimeout(() => {
      adminRequest<PageResponse<RoleGroup>>(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${selected.id}/available-groups?q=${encodeURIComponent(groupQuery.trim())}&page=0&size=10`,
      })
        .then((response) => setGroupSuggestions(response.status < 300 ? response.data.content : []))
        .catch(() => setGroupSuggestions([]));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [accessToken, clientId, groupQuery, selected]);

  const saveRole = async (values: z.infer<typeof schema>) => {
    if (!access?.manageClients || !accessToken) return;
    setSaving(true);
    try {
      const response = await adminRequest<ClientRole>(accessToken, {
        url: selected
          ? `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${selected.id}`
          : `/api/admin/clients/${encodeURIComponent(clientId)}/roles`,
        method: selected ? "PUT" : "POST",
        data: { name: values.name, description: values.description || null },
      });
      if (response.status >= 300) throw new Error();
      alerts.addAlert(copy.saved);
      setShowForm(false);
      setSelected(response.data);
      await loadRoles();
      await loadDetail(response.data);
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async () => {
    if (!access?.manageClients || !accessToken || !roleToDelete) return;
    setSaving(true);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${roleToDelete.id}`,
        method: "DELETE",
      });
      if (response.status >= 300) throw new Error();
      setRoleToDelete(null);
      setSelected(null);
      setDetail(null);
      alerts.addAlert(copy.deleted);
      await loadRoles();
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setSaving(false);
    }
  };

  const assign = async () => {
    if (!access?.manageClients || !accessToken || !selected || !selectedUser) return;
    setSaving(true);
    try {
      const response = await adminRequest<RoleDetail>(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${selected.id}/users`,
        method: "POST",
        data: { userId: selectedUser.id },
      });
      if (response.status >= 300) throw new Error();
      setDetail(response.data);
      setSelectedUser(null);
      setUserQuery("");
      setSuggestions([]);
      alerts.addAlert(copy.assignmentSaved);
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (user: RoleUser) => {
    if (!access?.manageClients || !accessToken || !selected) return;
    setSaving(true);
    try {
      const response = await adminRequest<RoleDetail>(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${selected.id}/users/${user.id}?page=0&size=10&sort=username,asc`,
        method: "DELETE",
      });
      if (response.status >= 300) throw new Error();
      setDetail(response.data);
      alerts.addAlert(copy.assignmentRemoved);
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setSaving(false);
    }
  };

  const assignGroup = async () => {
    if (!access?.manageClients || !accessToken || !selected || !selectedGroup) return;
    setSaving(true);
    try {
      const response = await adminRequest<RoleDetail>(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${selected.id}/groups/${selectedGroup.id}`,
        method: "POST",
      });
      if (response.status >= 300) throw new Error();
      setDetail(response.data);
      setSelectedGroup(null);
      setGroupQuery("");
      setGroupSuggestions([]);
      alerts.addAlert(copy.groupAssignmentSaved);
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setSaving(false);
    }
  };

  const removeGroup = async (group: RoleGroup) => {
    if (!access?.manageClients || !accessToken || !selected) return;
    setSaving(true);
    try {
      const response = await adminRequest<RoleDetail>(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${selected.id}/groups/${group.id}?page=0&size=10&sort=username,asc`,
        method: "DELETE",
      });
      if (response.status >= 300) throw new Error();
      setDetail(response.data);
      alerts.addAlert(copy.groupAssignmentRemoved);
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setSaving(false);
    }
  };

  if (loading && roles.length === 0) return <LoadingState />;
  if (error) return <ErrorState message={copy.operationError} />;

  return (
    <div className="d-grid gap-4">
      <div className="admin-detail-heading">
        <div>
          <h2 className="h5 mb-1">{copy.title}</h2>
          <p className="small text-body-secondary mb-0">{copy.subtitle}</p>
        </div>
        {access?.manageClients && (
          <Button
            variant="primary"
            onClick={() => {
              setSelected(null);
              setDetail(null);
              reset({ name: "", description: "" });
              setShowForm(true);
            }}
          >
            <AdminActionIcon action="add" />
            {copy.create}
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="admin-panel-card">
          <Card.Body>
            <Form noValidate onSubmit={handleSubmit(saveRole)}>
              <Form.Group className="mb-3" controlId="client-role-name">
                <Form.Label>{copy.name}</Form.Label>
                <Form.Control
                  disabled={!access?.manageClients}
                  isInvalid={Boolean(errors.name)}
                  {...register("name")}
                />
                <Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback>
              </Form.Group>
              <Form.Group className="mb-3" controlId="client-role-description">
                <Form.Label>{copy.description}</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  disabled={!access?.manageClients}
                  isInvalid={Boolean(errors.description)}
                  {...register("description")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.description?.message}
                </Form.Control.Feedback>
              </Form.Group>
              <div className="admin-form-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => setShowForm(false)}
                >
                  {dictionary.admin.common.cancel}
                </Button>
                <Button type="submit" disabled={!access?.manageClients || saving}>
                  {saving ? (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  ) : (
                    <AdminActionIcon action="save" />
                  )}
                  {dictionary.admin.common.save}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}

      <DataTable
        emptyMessage={copy.empty}
        isEmpty={roles.length === 0}
        footer={
          roles.length > 0 ? (
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
            <th>{copy.name}</th>
            <th>{copy.description}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.id}>
              <td data-label={copy.name}>
                <button
                  className="btn btn-link p-0 text-decoration-none font-monospace"
                  disabled={detailLoading}
                  type="button"
                  onClick={() => void loadDetail(role)}
                >
                  {detailLoading && (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  )}
                  {role.name}
                </button>
              </td>
              <td data-label={copy.description}>{role.description || "—"}</td>
              <td className="text-end">
                <div className="d-inline-flex gap-2">
                  {access?.manageClients && (
                    <>
                      <Button
                        disabled={detailLoading}
                        size="sm"
                        variant="secondary"
                        onClick={() => void loadDetail(role)}
                      >
                        {detailLoading ? (
                          <Spinner
                            animation="border"
                            aria-hidden="true"
                            className="me-2"
                            size="sm"
                          />
                        ) : (
                          <AdminActionIcon action="edit" />
                        )}
                        {copy.edit}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={saving}
                        onClick={() => setRoleToDelete(role)}
                      >
                        <AdminActionIcon action="delete" />
                        {copy.delete}
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      {detail && selected && (
        <Card className="admin-panel-card">
          <Card.Body>
            <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
              <div>
                <h3 className="h5 mb-1 font-monospace">{detail.role.name}</h3>
                <div className="small text-body-secondary">
                  {detail.userCount} {copy.assignedUsers} · {detail.groupCount}{" "}
                  {copy.assignedGroups}
                </div>
              </div>
              <Button
                variant="secondary"
                disabled={!access?.manageClients}
                onClick={() => setShowForm(true)}
              >
                <AdminActionIcon action="edit" />
                {copy.edit}
              </Button>
            </div>
            {access?.manageClients && (
              <div className="mb-4 position-relative">
                <Form.Label htmlFor="client-role-user-search">{copy.assignUser}</Form.Label>
                <Form.Control
                  id="client-role-user-search"
                  value={selectedUser?.username ?? userQuery}
                  placeholder={copy.searchUsersPlaceholder}
                  onChange={(event) => {
                    setSelectedUser(null);
                    setUserQuery(event.target.value);
                  }}
                />
                {suggestions.length > 0 && !selectedUser && (
                  <div className="list-group position-absolute w-100 z-1">
                    {suggestions.map((user) => (
                      <button
                        className="list-group-item list-group-item-action"
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedUser(user);
                          setSuggestions([]);
                        }}
                      >
                        {user.username}
                      </button>
                    ))}
                  </div>
                )}
                <Button
                  className="mt-2"
                  variant="primary"
                  disabled={!selectedUser || saving}
                  onClick={() => void assign()}
                >
                  {saving ? (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  ) : (
                    <AdminActionIcon action="add" />
                  )}
                  {copy.assign}
                </Button>
              </div>
            )}
            {access?.manageClients && (
              <div className="mb-4 position-relative">
                <Form.Label htmlFor="client-role-group-search">{copy.assignGroup}</Form.Label>
                <Form.Control
                  id="client-role-group-search"
                  value={selectedGroup?.path ?? groupQuery}
                  placeholder={copy.searchGroupsPlaceholder}
                  onChange={(event) => {
                    setSelectedGroup(null);
                    setGroupQuery(event.target.value);
                  }}
                />
                {groupSuggestions.length > 0 && !selectedGroup && (
                  <div className="list-group position-absolute w-100 z-1">
                    {groupSuggestions.map((group) => (
                      <button
                        className="list-group-item list-group-item-action"
                        key={group.id}
                        type="button"
                        onClick={() => {
                          setSelectedGroup(group);
                          setGroupSuggestions([]);
                        }}
                      >
                        {group.path}
                      </button>
                    ))}
                  </div>
                )}
                <Button
                  className="mt-2"
                  variant="primary"
                  disabled={!selectedGroup || saving}
                  onClick={() => void assignGroup()}
                >
                  {saving ? (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  ) : (
                    <AdminActionIcon action="add" />
                  )}
                  {copy.assign}
                </Button>
              </div>
            )}
            <h4 className="h6">{copy.usersInRole}</h4>
            {detail.users.content.length === 0 ? (
              <div className="text-body-secondary small">{copy.noAssignedUsers}</div>
            ) : (
              <div className="d-grid gap-2">
                {detail.users.content.map((user) => (
                  <div
                    className="d-flex justify-content-between align-items-center border rounded p-2"
                    key={user.id}
                  >
                    <span>{user.username}</span>
                    {access?.manageClients && (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={saving}
                        onClick={() => void remove(user)}
                      >
                        {saving ? (
                          <Spinner
                            animation="border"
                            aria-hidden="true"
                            className="me-2"
                            size="sm"
                          />
                        ) : (
                          <AdminActionIcon action="remove" />
                        )}
                        {copy.remove}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <h4 className="h6 mt-4">{copy.groupsInRole}</h4>
            {detail.groups.content.length === 0 ? (
              <div className="text-body-secondary small">{copy.noAssignedGroups}</div>
            ) : (
              <div className="d-grid gap-2">
                {detail.groups.content.map((group) => (
                  <div
                    className="d-flex justify-content-between align-items-center border rounded p-2"
                    key={group.id}
                  >
                    <span>{group.path}</span>
                    {access?.manageClients && (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={saving}
                        onClick={() => void removeGroup(group)}
                      >
                        {saving ? (
                          <Spinner
                            animation="border"
                            aria-hidden="true"
                            className="me-2"
                            size="sm"
                          />
                        ) : (
                          <AdminActionIcon action="remove" />
                        )}
                        {copy.remove}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Badge className="mt-3" bg="secondary">
              {copy.scopeHelp}
            </Badge>
          </Card.Body>
        </Card>
      )}

      <ConfirmModal
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={copy.delete}
        message={copy.deleteConfirm}
        busy={saving}
        onCancel={() => setRoleToDelete(null)}
        onConfirm={() => void deleteRole()}
        show={roleToDelete !== null}
      />
    </div>
  );
}
