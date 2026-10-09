"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge, Button, Card, Form, ListGroup, Spinner } from "react-bootstrap";
import { useForm } from "@/lib/form";
import { useFieldArray } from "react-hook-form";
import { useRouter } from "@/routing/navigation";
import { z } from "zod";

import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { AdminBreadcrumb } from "./AdminBreadcrumb";
import { DataTable } from "./DataTable";
import { DetailTabs } from "./DetailTabs";
import { ErrorState, LoadingState } from "./AsyncState";
import { PaginationControls } from "./PaginationControls";
import { ResourceFilters } from "./ResourceFilters";
import { useAdminTableState } from "./useAdminTableState";

type User = { id: number; username: string; enabled: boolean };
type Group = {
  id: number;
  name: string;
  parentId: number | null;
  path: string;
  roles: string[];
  userCount: number;
  attributes: Record<string, string[]>;
  defaultGroup: boolean;
};
type Role = { name: string };
type Permission = { userId: number; username: string; permission: string };
type PermissionValues = { assignments: { userId: string; permission: string }[] };
export type GroupDetailTab = "details" | "permissions" | "roles" | "members";

export function GroupDetail({
  dictionary,
  id,
  tab,
}: {
  locale: Locale;
  dictionary: Dictionary;
  id: string;
  tab?: GroupDetailTab;
}) {
  const { access, accessToken } = useAdminAuth();
  const canManageUsers = Boolean(access?.manageUsers);
  const canManageRoles = Boolean(access?.manageRoles);
  const canManagePermissions = Boolean(access?.isAdmin);
  const alerts = useConsoleAlerts();
  const router = useRouter();
  const groupId = id;
  const activeTab = tab ?? "details";
  const copy = dictionary.admin.groups;
  const [group, setGroup] = useState<Group | null>(null);
  const groupFormInitialized = useRef(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [memberTotalPages, setMemberTotalPages] = useState(0);
  const [memberTotalElements, setMemberTotalElements] = useState(0);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionUsers, setPermissionUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const {
    page: memberPage,
    query: memberQuery,
    setPage: setMemberPage,
    setQuery: setMemberQuery,
    setSize: setMemberSize,
    setSort: setMemberSort,
    size: memberSize,
    sort: memberSort,
  } = useAdminTableState(10, false, "username,asc");
  const groupSettingsSchema = z.object({
    name: z
      .string()
      .trim()
      .min(1, dictionary.admin.common.validation.required)
      .max(100, dictionary.admin.common.validation.max100),
    parentId: z.string(),
    attributesJson: z.string().refine((value) => {
      if (!value.trim()) return true;
      try {
        const parsed: unknown = JSON.parse(value);
        return (
          typeof parsed === "object" &&
          parsed !== null &&
          Object.values(parsed).every(
            (values) => Array.isArray(values) && values.every((item) => typeof item === "string"),
          )
        );
      } catch {
        return false;
      }
    }, copy.attributeFormat),
    defaultGroup: z.boolean(),
  });
  const {
    register: registerGroupSettings,
    handleSubmit: handleGroupSettingsSubmit,
    reset: resetGroupSettings,
    formState: { errors: groupSettingsErrors, isDirty: isGroupSettingsDirty },
  } = useForm<z.infer<typeof groupSettingsSchema>>({
    resolver: zodResolver(groupSettingsSchema),
    mode: "onChange",
    defaultValues: { name: "", parentId: "", attributesJson: "", defaultGroup: false },
  });
  const permissionsForm = useForm<PermissionValues>({ defaultValues: { assignments: [] } });
  const {
    control: permissionsControl,
    reset: resetPermissions,
    register: registerPermission,
    handleSubmit: handlePermissionsSubmit,
  } = permissionsForm;
  const { fields, append, remove } = useFieldArray({
    control: permissionsControl,
    name: "assignments",
  });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [
        groupResponse,
        rolesResponse,
        groupsResponse,
        membersResponse,
        permissionsResponse,
        usersResponse,
      ] = await Promise.all([
        adminRequest<Group>(accessToken, {
          url: `/api/admin/groups/${encodeURIComponent(groupId)}`,
        }),
        adminRequest<PageResponse<Role>>(accessToken, { url: "/api/admin/roles?page=0&size=100" }),
        adminRequest<PageResponse<Group>>(accessToken, {
          url: "/api/admin/groups?page=0&size=100",
        }),
        adminRequest<PageResponse<User>>(accessToken, {
          url: `/api/admin/groups/${encodeURIComponent(groupId)}/users?q=${encodeURIComponent(memberQuery)}&page=${memberPage}&size=${memberSize}&sort=${encodeURIComponent(memberSort)}`,
        }),
        adminRequest<Permission[]>(accessToken, {
          url: `/api/admin/groups/${encodeURIComponent(groupId)}/permissions`,
        }),
        adminRequest<PageResponse<User>>(accessToken, { url: "/api/admin/users?page=0&size=100" }),
      ]);
      if (
        groupResponse.status >= 300 ||
        rolesResponse.status >= 300 ||
        groupsResponse.status >= 300 ||
        membersResponse.status >= 300
      ) {
        throw new Error();
      }
      setGroup(groupResponse.data);
      if (!groupFormInitialized.current) {
        resetGroupSettings({
          name: groupResponse.data.name,
          parentId: groupResponse.data.parentId?.toString() ?? "",
          attributesJson: JSON.stringify(groupResponse.data.attributes ?? {}, null, 2),
          defaultGroup: groupResponse.data.defaultGroup,
        });
        groupFormInitialized.current = true;
      }
      setRoles(rolesResponse.data.content);
      setGroups(groupsResponse.data.content);
      setSelectedRoles(groupResponse.data.roles);
      setMembers(membersResponse.data.content);
      const loadedPermissions = Array.isArray(permissionsResponse.data)
        ? permissionsResponse.data
        : [];
      setPermissions(loadedPermissions);
      resetPermissions({
        assignments: loadedPermissions.map((permission) => ({
          userId: permission.userId.toString(),
          permission: permission.permission,
        })),
      });
      setPermissionUsers(usersResponse.status < 300 ? usersResponse.data.content : []);
      setMemberTotalPages(membersResponse.data.totalPages);
      setMemberTotalElements(membersResponse.data.totalElements);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    groupId,
    memberPage,
    memberQuery,
    memberSize,
    memberSort,
    resetGroupSettings,
    resetPermissions,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    if (!accessToken || userQuery.trim().length < 2 || selectedUser) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      adminRequest<PageResponse<User>>(accessToken, {
        url: `/api/admin/groups/${encodeURIComponent(groupId)}/available-users?q=${encodeURIComponent(userQuery.trim())}&page=0&size=10`,
        signal: controller.signal,
      })
        .then((response) => setSuggestions(response.status < 300 ? response.data.content : []))
        .catch(() => setSuggestions([]));
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [accessToken, groupId, selectedUser, userQuery]);

  const saveRoles = async () => {
    if (!canManageRoles || !accessToken) return;
    setSaving(true);
    try {
      const response = await adminRequest<Group>(accessToken, {
        url: `/api/admin/groups/${encodeURIComponent(groupId)}/roles`,
        method: "PUT",
        data: { roles: selectedRoles },
      });
      if (response.status >= 300) throw new Error();
      setGroup(response.data);
      alerts.addAlert(copy.mappingSaved);
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async ({
    name,
    parentId,
    attributesJson,
    defaultGroup,
  }: z.infer<typeof groupSettingsSchema>) => {
    if (!canManageUsers || !accessToken) return;
    setSaving(true);
    try {
      const response = await adminRequest<Group>(accessToken, {
        url: `/api/admin/groups/${encodeURIComponent(groupId)}`,
        method: "PUT",
        data: {
          name,
          parentId: parentId ? Number(parentId) : null,
          attributes: attributesJson.trim() ? JSON.parse(attributesJson) : {},
          defaultGroup,
        },
      });
      if (response.status >= 300) throw new Error();
      setGroup(response.data);
      resetGroupSettings({
        name: response.data.name,
        parentId: response.data.parentId?.toString() ?? "",
        attributesJson: JSON.stringify(response.data.attributes ?? {}, null, 2),
        defaultGroup: response.data.defaultGroup,
      });
      alerts.addAlert(copy.groupUpdated);
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setSaving(false);
    }
  };

  const savePermissions = async (values: PermissionValues) => {
    if (!canManagePermissions || !accessToken) return;
    setSaving(true);
    try {
      const response = await adminRequest<Permission[]>(accessToken, {
        url: `/api/admin/groups/${encodeURIComponent(groupId)}/permissions`,
        method: "PUT",
        data: {
          permissions: values.assignments.map((item) => ({
            userId: Number(item.userId),
            permission: item.permission,
          })),
        },
      });
      if (response.status >= 300) throw new Error();
      setPermissions(response.data);
      alerts.addAlert(copy.permissionsSaved);
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setSaving(false);
    }
  };

  const addMember = async () => {
    if (!canManageUsers || !accessToken || !selectedUser) return;
    setSaving(true);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/groups/${encodeURIComponent(groupId)}/users`,
        method: "POST",
        data: { userId: selectedUser.id },
      });
      if (response.status >= 300) throw new Error();
      alerts.addAlert(copy.memberAdded);
      setSelectedUser(null);
      setUserQuery("");
      setSuggestions([]);
      await load();
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (user: User) => {
    if (!canManageUsers || !accessToken) return;
    setSaving(true);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/groups/${encodeURIComponent(groupId)}/users/${user.id}`,
        method: "DELETE",
      });
      if (response.status >= 300) throw new Error();
      alerts.addAlert(copy.memberRemoved);
      if (members.length === 1 && memberPage > 0) setMemberPage(memberPage - 1);
      else await load();
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !group) return <LoadingState />;
  if (error || !group) return <ErrorState message={copy.operationError} />;

  const groupBaseUrl = `/admin/groups/${encodeURIComponent(groupId)}`;
  const groupTabs = [
    { key: "details", label: copy.settings, href: `${groupBaseUrl}/details` },
    { key: "permissions", label: copy.permissions, href: `${groupBaseUrl}/permissions` },
    { key: "roles", label: copy.roleMappings, href: `${groupBaseUrl}/roles` },
    { key: "members", label: copy.members, href: `${groupBaseUrl}/members` },
  ];

  return (
    <div className="d-grid gap-4">
      <AdminBreadcrumb
        items={[{ label: copy.title, href: `/admin/groups` }, { label: group.name }]}
      />
      <div className="admin-detail-heading">
        <div>
          <h1 className="h3 mb-1">{group.name}</h1>
          <div className="text-body-secondary">
            {group.userCount} {copy.members.toLowerCase()}
          </div>
        </div>
      </div>
      <DetailTabs tabs={groupTabs} active={activeTab} />
      {activeTab === "details" && (
        <Card className="admin-panel-card">
          <Card.Body>
            <h2 className="h5 mb-1">{copy.settings}</h2>
            <p className="small text-body-secondary mb-3">{copy.renameHelp}</p>
            <Form onSubmit={handleGroupSettingsSubmit(saveSettings)}>
              <Form.Group className="mb-3" controlId="group-name">
                <Form.Label>{copy.name}</Form.Label>
                <Form.Control
                  isInvalid={Boolean(groupSettingsErrors.name)}
                  maxLength={100}
                  disabled={!canManageUsers}
                  {...registerGroupSettings("name")}
                />
                <Form.Control.Feedback type="invalid">
                  {groupSettingsErrors.name?.message}
                </Form.Control.Feedback>
              </Form.Group>
              <Form.Group className="mb-3" controlId="group-attributes-detail">
                <Form.Label>{copy.attributes}</Form.Label>
                <Form.Control
                  as="textarea"
                  isInvalid={Boolean(groupSettingsErrors.attributesJson)}
                  rows={4}
                  disabled={!canManageUsers}
                  placeholder='{"department":["finance"]}'
                  {...registerGroupSettings("attributesJson")}
                />
                <Form.Control.Feedback type="invalid">
                  {groupSettingsErrors.attributesJson?.message}
                </Form.Control.Feedback>
                <Form.Text>{copy.attributesHelp}</Form.Text>
              </Form.Group>
              <Form.Check
                className="mb-3"
                disabled={!canManageUsers}
                id="group-default-detail"
                label={copy.defaultGroup}
                {...registerGroupSettings("defaultGroup")}
              />
              <Form.Group className="mb-3" controlId="group-parent">
                <Form.Label>{copy.parent}</Form.Label>
                <Form.Select disabled={!canManageUsers} {...registerGroupSettings("parentId")}>
                  <option value="">{copy.rootGroup}</option>
                  {groups
                    .filter((candidate) => candidate.id !== group.id)
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.path}
                      </option>
                    ))}
                </Form.Select>
                <Form.Text>{copy.parentHelp}</Form.Text>
              </Form.Group>
              <div className="admin-form-actions">
                {canManageUsers && (
                  <Button disabled={saving || !isGroupSettingsDirty} type="submit">
                    {saving ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <AdminActionIcon action="save" />
                    )}
                    {dictionary.admin.common.save}
                  </Button>
                )}
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}
      {activeTab === "permissions" && (
        <Card className="admin-panel-card">
          <Card.Body>
            <h2 className="h5 mb-1">{copy.permissions}</h2>
            <p className="small text-body-secondary mb-3">{copy.permissionsHelp}</p>
            <Form onSubmit={handlePermissionsSubmit(savePermissions)}>
              {fields.map((field, index) => (
                <div className="d-flex gap-2 align-items-end mb-2" key={field.id}>
                  <Form.Group className="flex-grow-1" controlId={`group-permission-user-${index}`}>
                    <Form.Label>{copy.permissionUser}</Form.Label>
                    <Form.Select
                      disabled={!canManagePermissions}
                      {...registerPermission(`assignments.${index}.userId`)}
                    >
                      <option value="">{copy.selectUser}</option>
                      {permissionUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="flex-grow-1" controlId={`group-permission-value-${index}`}>
                    <Form.Label>{copy.permission}</Form.Label>
                    <Form.Select
                      disabled={!canManagePermissions}
                      {...registerPermission(`assignments.${index}.permission`)}
                    >
                      {(["VIEW", "MANAGE_MEMBERS", "MANAGE_ROLES", "MANAGE_GROUP"] as const).map(
                        (permission) => (
                          <option key={permission} value={permission}>
                            {permission}
                          </option>
                        ),
                      )}
                    </Form.Select>
                  </Form.Group>
                  {canManagePermissions && (
                    <Button type="button" variant="danger" onClick={() => remove(index)}>
                      <AdminActionIcon action="remove" />
                      {copy.removePermission}
                    </Button>
                  )}
                </div>
              ))}
              {canManagePermissions && (
                <div className="admin-form-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => append({ userId: "", permission: "VIEW" })}
                  >
                    <AdminActionIcon action="add" />
                    {copy.addPermission}
                  </Button>
                  <Button disabled={saving} type="submit">
                    {saving ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <AdminActionIcon action="save" />
                    )}
                    {copy.savePermissions}
                  </Button>
                </div>
              )}
            </Form>
            {!canManagePermissions && permissions.length > 0 && (
              <p className="small text-body-secondary mb-0">
                {permissions.map((item) => `${item.username}: ${item.permission}`).join(", ")}
              </p>
            )}
          </Card.Body>
        </Card>
      )}
      {activeTab === "roles" && (
        <Card className="admin-panel-card">
          <Card.Body>
            <h2 className="h5">{copy.roleMappings}</h2>
            <div className="d-flex flex-wrap gap-2 mb-3">
              {roles.map((role) => (
                <Form.Check
                  key={role.name}
                  checked={selectedRoles.includes(role.name)}
                  id={`role-${role.name}`}
                  label={role.name}
                  type="checkbox"
                  disabled={!canManageRoles}
                  onChange={() =>
                    setSelectedRoles((current) =>
                      current.includes(role.name)
                        ? current.filter((value) => value !== role.name)
                        : [...current, role.name],
                    )
                  }
                />
              ))}
            </div>
            <div className="admin-form-actions">
              {canManageRoles && (
                <Button disabled={saving} onClick={() => void saveRoles()}>
                  {saving ? (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  ) : (
                    <AdminActionIcon action="save" />
                  )}
                  {copy.saveMappings}
                </Button>
              )}
            </div>
          </Card.Body>
        </Card>
      )}
      {activeTab === "members" && (
        <>
          <Card className="admin-panel-card admin-group-member-add-card">
            <Card.Body>
              <h2 className="h5">{copy.assignUser}</h2>
              <div className="d-flex flex-wrap align-items-start gap-2">
                <div className="position-relative flex-grow-1" style={{ maxWidth: "28rem" }}>
                  <Form.Control
                    aria-label={copy.assignUser}
                    placeholder={dictionary.admin.resources.search}
                    value={selectedUser?.username ?? userQuery}
                    disabled={!canManageUsers}
                    onChange={(event) => {
                      setSelectedUser(null);
                      setSuggestions([]);
                      setUserQuery(event.target.value);
                    }}
                  />
                  {!selectedUser && suggestions.length > 0 && (
                    <ListGroup className="admin-member-suggestions position-absolute start-0 end-0 mt-1 shadow-sm">
                      {suggestions.map((user) => (
                        <ListGroup.Item action key={user.id} onClick={() => setSelectedUser(user)}>
                          {user.username}
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  )}
                </div>
                {canManageUsers && (
                  <Button disabled={!selectedUser || saving} onClick={() => void addMember()}>
                    {saving ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <AdminActionIcon action="assign" />
                    )}
                    {copy.assignUser}
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>
          <ResourceFilters
            query={memberQuery}
            searchLabel={copy.searchMembers}
            onQueryChange={setMemberQuery}
            sort={{
              label: dictionary.admin.resources.sort,
              value: memberSort,
              options: [
                {
                  value: "username,asc",
                  label: `${dictionary.admin.resources.username} · ${dictionary.admin.resources.ascending}`,
                },
                {
                  value: "username,desc",
                  label: `${dictionary.admin.resources.username} · ${dictionary.admin.resources.descending}`,
                },
              ],
              onChange: setMemberSort,
            }}
          />
          <DataTable
            isEmpty={members.length === 0}
            emptyMessage={dictionary.admin.resources.empty}
            footer={
              memberTotalElements > 0 ? (
                <PaginationControls
                  first={dictionary.admin.resources.first}
                  last={dictionary.admin.resources.last}
                  next={dictionary.admin.resources.next}
                  onPageChange={setMemberPage}
                  onSizeChange={setMemberSize}
                  page={memberPage}
                  pageLabel={dictionary.admin.resources.page}
                  previous={dictionary.admin.resources.previous}
                  rowsPerPage={dictionary.admin.resources.rowsPerPage}
                  size={memberSize}
                  totalElements={memberTotalElements}
                  totalPages={memberTotalPages}
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
              {members.map((user) => (
                <tr key={user.id}>
                  <td>
                    <Button
                      className="p-0 text-decoration-none"
                      variant="link"
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
                    {canManageUsers && (
                      <Button
                        disabled={saving}
                        size="sm"
                        variant="danger"
                        onClick={() => void removeMember(user)}
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
                        {copy.removeUser}
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
