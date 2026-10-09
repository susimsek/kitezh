"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Form, ListGroup, Spinner } from "react-bootstrap";
import { useRouter } from "@/routing/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@/lib/form";
import { z } from "zod";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { AdminBreadcrumb } from "./AdminBreadcrumb";
import { DataTable } from "./DataTable";
import { DetailTabs } from "./DetailTabs";
import { ErrorState, LoadingState } from "./AsyncState";
import { PaginationControls } from "./PaginationControls";
import { ResourceFilters } from "./ResourceFilters";
import { useAdminTableState } from "./useAdminTableState";

type RoleUser = { id: number; username: string; enabled: boolean };
type RoleSummary = { name: string; description?: string | null };
type ClientRoleSummary = {
  id: number;
  clientId: string;
  name: string;
  description?: string | null;
};
export type RoleDetailTab = "details" | "users";
type RoleDetailData = {
  name: string;
  description?: string | null;
  userCount: number;
  protectedRole: boolean;
  users: PageResponse<RoleUser>;
  compositeRoles?: string[];
  compositeClientRoles?: ClientRoleSummary[];
};

export function RoleDetail({
  dictionary,
  name,
  tab,
}: {
  locale: Locale;
  dictionary: Dictionary;
  name: string;
  tab?: RoleDetailTab;
}) {
  const { access, accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const router = useRouter();
  const actualName = name;
  const activeTab = tab ?? "details";
  const [detail, setDetail] = useState<RoleDetailData | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [suggestions, setSuggestions] = useState<RoleUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<RoleUser | null>(null);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [compositeQuery, setCompositeQuery] = useState("");
  const [compositeSuggestions, setCompositeSuggestions] = useState<RoleSummary[]>([]);
  const [selectedComposite, setSelectedComposite] = useState<RoleSummary | null>(null);
  const [clientCompositeQuery, setClientCompositeQuery] = useState("");
  const [clientCompositeSuggestions, setClientCompositeSuggestions] = useState<ClientRoleSummary[]>(
    [],
  );
  const [selectedClientComposite, setSelectedClientComposite] = useState<ClientRoleSummary | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const {
    clearFilters,
    page,
    query,
    setPage,
    setQuery,
    setSize,
    setSort,
    setStatus,
    size,
    sort,
    status,
  } = useAdminTableState(10, true, "username,asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const descriptionSchema = z.object({
    description: z.string().trim().max(500, dictionary.admin.common.validation.max500),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: descriptionErrors, isSubmitting: descriptionSaving },
  } = useForm<z.infer<typeof descriptionSchema>>({
    resolver: zodResolver(descriptionSchema),
    mode: "onChange",
    defaultValues: { description: "" },
  });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const roleResponse = await adminRequest<RoleDetailData>(accessToken, {
        url: `/api/admin/roles/${encodeURIComponent(actualName)}?q=${encodeURIComponent(query)}&enabled=${encodeURIComponent(status)}&page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`,
      });
      if (roleResponse.status >= 300) throw new Error();
      setDetail(roleResponse.data);
      reset({ description: roleResponse.data.description ?? "" });
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken, actualName, page, query, reset, size, sort, status]);

  const saveDescription = async ({ description }: z.infer<typeof descriptionSchema>) => {
    if (!access?.manageRoles || !accessToken || !detail) return;
    try {
      const response = await adminRequest<RoleDetailData>(accessToken, {
        url: `/api/admin/roles/${encodeURIComponent(actualName)}`,
        method: "PUT",
        data: { name: detail.name, description: description || null },
      });
      if (response.status >= 300) throw new Error();
      setDetail((current) =>
        current ? { ...current, description: response.data.description } : current,
      );
      alerts.addAlert(dictionary.admin.roles.descriptionSaved);
    } catch {
      alerts.addError(dictionary.admin.roles.descriptionSaveError);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    if (!accessToken || userQuery.trim().length < 2 || selectedUser) {
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSearchingUsers(true);
      adminRequest<PageResponse<RoleUser>>(accessToken, {
        url: `/api/admin/roles/${encodeURIComponent(actualName)}/available-users?q=${encodeURIComponent(userQuery.trim())}&page=0&size=10`,
        signal: controller.signal,
      })
        .then((response) => {
          if (response.status < 300) setSuggestions(response.data.content);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setSearchingUsers(false));
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [accessToken, actualName, selectedUser, userQuery]);

  useEffect(() => {
    if (!accessToken || compositeQuery.trim().length < 2 || selectedComposite) {
      const timeout = window.setTimeout(() => setCompositeSuggestions([]), 0);
      return () => window.clearTimeout(timeout);
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      adminRequest<PageResponse<RoleSummary>>(accessToken, {
        url: `/api/admin/roles/${encodeURIComponent(actualName)}/available-composites?q=${encodeURIComponent(compositeQuery.trim())}&page=0&size=10&sort=name,asc`,
        signal: controller.signal,
      })
        .then((response) =>
          setCompositeSuggestions(response.status < 300 ? response.data.content : []),
        )
        .catch(() => setCompositeSuggestions([]));
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [accessToken, actualName, compositeQuery, selectedComposite]);

  useEffect(() => {
    if (!accessToken || clientCompositeQuery.trim().length < 2 || selectedClientComposite) {
      const timeout = window.setTimeout(() => setClientCompositeSuggestions([]), 0);
      return () => window.clearTimeout(timeout);
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      adminRequest<PageResponse<ClientRoleSummary>>(accessToken, {
        url: `/api/admin/roles/${encodeURIComponent(actualName)}/available-client-composites?q=${encodeURIComponent(clientCompositeQuery.trim())}&page=0&size=10&sort=name,asc`,
        signal: controller.signal,
      })
        .then((response) =>
          setClientCompositeSuggestions(response.status < 300 ? response.data.content : []),
        )
        .catch(() => setClientCompositeSuggestions([]));
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [accessToken, actualName, clientCompositeQuery, selectedClientComposite]);

  const assign = async () => {
    if (!access?.manageRoles || !accessToken || !selectedUser) return;
    setSaving(true);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/roles/${encodeURIComponent(actualName)}/users`,
        method: "POST",
        data: { userId: selectedUser.id },
      });
      if (response.status >= 300) {
        alerts.addError(dictionary.admin.roles.assignmentSaveError);
        return;
      }
      alerts.addAlert(dictionary.admin.roles.assignmentSaved);
      setSelectedUser(null);
      setUserQuery("");
      setSuggestions([]);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (user: RoleUser) => {
    if (!access?.manageRoles || !accessToken) return;
    setSaving(true);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/roles/${encodeURIComponent(actualName)}/users/${user.id}?page=${page}&size=${size}`,
        method: "DELETE",
      });
      if (response.status >= 300) {
        alerts.addError(dictionary.admin.roles.assignmentRemoveError);
        return;
      }
      alerts.addAlert(dictionary.admin.roles.assignmentRemoved);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const updateComposite = async (composite: RoleSummary, method: "POST" | "DELETE") => {
    if (!access?.manageRoles || !accessToken) return;
    setSaving(true);
    try {
      const response = await adminRequest<RoleDetailData>(accessToken, {
        url: `/api/admin/roles/${encodeURIComponent(actualName)}/composites/${encodeURIComponent(composite.name)}?page=0&size=${size}&sort=${encodeURIComponent(sort)}`,
        method,
      });
      if (response.status >= 300) throw new Error();
      setDetail(response.data);
      setSelectedComposite(null);
      setCompositeQuery("");
      setCompositeSuggestions([]);
      alerts.addAlert(
        method === "POST"
          ? dictionary.admin.roles.compositeSaved
          : dictionary.admin.roles.compositeRemoved,
      );
    } catch {
      alerts.addError(dictionary.admin.roles.operationError);
    } finally {
      setSaving(false);
    }
  };

  const updateClientComposite = async (composite: ClientRoleSummary, method: "POST" | "DELETE") => {
    if (!access?.manageRoles || !accessToken) return;
    setSaving(true);
    try {
      const response = await adminRequest<RoleDetailData>(accessToken, {
        url: `/api/admin/roles/${encodeURIComponent(actualName)}/client-composites/${composite.id}?page=0&size=${size}&sort=${encodeURIComponent(sort)}`,
        method,
      });
      if (response.status >= 300) throw new Error();
      setDetail(response.data);
      setSelectedClientComposite(null);
      setClientCompositeQuery("");
      setClientCompositeSuggestions([]);
      alerts.addAlert(
        method === "POST"
          ? dictionary.admin.roles.compositeSaved
          : dictionary.admin.roles.compositeRemoved,
      );
    } catch {
      alerts.addError(dictionary.admin.roles.operationError);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !detail) return <LoadingState />;
  if (error || !detail) return <ErrorState message={dictionary.admin.roles.operationError} />;

  return (
    <div className="d-grid gap-4">
      <AdminBreadcrumb
        items={[
          { label: dictionary.admin.roles.title, href: `/admin/roles` },
          { label: detail.name },
        ]}
      />

      <div className="admin-detail-heading">
        <div>
          <h1 className="h3 mb-1 font-monospace">{detail.name}</h1>
          <div className="text-body-secondary">
            {detail.userCount} {dictionary.admin.roles.assignedUsers}
          </div>
        </div>
        {detail.protectedRole && <Badge bg="secondary">{dictionary.admin.roles.protected}</Badge>}
      </div>

      <DetailTabs
        active={activeTab}
        tabs={[
          {
            key: "details",
            label: dictionary.admin.roles.details,
            href: `/admin/roles/${encodeURIComponent(detail.name)}/details`,
          },
          {
            key: "users",
            label: dictionary.admin.roles.usersInRole,
            href: `/admin/roles/${encodeURIComponent(detail.name)}/users`,
          },
        ]}
      />

      {activeTab === "details" && (
        <>
          <Card className="admin-panel-card">
            <Card.Body>
              <Form noValidate onSubmit={handleSubmit(saveDescription)}>
                <Form.Group controlId="role-description-detail">
                  <Form.Label>{dictionary.admin.roles.description}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    maxLength={500}
                    disabled={!access?.manageRoles || descriptionSaving}
                    isInvalid={Boolean(descriptionErrors.description)}
                    {...register("description")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {descriptionErrors.description?.message}
                  </Form.Control.Feedback>
                  <Form.Text>{dictionary.admin.roles.descriptionHelp}</Form.Text>
                </Form.Group>
                {access?.manageRoles && (
                  <Button className="mt-3" disabled={descriptionSaving} type="submit">
                    {descriptionSaving ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <AdminActionIcon action="save" />
                    )}
                    {dictionary.admin.roles.saveDescription}
                  </Button>
                )}
              </Form>
            </Card.Body>
          </Card>
          <Card className="admin-panel-card">
            <Card.Body>
              <div className="admin-detail-heading mb-3">
                <div>
                  <h2 className="h5 mb-1">{dictionary.admin.roles.compositeRoles}</h2>
                  <p className="small text-body-secondary mb-0">
                    {dictionary.admin.roles.compositeHelp}
                  </p>
                </div>
              </div>
              {access?.manageRoles && (
                <div className="position-relative">
                  <Form.Label htmlFor="role-composite-search">
                    {dictionary.admin.roles.assignComposite}
                  </Form.Label>
                  <Form.Control
                    id="role-composite-search"
                    value={selectedComposite?.name ?? compositeQuery}
                    placeholder={dictionary.admin.roles.searchRolesPlaceholder}
                    onChange={(event) => {
                      setSelectedComposite(null);
                      setCompositeQuery(event.target.value);
                    }}
                  />
                  {compositeSuggestions.length > 0 && !selectedComposite && (
                    <ListGroup className="position-absolute start-0 end-0 mt-1 shadow-sm z-3">
                      {compositeSuggestions.map((role) => (
                        <ListGroup.Item
                          action
                          type="button"
                          key={role.name}
                          onClick={() => {
                            setSelectedComposite(role);
                            setCompositeSuggestions([]);
                          }}
                        >
                          {role.name}
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  )}
                  <Button
                    className="mt-2"
                    disabled={!selectedComposite || saving}
                    onClick={() =>
                      selectedComposite && void updateComposite(selectedComposite, "POST")
                    }
                  >
                    {saving ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <AdminActionIcon action="add" />
                    )}
                    {dictionary.admin.roles.assign}
                  </Button>
                </div>
              )}
              {(detail.compositeRoles ?? []).length === 0 ? (
                <div className="text-body-secondary small mt-3">
                  {dictionary.admin.roles.noCompositeRoles}
                </div>
              ) : (
                <div className="d-grid gap-2 mt-3">
                  {detail.compositeRoles?.map((composite) => (
                    <div
                      className="d-flex justify-content-between align-items-center border rounded p-2"
                      key={composite}
                    >
                      <span className="font-monospace">{composite}</span>
                      {access?.manageRoles && (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={saving}
                          onClick={() => void updateComposite({ name: composite }, "DELETE")}
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
                          {dictionary.admin.roles.remove}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="border-top mt-4 pt-4">
                <h3 className="h6">{dictionary.admin.roles.clientCompositeRoles}</h3>
                {access?.manageRoles && (
                  <div className="position-relative">
                    <Form.Label htmlFor="role-client-composite-search">
                      {dictionary.admin.roles.assignClientComposite}
                    </Form.Label>
                    <Form.Control
                      id="role-client-composite-search"
                      value={selectedClientComposite?.name ?? clientCompositeQuery}
                      placeholder={dictionary.admin.roles.searchClientRolesPlaceholder}
                      onChange={(event) => {
                        setSelectedClientComposite(null);
                        setClientCompositeQuery(event.target.value);
                      }}
                    />
                    {clientCompositeSuggestions.length > 0 && !selectedClientComposite && (
                      <ListGroup className="position-absolute start-0 end-0 mt-1 shadow-sm z-3">
                        {clientCompositeSuggestions.map((role) => (
                          <ListGroup.Item
                            action
                            type="button"
                            key={role.id}
                            onClick={() => {
                              setSelectedClientComposite(role);
                              setClientCompositeSuggestions([]);
                            }}
                          >
                            <span className="font-monospace">
                              {role.clientId}:{role.name}
                            </span>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    )}
                    <Button
                      className="mt-2"
                      disabled={!selectedClientComposite || saving}
                      onClick={() =>
                        selectedClientComposite &&
                        void updateClientComposite(selectedClientComposite, "POST")
                      }
                    >
                      {saving ? (
                        <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                      ) : (
                        <AdminActionIcon action="add" />
                      )}
                      {dictionary.admin.roles.assign}
                    </Button>
                  </div>
                )}
                {(detail.compositeClientRoles ?? []).length === 0 ? (
                  <div className="text-body-secondary small mt-3">
                    {dictionary.admin.roles.noClientCompositeRoles}
                  </div>
                ) : (
                  <div className="d-grid gap-2 mt-3">
                    {detail.compositeClientRoles?.map((composite) => (
                      <div
                        className="d-flex justify-content-between align-items-center border rounded p-2"
                        key={composite.id}
                      >
                        <span className="font-monospace">
                          {composite.clientId}:{composite.name}
                        </span>
                        {access?.manageRoles && (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={saving}
                            onClick={() => void updateClientComposite(composite, "DELETE")}
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
                            {dictionary.admin.roles.remove}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </>
      )}

      {activeTab === "users" && (
        <>
          <Card className="admin-panel-card admin-role-user-assignment-card">
            <Card.Body>
              <h2 className="h5">{dictionary.admin.roles.assignUser}</h2>
              <div className="d-flex flex-wrap align-items-start gap-2">
                <div className="position-relative flex-grow-1" style={{ maxWidth: "28rem" }}>
                  <Form.Control
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-controls="role-user-suggestions"
                    aria-expanded={suggestions.length > 0}
                    aria-label={dictionary.admin.roles.searchUsers}
                    placeholder={dictionary.admin.roles.searchUsersPlaceholder}
                    role="combobox"
                    value={selectedUser?.username ?? userQuery}
                    onChange={(event) => {
                      setSelectedUser(null);
                      setSuggestions([]);
                      setSearchingUsers(false);
                      setUserQuery(event.target.value);
                    }}
                  />
                  {searchingUsers && (
                    <Spinner
                      animation="border"
                      size="sm"
                      className="position-absolute end-0 top-0 mt-2 me-2"
                      aria-label={dictionary.admin.roles.searchingUsers}
                    />
                  )}
                  {!selectedUser && suggestions.length > 0 && (
                    <ListGroup
                      id="role-user-suggestions"
                      className="position-absolute start-0 end-0 mt-1 shadow-sm z-3"
                    >
                      {suggestions.map((user) => (
                        <ListGroup.Item
                          action
                          type="button"
                          key={user.id}
                          onClick={() => {
                            setSelectedUser(user);
                            setSuggestions([]);
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-center gap-2">
                            <span>{user.username}</span>
                            <Badge bg={user.enabled ? "success" : "secondary"}>
                              {user.enabled
                                ? dictionary.admin.resources.enabled
                                : dictionary.admin.resources.disabled}
                            </Badge>
                          </div>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  )}
                </div>
                {access?.manageRoles && (
                  <Button disabled={!selectedUser || saving} onClick={() => void assign()}>
                    {saving ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <AdminActionIcon action="assign" />
                    )}
                    {dictionary.admin.roles.assign}
                  </Button>
                )}
              </div>
              <Form.Text className="text-body-secondary">
                {dictionary.admin.roles.searchUsersHelp}
              </Form.Text>
            </Card.Body>
          </Card>

          <ResourceFilters
            query={query}
            searchLabel={dictionary.admin.roles.searchAssignedUsers}
            onQueryChange={setQuery}
            sort={{
              label: dictionary.admin.resources.sort,
              value: sort,
              options: [
                {
                  value: "username,asc",
                  label: `${dictionary.admin.resources.username} · ${dictionary.admin.resources.ascending}`,
                },
                {
                  value: "username,desc",
                  label: `${dictionary.admin.resources.username} · ${dictionary.admin.resources.descending}`,
                },
                {
                  value: "email,asc",
                  label: `${dictionary.admin.resources.email} · ${dictionary.admin.resources.ascending}`,
                },
                {
                  value: "email,desc",
                  label: `${dictionary.admin.resources.email} · ${dictionary.admin.resources.descending}`,
                },
              ],
              onChange: setSort,
            }}
            filterToggle={
              <Form.Select
                aria-label={dictionary.admin.resources.status}
                className="admin-resource-filter-control"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">{dictionary.admin.resources.all}</option>
                <option value="true">{dictionary.admin.resources.enabled}</option>
                <option value="false">{dictionary.admin.resources.disabled}</option>
              </Form.Select>
            }
            activeFilters={
              [
                query && {
                  label: dictionary.admin.resources.search,
                  value: query,
                  onRemove: () => setQuery(""),
                },
                status && {
                  label: dictionary.admin.resources.status,
                  value:
                    status === "true"
                      ? dictionary.admin.resources.enabled
                      : dictionary.admin.resources.disabled,
                  onRemove: () => setStatus(""),
                },
              ].filter(Boolean) as { label: string; value: string; onRemove: () => void }[]
            }
            clearFiltersLabel={dictionary.admin.resources.clearFilters}
            onClearFilters={clearFilters}
            resultCount={detail.users.totalElements}
            recordsLabel={dictionary.admin.resources.records}
          />

          <DataTable
            isEmpty={detail.users.content.length === 0}
            emptyMessage={dictionary.admin.roles.noAssignedUsers}
            footer={
              detail.users.totalElements > 0 ? (
                <PaginationControls
                  page={page}
                  totalPages={detail.users.totalPages}
                  totalElements={detail.users.totalElements}
                  size={size}
                  rowsPerPage={dictionary.admin.resources.rowsPerPage}
                  pageLabel={dictionary.admin.resources.page}
                  previous={dictionary.admin.resources.previous}
                  next={dictionary.admin.resources.next}
                  first={dictionary.admin.resources.first}
                  last={dictionary.admin.resources.last}
                  onPageChange={setPage}
                  onSizeChange={(nextSize) => {
                    setPage(0);
                    setSize(nextSize);
                  }}
                />
              ) : undefined
            }
          >
            <thead>
              <tr>
                <th>{dictionary.admin.resources.user}</th>
                <th>{dictionary.admin.resources.status}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {detail.users.content.map((user) => (
                <tr key={user.id}>
                  <td>
                    <Button
                      variant="link"
                      className="p-0 text-decoration-none"
                      onClick={() => router.push(`/admin/users/${user.id}/details`)}
                    >
                      {user.username}
                    </Button>
                  </td>
                  <td>
                    <Badge bg={user.enabled ? "success" : "secondary"}>
                      {user.enabled
                        ? dictionary.admin.resources.enabled
                        : dictionary.admin.resources.disabled}
                    </Badge>
                  </td>
                  <td className="text-end">
                    {access?.manageRoles && (
                      <Button
                        disabled={saving}
                        size="sm"
                        variant="danger"
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
                        {dictionary.admin.roles.remove}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </>
      )}
    </div>
  );
}
