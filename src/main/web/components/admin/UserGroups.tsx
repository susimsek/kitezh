"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Form, ListGroup, Spinner } from "react-bootstrap";

import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";

import { AdminActionIcon } from "./AdminActionIcon";
import { ErrorState, LoadingState } from "./AsyncState";
import { DataTable } from "./DataTable";
import { useAdminAuth } from "./AdminAuthProvider";

type Group = { id: number; name: string; roles: string[]; userCount: number };

export function UserGroups({ dictionary, userId }: { dictionary: Dictionary; userId: string }) {
  const { access, accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const copy = dictionary.admin.groups;
  const [groups, setGroups] = useState<Group[]>([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const canManageGroups = Boolean(access?.manageUsers);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await adminRequest<PageResponse<Group>>(accessToken, {
        url: `/api/admin/users/${encodeURIComponent(userId)}/groups?page=0&size=100`,
      });
      if (response.status >= 300) throw new Error();
      setGroups(response.data.content);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken, userId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    if (!accessToken || !canManageGroups || query.trim().length < 1 || selectedGroup) {
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      adminRequest<PageResponse<Group>>(accessToken, {
        url: `/api/admin/groups?q=${encodeURIComponent(query.trim())}&page=0&size=10`,
        signal: controller.signal,
      })
        .then((response) => {
          const existingIds = new Set(groups.map((group) => group.id));
          setSuggestions(
            response.status < 300
              ? response.data.content.filter((group) => !existingIds.has(group.id))
              : [],
          );
        })
        .catch(() => setSuggestions([]));
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [accessToken, canManageGroups, groups, query, selectedGroup]);

  const join = async () => {
    if (!canManageGroups || !accessToken || !selectedGroup) return;
    setSaving(true);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/groups/${selectedGroup.id}/users`,
        method: "POST",
        data: { userId: Number(userId) },
      });
      if (response.status >= 300) throw new Error();
      setSelectedGroup(null);
      setQuery("");
      setSuggestions([]);
      alerts.addAlert(copy.groupAdded);
      await load();
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setSaving(false);
    }
  };

  const leave = async (group: Group) => {
    if (!canManageGroups || !accessToken) return;
    setSaving(true);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/groups/${group.id}/users/${encodeURIComponent(userId)}`,
        method: "DELETE",
      });
      if (response.status >= 300) throw new Error();
      alerts.addAlert(copy.groupRemoved);
      await load();
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={copy.operationError} />;

  return (
    <div className="d-grid gap-4">
      <Card className="admin-panel-card">
        <Card.Body>
          <h2 className="h5 mb-1">{copy.memberships}</h2>
          <p className="small text-body-secondary mb-3">{copy.help}</p>
          {canManageGroups && (
            <div className="d-flex flex-wrap align-items-start gap-2">
              <div className="position-relative flex-grow-1" style={{ maxWidth: "28rem" }}>
                <Form.Control
                  aria-label={copy.searchGroups}
                  placeholder={copy.searchGroups}
                  value={selectedGroup?.name ?? query}
                  onChange={(event) => {
                    setSelectedGroup(null);
                    setQuery(event.target.value);
                  }}
                />
                {!selectedGroup && query.trim().length > 0 && suggestions.length > 0 && (
                  <ListGroup className="position-absolute start-0 end-0 mt-1 shadow-sm z-3">
                    {suggestions.map((group) => (
                      <ListGroup.Item
                        action
                        as="button"
                        key={group.id}
                        onClick={() => setSelectedGroup(group)}
                        type="button"
                      >
                        {group.name}
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </div>
              <Button disabled={!selectedGroup || saving} onClick={() => void join()} type="button">
                {saving ? (
                  <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                ) : (
                  <AdminActionIcon action="add" />
                )}
                {copy.assignGroup}
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>
      <DataTable isEmpty={groups.length === 0} emptyMessage={dictionary.admin.resources.empty}>
        <thead>
          <tr>
            <th>{copy.name}</th>
            <th>{copy.roleMappings}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.id}>
              <td className="fw-semibold">{group.name}</td>
              <td>
                {group.roles.length === 0
                  ? "—"
                  : group.roles.map((role) => (
                      <Badge bg="secondary" className="me-1" key={role}>
                        {role}
                      </Badge>
                    ))}
              </td>
              <td className="text-end">
                {canManageGroups && (
                  <Button
                    disabled={saving}
                    onClick={() => void leave(group)}
                    size="sm"
                    type="button"
                    variant="danger"
                  >
                    {saving ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <AdminActionIcon action="remove" />
                    )}
                    {copy.removeGroup}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
