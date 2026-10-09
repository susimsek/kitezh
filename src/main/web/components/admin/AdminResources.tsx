"use client";

import { useDateTimeFormatter } from "@/i18n/useDateTimeFormatter";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "@/routing/Link";
import { Badge, Button, Dropdown, Form, Modal, Spinner } from "react-bootstrap";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { encodeConsentRouteKey } from "@/lib/consent-route";
import type { ConsoleLogoutOptions } from "@/lib/console-auth";
import { apiUrl } from "@/lib/desktop-api";

import { useAdminAuth } from "./AdminAuthProvider";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { AdminActionIcon } from "./AdminActionIcon";
import { ConfirmModal } from "./ConfirmModal";
import { AdminPageHeader } from "./AdminPageHeader";
import { PaginationControls } from "./PaginationControls";
import { ResourceFilters } from "./ResourceFilters";
import { DataTable } from "./DataTable";
import { ErrorState, LoadingState } from "./AsyncState";
import { ResultModal } from "./ResultModal";
import { useAdminTableState } from "./useAdminTableState";
import { RowActions } from "./RowActions";

type User = {
  id: number;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  enabled: boolean;
  avatarUrl: string | null;
  authorities: string[];
  effectiveRoles?: string[];
};
type Session = {
  id: string;
  username: string | null;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
  authorizationCount: number;
  active: boolean;
};
type SessionAuthorization = {
  id: string;
  clientId: string;
  clientName: string;
  grantType: string;
  scopes: string[];
  accessTokenIssuedAt: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
};
type SessionDetail = { session: Session; authorizations: SessionAuthorization[] };
type Consent = {
  clientId: string;
  clientName: string;
  principalName: string;
  userId: number | null;
  authorities: string[];
  createdAt: string;
  updatedAt: string;
};
type Key = {
  id: string;
  kid: string;
  type: string;
  algorithm: string;
  use: string;
  active: boolean;
  createdAt: string;
};

type Resource = "users" | "sessions" | "consents" | "keys";
type Copy = Dictionary["admin"]["resources"];
type UserBulkAction = "ENABLE" | "DISABLE" | "DELETE";

export function AdminResources({
  resource,
  copy,
  locale,
}: {
  resource: Resource;
  copy: Copy;
  locale?: Locale;
}) {
  return <AdminResourcesContent copy={copy} key={resource} locale={locale} resource={resource} />;
}

function AdminResourcesContent({
  resource,
  copy,
  locale,
}: {
  resource: Resource;
  copy: Copy;
  locale?: Locale;
}) {
  const { access, accessToken, logout, username: currentUsername } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const [items, setItems] = useState<User[] | Session[] | Consent[] | Key[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<UserBulkAction | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [globalSessionConfirm, setGlobalSessionConfirm] = useState(false);
  const [globalSessionBusy, setGlobalSessionBusy] = useState(false);
  const [result, setResult] = useState<{ title: string; message: string; value?: string } | null>(
    null,
  );
  const [rotating, setRotating] = useState(false);
  const {
    clientId,
    clearFilters,
    page,
    query,
    setClientId,
    setPage,
    setQuery,
    setSize,
    setSort,
    setStatus,
    setUsername,
    setScope,
    size,
    sort,
    status,
    username,
    scope,
  } = useAdminTableState(
    10,
    resource === "users" || resource === "keys" || resource === "sessions",
    resource === "sessions"
      ? "lastAccessTime,desc"
      : resource === "consents"
        ? "id.principalName,asc"
        : resource === "keys"
          ? "createdAt,desc"
          : "username,asc",
  );

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<PageResponse<User | Session | Consent | Key>>(accessToken, {
      url: `/api/admin/${resource}?q=${encodeURIComponent(query)}&page=${page}&size=${size}&sort=${encodeURIComponent(sort)}${resource === "users" ? `&enabled=${status}` : resource === "keys" ? `&active=${status}` : resource === "sessions" ? `&status=${status || "active"}&clientId=${encodeURIComponent(clientId)}` : resource === "consents" ? `&clientId=${encodeURIComponent(clientId)}&username=${encodeURIComponent(username)}&scope=${encodeURIComponent(scope)}` : ""}`,
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setError(false);
        setItems(response.data.content as User[] | Session[] | Consent[] | Key[]);
        setTotalPages(response.data.totalPages);
        setTotalElements(response.data.totalElements);
        if (resource === "users") setSelectedUserIds([]);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [
    accessToken,
    clientId,
    scope,
    username,
    page,
    query,
    reloadVersion,
    resource,
    size,
    sort,
    status,
  ]);

  const activeFilters = [
    query && { label: copy.search, value: query, onRemove: () => setQuery("") },
    status && {
      label: copy.status,
      value: status === "true" ? copy.active : status === "false" ? copy.passive : status,
      onRemove: () => setStatus(""),
    },
    clientId && { label: copy.client, value: clientId, onRemove: () => setClientId("") },
    username && { label: copy.user, value: username, onRemove: () => setUsername("") },
    scope && { label: copy.scope, value: scope, onRemove: () => setScope("") },
  ].filter(Boolean) as { label: string; value: string; onRemove: () => void }[];
  const sortOptions =
    resource === "sessions"
      ? [
          { value: "lastAccessTime,desc", label: copy.newest },
          { value: "lastAccessTime,asc", label: copy.oldest },
        ]
      : resource === "consents"
        ? [
            { value: "id.principalName,asc", label: `${copy.user} · ${copy.ascending}` },
            { value: "id.principalName,desc", label: `${copy.user} · ${copy.descending}` },
          ]
        : resource === "keys"
          ? [
              { value: "createdAt,desc", label: copy.newest },
              { value: "createdAt,asc", label: copy.oldest },
            ]
          : [
              { value: "username,asc", label: `${copy.username} · ${copy.ascending}` },
              { value: "username,desc", label: `${copy.username} · ${copy.descending}` },
            ];

  const request = async <T,>(
    url: string,
    method: "DELETE" | "POST" | "PUT",
    data?: unknown,
    refresh = true,
    onSuccess?: () => Promise<void> | void,
  ): Promise<T | undefined> => {
    if (!accessToken) return undefined;
    if (refresh) setLoading(true);
    try {
      const response = await adminRequest(accessToken, { url, method, data });
      if (response.status >= 300) {
        throw new Error("Administration operation failed");
      }
      await onSuccess?.();
      setReloadVersion((current) => current + 1);
      return response.data as T;
    } catch {
      alerts.addError(copy.operationError);
      setError(true);
      if (refresh) setLoading(false);
      return undefined;
    }
  };

  const rotateKey = async () => {
    setRotating(true);
    try {
      const key = await request<Key>("/api/admin/keys/rotate", "POST", undefined, false);
      if (!key) return;
      setResult({
        title: copy.keyRotatedTitle,
        message: copy.keyRotatedHelp,
        value: key.kid,
      });
    } finally {
      setRotating(false);
    }
  };

  const runBulkUserAction = async () => {
    if (!accessToken || !bulkAction || selectedUserIds.length === 0) return;
    setBulkBusy(true);
    try {
      const response = await adminRequest(accessToken, {
        url: "/api/admin/users/bulk",
        method: "POST",
        data: { userIds: selectedUserIds, action: bulkAction },
      });
      if (response.status >= 300) throw new Error("Bulk user operation failed");
      setBulkAction(null);
      setSelectedUserIds([]);
      setReloadVersion((current) => current + 1);
    } catch {
      setError(true);
      setLoading(false);
    } finally {
      setBulkBusy(false);
    }
  };

  const revokeAllSessions = async () => {
    if (!accessToken) return;
    setGlobalSessionBusy(true);
    try {
      const response = await adminRequest(accessToken, {
        method: "POST",
        url: "/api/admin/sessions/revoke-all",
      });
      if (response.status >= 300) throw new Error("Session revocation failed");
      alerts.addAlert(copy.sessionTerminated);
      setGlobalSessionConfirm(false);
      if (locale && logout) {
        await logout(locale, { sessionAlreadyRevoked: true });
      } else {
        setReloadVersion((current) => current + 1);
      }
    } catch {
      alerts.addError(copy.operationError);
      setError(true);
      setLoading(false);
    } finally {
      setGlobalSessionBusy(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={copy.operationError} />;

  return (
    <>
      <AdminPageHeader
        title={copy[resource]}
        description={copy.description}
        actions={
          <>
            {resource === "users" && access?.manageUsers && locale && (
              <>
                {selectedUserIds.length > 0 && (
                  <div aria-label={copy.bulkActions} className="admin-bulk-actions" role="group">
                    <Badge bg="secondary" className="admin-bulk-selection-count">
                      {copy.selectedUsers.replace("{count}", String(selectedUserIds.length))}
                    </Badge>
                    <Button
                      disabled={bulkBusy}
                      onClick={() => setBulkAction("ENABLE")}
                      type="button"
                      variant="primary"
                    >
                      <AdminActionIcon action="enable" />
                      {copy.bulkEnable}
                    </Button>
                    <Button
                      disabled={bulkBusy}
                      onClick={() => setBulkAction("DISABLE")}
                      type="button"
                      variant="warning"
                    >
                      <AdminActionIcon action="disable" />
                      {copy.bulkDisable}
                    </Button>
                    <Button
                      disabled={bulkBusy}
                      onClick={() => setBulkAction("DELETE")}
                      type="button"
                      variant="danger"
                    >
                      <AdminActionIcon action="delete" />
                      {copy.bulkDelete}
                    </Button>
                  </div>
                )}
                <Link className="btn btn-primary" href={`/admin/users/new`}>
                  <AdminActionIcon action="add" />
                  {copy.createUser}
                </Link>
              </>
            )}
            {resource === "keys" && access?.manageKeys && (
              <Button disabled={rotating} variant="primary" onClick={() => void rotateKey()}>
                {rotating ? (
                  <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                ) : (
                  <AdminActionIcon action="rotate" />
                )}
                {copy.rotateKey}
              </Button>
            )}
            {resource === "sessions" && access?.manageSessions && (
              <Button
                disabled={globalSessionBusy}
                variant="danger"
                onClick={() => setGlobalSessionConfirm(true)}
              >
                {globalSessionBusy ? (
                  <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                ) : (
                  <AdminActionIcon action="logout" />
                )}
                {copy.revokeAllSessions}
              </Button>
            )}
          </>
        }
      />
      <ResourceFilters
        query={query}
        searchLabel={copy.search}
        sort={{ label: copy.sort, value: sort, options: sortOptions, onChange: setSort }}
        activeFilters={activeFilters}
        clearFiltersLabel={copy.clearFilters}
        onClearFilters={() => {
          setLoading(true);
          clearFilters();
        }}
        resultCount={totalElements}
        recordsLabel={copy.records}
        onQueryChange={(value) => {
          setLoading(true);
          setQuery(value);
        }}
      >
        {resource === "sessions" && (
          <>
            <Form.Control
              aria-label={copy.clientId}
              className="admin-resource-filter-control"
              placeholder={copy.clientId}
              value={clientId}
              onChange={(event) => {
                setLoading(true);
                setClientId(event.target.value);
              }}
            />
            <Form.Select
              aria-label={copy.sessionStatus}
              className="admin-resource-filter-control"
              value={status || "active"}
              onChange={(event) => {
                setLoading(true);
                setStatus(event.target.value);
              }}
            >
              <option value="active">{copy.active}</option>
              <option value="expired">{copy.expired}</option>
              <option value="all">{copy.all}</option>
            </Form.Select>
          </>
        )}
        {resource === "consents" && (
          <>
            <Form.Control
              aria-label={copy.clientId}
              className="admin-resource-filter-control"
              placeholder={copy.clientId}
              value={clientId}
              onChange={(event) => {
                setLoading(true);
                setClientId(event.target.value);
              }}
            />
            <Form.Control
              aria-label={copy.user}
              className="admin-resource-filter-control"
              placeholder={copy.user}
              value={username}
              onChange={(event) => {
                setLoading(true);
                setUsername(event.target.value);
              }}
            />
            <Form.Control
              aria-label={copy.grantedScopes}
              className="admin-resource-filter-control"
              placeholder={copy.grantedScopes}
              value={scope}
              onChange={(event) => {
                setLoading(true);
                setScope(event.target.value);
              }}
            />
          </>
        )}
        {(resource === "users" || resource === "keys") && (
          <Form.Select
            className="admin-resource-filter-control"
            value={status}
            onChange={(event) => {
              setLoading(true);
              setStatus(event.target.value);
            }}
          >
            <option value="">{copy.all}</option>
            <option value="true">{resource === "users" ? copy.enabled : copy.active}</option>
            <option value="false">{resource === "users" ? copy.disabled : copy.passive}</option>
          </Form.Select>
        )}
      </ResourceFilters>
      <DataTable
        isEmpty={items.length === 0}
        emptyMessage={copy.empty}
        footer={
          totalElements > 0 ? (
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              size={size}
              rowsPerPage={copy.rowsPerPage}
              pageLabel={copy.page}
              previous={copy.previous}
              next={copy.next}
              first={copy.first}
              last={copy.last}
              onPageChange={(nextPage) => {
                setLoading(true);
                setPage(nextPage);
              }}
              onSizeChange={(nextSize) => {
                setLoading(true);
                setSize(nextSize);
              }}
            />
          ) : undefined
        }
      >
        {resource === "users" && (
          <UsersTable
            items={items as User[]}
            request={request}
            copy={copy}
            canManage={access?.manageUsers ?? false}
            locale={locale}
            selectedIds={selectedUserIds}
            onSelectionChange={setSelectedUserIds}
          />
        )}
        {resource === "sessions" && (
          <SessionsTable
            items={items as Session[]}
            request={request}
            copy={copy}
            canManage={access?.manageSessions ?? false}
            accessToken={accessToken}
            currentUsername={currentUsername}
            locale={locale}
            logout={logout}
          />
        )}
        {resource === "consents" && (
          <ConsentsTable
            items={items as Consent[]}
            request={request}
            copy={copy}
            canManage={access?.manageConsents ?? false}
            locale={locale}
          />
        )}
        {resource === "keys" && <KeysTable items={items as Key[]} copy={copy} />}
      </DataTable>
      <ResultModal
        closeLabel={copy.cancel}
        message={result?.message ?? ""}
        onClose={() => setResult(null)}
        show={result !== null}
        title={result?.title ?? ""}
        value={result?.value}
      />
      <ConfirmModal
        cancelLabel={copy.cancel}
        confirmLabel={
          bulkAction === "ENABLE"
            ? copy.bulkEnable
            : bulkAction === "DISABLE"
              ? copy.bulkDisable
              : copy.bulkDelete
        }
        confirmAction={
          bulkAction === "ENABLE" ? "enable" : bulkAction === "DISABLE" ? "disable" : "delete"
        }
        confirmVariant={
          bulkAction === "ENABLE" ? "primary" : bulkAction === "DISABLE" ? "warning" : "danger"
        }
        busy={bulkBusy}
        message={
          bulkAction === "ENABLE"
            ? copy.bulkEnableConfirm
            : bulkAction === "DISABLE"
              ? copy.bulkDisableConfirm
              : copy.bulkDeleteConfirm
        }
        onCancel={() => {
          if (!bulkBusy) setBulkAction(null);
        }}
        onConfirm={() => void runBulkUserAction()}
        show={resource === "users" && bulkAction !== null}
      />
      <ConfirmModal
        cancelLabel={copy.cancel}
        confirmLabel={copy.revokeAllSessions}
        confirmAction="logout"
        busy={globalSessionBusy}
        message={copy.revokeAllSessionsConfirm}
        onCancel={() => {
          if (!globalSessionBusy) setGlobalSessionConfirm(false);
        }}
        onConfirm={() => void revokeAllSessions()}
        show={resource === "sessions" && globalSessionConfirm}
      />
    </>
  );
}

function UsersTable({
  items,
  request,
  copy,
  canManage,
  locale,
  selectedIds,
  onSelectionChange,
}: {
  items: User[];
  request: AdminRequest;
  copy: Copy;
  canManage: boolean;
  locale?: Locale;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
}) {
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const allSelected = items.length > 0 && items.every((user) => selectedIds.includes(user.id));

  const toggleUser = (id: number, checked: boolean) => {
    onSelectionChange(
      checked
        ? [...new Set([...selectedIds, id])]
        : selectedIds.filter((selectedId) => selectedId !== id),
    );
  };

  return (
    <>
      <thead>
        <tr>
          {canManage && (
            <th className="admin-selection-column">
              <Form.Check
                aria-label={copy.selectAllUsers}
                checked={allSelected}
                onChange={(event) =>
                  onSelectionChange(event.target.checked ? items.map((user) => user.id) : [])
                }
              />
            </th>
          )}
          <th>{copy.username}</th>
          <th>{copy.roles}</th>
          <th>{copy.status}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {items.map((user) => (
          <tr key={user.id}>
            {canManage && (
              <td className="admin-selection-cell" data-label={copy.selectUser}>
                <Form.Check
                  aria-label={`${copy.selectUser}: ${user.username}`}
                  checked={selectedIds.includes(user.id)}
                  onChange={(event) => toggleUser(user.id, event.target.checked)}
                />
              </td>
            )}
            <td data-label={copy.username}>
              <div className="d-flex align-items-center gap-2">
                {user.avatarUrl ? (
                  <Image
                    alt=""
                    className="rounded-circle object-fit-cover"
                    height={32}
                    src={apiUrl(user.avatarUrl)}
                    unoptimized
                    width={32}
                  />
                ) : (
                  <span className="avatar-placeholder">
                    {user.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <Link
                  className="fw-semibold text-decoration-none"
                  href={`/admin/users/${encodeURIComponent(String(user.id))}/details`}
                >
                  {user.firstName || user.lastName
                    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                    : user.username}
                </Link>
                {(user.firstName || user.lastName) && (
                  <span className="small text-body-secondary">{user.username}</span>
                )}
              </div>
            </td>
            <td data-label={copy.roles}>
              {(user.effectiveRoles ?? user.authorities).map((role) => (
                <Badge bg="secondary" className="me-1" key={role}>
                  {role}
                </Badge>
              ))}
            </td>
            <td data-label={copy.status}>
              <Badge bg={user.enabled ? "success" : "secondary"}>
                {user.enabled ? copy.enabled : copy.disabled}
              </Badge>
            </td>
            {canManage && (
              <td className="text-end">
                <RowActions label={`${user.username} actions`}>
                  {locale && (
                    <Dropdown.Item
                      as={Link}
                      href={`/admin/users/${encodeURIComponent(String(user.id))}/details`}
                    >
                      <AdminActionIcon action="edit" />
                      {copy.edit}
                    </Dropdown.Item>
                  )}
                  <Dropdown.Item
                    onClick={() =>
                      void request(`/api/admin/users/${user.id}/enabled`, "PUT", {
                        enabled: !user.enabled,
                      })
                    }
                  >
                    <AdminActionIcon action={user.enabled ? "disable" : "enable"} />
                    {user.enabled ? copy.disable : copy.enable}
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item className="text-danger" onClick={() => setUserToDelete(user)}>
                    <AdminActionIcon action="delete" />
                    {copy.delete}
                  </Dropdown.Item>
                </RowActions>
              </td>
            )}
          </tr>
        ))}
      </tbody>
      <ConfirmModal
        cancelLabel={copy.cancel}
        confirmLabel={copy.delete}
        message={copy.deleteUserConfirm}
        onCancel={() => setUserToDelete(null)}
        onConfirm={() => {
          if (userToDelete) void request(`/api/admin/users/${userToDelete.id}`, "DELETE");
          setUserToDelete(null);
        }}
        show={userToDelete !== null}
      />
    </>
  );
}

function SessionsTable({
  items,
  request,
  copy,
  canManage,
  accessToken,
  currentUsername,
  locale,
  logout,
}: {
  items: Session[];
  request: AdminRequest;
  copy: Copy;
  canManage: boolean;
  accessToken: string | null;
  currentUsername: string | null;
  locale?: Locale;
  logout?: (locale: Locale, options?: ConsoleLogoutOptions) => Promise<void>;
}) {
  const date = useDateTimeFormatter();
  const [sessionAction, setSessionAction] = useState<{
    url: string;
    label: string;
    message: string;
    username: string | null;
  } | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sessionActionBusy, setSessionActionBusy] = useState(false);

  const showDetail = async (id: string) => {
    if (!accessToken) return;
    setDetailLoading(true);
    try {
      const response = await adminRequest<SessionDetail>(accessToken, {
        url: `/api/admin/sessions/${encodeURIComponent(id)}`,
      });
      if (response.status < 300) setDetail(response.data);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      <thead>
        <tr>
          <th>{copy.sessionId}</th>
          <th>{copy.user}</th>
          <th>{copy.created}</th>
          <th>{copy.lastActive}</th>
          <th>{copy.expires}</th>
          <th>{copy.authorizations}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {items.map((session) => {
          const expired = !session.active;
          return (
            <tr key={session.id}>
              <td className="font-monospace small" data-label={copy.sessionId}>
                <Button
                  variant="link"
                  className="font-monospace p-0 text-decoration-none"
                  disabled={detailLoading}
                  onClick={() => void showDetail(session.id)}
                >
                  {detailLoading ? (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  ) : (
                    <AdminActionIcon action="view" />
                  )}
                  {session.id.slice(0, 12)}…
                </Button>
              </td>
              <td data-label={copy.user}>
                <div className="fw-medium">{session.username ?? "-"}</div>
                <Badge bg={expired ? "secondary" : "success"}>
                  {expired ? copy.expired : copy.active}
                </Badge>
              </td>
              <td data-label={copy.created}>{date(session.createdAt)}</td>
              <td data-label={copy.lastActive}>{date(session.lastAccessedAt)}</td>
              <td data-label={copy.expires}>{date(session.expiresAt)}</td>
              <td data-label={copy.authorizations}>{session.authorizationCount}</td>
              <td className="text-end">
                <RowActions label={copy.sessionActions}>
                  <Dropdown.Item
                    disabled={detailLoading}
                    onClick={() => void showDetail(session.id)}
                  >
                    {detailLoading ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <AdminActionIcon action="view" />
                    )}
                    {copy.details}
                  </Dropdown.Item>
                  {canManage && !expired && (
                    <>
                      <Dropdown.Divider />
                      <Dropdown.Item
                        className="text-danger"
                        onClick={() =>
                          setSessionAction({
                            url: `/api/admin/sessions/${encodeURIComponent(session.id)}`,
                            label: copy.signOut,
                            message: copy.signOutConfirm,
                            username: session.username,
                          })
                        }
                      >
                        <AdminActionIcon action="remove" />
                        {copy.signOut}
                      </Dropdown.Item>
                      {session.username && (
                        <Dropdown.Item
                          className="text-danger"
                          onClick={() =>
                            setSessionAction({
                              url: `/api/admin/users/${encodeURIComponent(session.username ?? "")}/sessions`,
                              label: copy.signOutAll,
                              message: copy.signOutAllConfirm,
                              username: session.username,
                            })
                          }
                        >
                          <AdminActionIcon action="remove" />
                          {copy.signOutAll}
                        </Dropdown.Item>
                      )}
                    </>
                  )}
                </RowActions>
              </td>
            </tr>
          );
        })}
      </tbody>
      <ConfirmModal
        busy={sessionActionBusy}
        cancelLabel={copy.cancel}
        confirmLabel={sessionAction?.label ?? copy.signOut}
        message={sessionAction?.message ?? ""}
        onCancel={() => {
          if (!sessionActionBusy) setSessionAction(null);
        }}
        onConfirm={() => {
          const action = sessionAction;
          if (!action || sessionActionBusy) return;
          setSessionActionBusy(true);
          void request(action.url, "DELETE", undefined, true, async () => {
            if (action.username === currentUsername && locale && logout) {
              await logout(locale, { sessionAlreadyRevoked: true });
            }
          }).finally(() => {
            setSessionActionBusy(false);
            setSessionAction(null);
          });
        }}
        show={sessionAction !== null}
      />
      <Modal
        show={detail !== null || detailLoading}
        onHide={() => setDetail(null)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{copy.sessionDetails}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailLoading && !detail ? (
            <LoadingState />
          ) : detail ? (
            <div className="d-grid gap-4">
              <dl className="row mb-0">
                <dt className="col-sm-4">{copy.sessionId}</dt>
                <dd className="col-sm-8 font-monospace text-break">{detail.session.id}</dd>
                <dt className="col-sm-4">{copy.user}</dt>
                <dd className="col-sm-8">{detail.session.username ?? "-"}</dd>
                <dt className="col-sm-4">{copy.created}</dt>
                <dd className="col-sm-8">{date(detail.session.createdAt)}</dd>
                <dt className="col-sm-4">{copy.lastActive}</dt>
                <dd className="col-sm-8">{date(detail.session.lastAccessedAt)}</dd>
                <dt className="col-sm-4">{copy.expires}</dt>
                <dd className="col-sm-8">{date(detail.session.expiresAt)}</dd>
              </dl>
              <div>
                <h3 className="h6">{copy.authorizations}</h3>
                {detail.authorizations.length === 0 ? (
                  <div className="text-body-secondary">{copy.noAuthorizations}</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>{copy.client}</th>
                          <th>{copy.grantType}</th>
                          <th>{copy.grantedScopes}</th>
                          <th>{copy.accessTokenExpires}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.authorizations.map((authorization) => (
                          <tr key={authorization.id}>
                            <td>
                              <div>{authorization.clientName}</div>
                              <div className="small text-body-secondary font-monospace">
                                {authorization.clientId}
                              </div>
                            </td>
                            <td>{authorization.grantType}</td>
                            <td>
                              {authorization.scopes.map((scope) => (
                                <Badge bg="secondary" className="me-1" key={scope}>
                                  {scope}
                                </Badge>
                              ))}
                            </td>
                            <td>
                              {authorization.accessTokenExpiresAt
                                ? date(authorization.accessTokenExpiresAt)
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </Modal.Body>
      </Modal>
    </>
  );
}

function ConsentsTable({
  items,
  request,
  copy,
  canManage,
  locale,
}: {
  items: Consent[];
  request: AdminRequest;
  copy: Copy;
  canManage: boolean;
  locale?: Locale;
}) {
  const [consentToRevoke, setConsentToRevoke] = useState<Consent | null>(null);
  const formatDate = useDateTimeFormatter();
  return (
    <>
      <thead>
        <tr>
          <th>{copy.user}</th>
          <th>{copy.client}</th>
          <th>{copy.grantedScopes}</th>
          <th>{copy.created}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {items.map((consent) => {
          const detailHref = locale
            ? `/admin/consents/${encodeConsentRouteKey(consent.clientId, consent.principalName)}`
            : undefined;
          return (
            <tr key={`${consent.clientId}-${consent.principalName}`}>
              <td data-label={copy.user}>
                {locale && consent.userId ? (
                  <Link href={`/admin/users/${consent.userId}/details`}>
                    {consent.principalName}
                  </Link>
                ) : (
                  consent.principalName
                )}
              </td>
              <td data-label={copy.client}>
                <div>
                  {locale ? (
                    <Link href={`/admin/clients/${encodeURIComponent(consent.clientId)}/settings`}>
                      {consent.clientName}
                    </Link>
                  ) : (
                    consent.clientName
                  )}
                </div>
                <div className="small text-body-secondary font-monospace">{consent.clientId}</div>
              </td>
              <td data-label={copy.grantedScopes}>
                <div className="d-flex flex-wrap gap-1">
                  {consent.authorities.map((scope) => (
                    <Badge bg="secondary" key={scope}>
                      {scope.replace("SCOPE_", "")}
                    </Badge>
                  ))}
                </div>
              </td>
              <td data-label={copy.created}>{formatDate(consent.createdAt)}</td>
              <td className="text-end">
                <RowActions label={`${consent.clientName} consent actions`}>
                  {detailHref && (
                    <Dropdown.Item as={Link} href={detailHref}>
                      <AdminActionIcon action="view" />
                      {copy.details}
                    </Dropdown.Item>
                  )}
                  {canManage && (
                    <>
                      {detailHref && <Dropdown.Divider />}
                      <Dropdown.Item
                        className="text-danger"
                        onClick={() => setConsentToRevoke(consent)}
                      >
                        <AdminActionIcon action="revoke" />
                        {copy.revoke}
                      </Dropdown.Item>
                    </>
                  )}
                </RowActions>
              </td>
            </tr>
          );
        })}
      </tbody>
      <ConfirmModal
        cancelLabel={copy.cancel}
        confirmLabel={copy.revoke}
        message={copy.revokeConfirm}
        onCancel={() => setConsentToRevoke(null)}
        onConfirm={() => {
          if (consentToRevoke) {
            void request(
              `/api/admin/consents/${encodeURIComponent(consentToRevoke.clientId)}/${encodeURIComponent(consentToRevoke.principalName)}`,
              "DELETE",
            );
          }
          setConsentToRevoke(null);
        }}
        show={consentToRevoke !== null}
      />
    </>
  );
}

function KeysTable({ items, copy }: { items: Key[]; copy: Copy }) {
  const date = useDateTimeFormatter();
  return (
    <>
      <thead>
        <tr>
          <th>{copy.keyId}</th>
          <th>{copy.type}</th>
          <th>{copy.algorithm}</th>
          <th>{copy.status}</th>
          <th>{copy.created}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((key) => (
          <tr key={key.id}>
            <td className="font-monospace small" data-label={copy.keyId}>
              {key.kid}
            </td>
            <td data-label={copy.type}>{key.type}</td>
            <td data-label={copy.algorithm}>{key.algorithm}</td>
            <td data-label={copy.status}>
              <Badge bg={key.active ? "success" : "secondary"}>
                {key.active ? copy.active : copy.passive}
              </Badge>
            </td>
            <td data-label={copy.created}>{date(key.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </>
  );
}

type AdminRequest = <T>(
  url: string,
  method: "DELETE" | "POST" | "PUT",
  data?: unknown,
  refresh?: boolean,
  onSuccess?: () => Promise<void> | void,
) => Promise<T | undefined>;
