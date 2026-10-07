"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Form, Spinner } from "react-bootstrap";

import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { AdminBreadcrumb } from "./AdminBreadcrumb";
import { AdminPageHeader } from "./AdminPageHeader";
import { DataTable } from "./DataTable";
import { DetailTabs } from "./DetailTabs";
import { ErrorState, LoadingState } from "./AsyncState";

type Organization = {
  id: number;
  alias: string;
  name: string;
  redirectUrl?: string | null;
  description?: string | null;
  enabled: boolean;
  attributes: Record<string, string[]>;
};
type Member = { userId: number; username: string; email?: string | null; membershipType: string };
type Domain = { id: number; domain: string };
type Group = {
  id: number;
  name: string;
  description?: string | null;
  enabled: boolean;
  roles: string[];
};
type Provider = { id: number; providerAlias: string; enabled: boolean };
type Invitation = {
  id: number;
  email: string;
  name?: string | null;
  status: string;
  expiresAt: string;
  token?: string | null;
};

export type OrganizationDetailTab =
  "overview" | "members" | "domains" | "groups" | "identity-providers" | "invitations";

const PAGE = "page=0&size=100";

export function OrganizationDetail({
  dictionary,
  id,
  tab,
}: {
  dictionary: Dictionary;
  locale: string;
  id: string;
  tab: OrganizationDetailTab;
}) {
  const { access, accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const copy = dictionary.admin.organizations;
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [memberUserId, setMemberUserId] = useState("");
  const [domain, setDomain] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupRoles, setGroupRoles] = useState("");
  const [providerAlias, setProviderAlias] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [overview, setOverview] = useState({
    name: "",
    description: "",
    redirectUrl: "",
    enabled: true,
  });

  const base = `/api/admin/organizations/${encodeURIComponent(id)}`;
  const canManage = Boolean(access?.manageOrganizations && accessToken);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const organizationResponse = await adminRequest<Organization>(accessToken, { url: base });
      if (organizationResponse.status >= 300) throw new Error();
      setOrganization(organizationResponse.data);
      setOverview({
        name: organizationResponse.data.name,
        description: organizationResponse.data.description ?? "",
        redirectUrl: organizationResponse.data.redirectUrl ?? "",
        enabled: organizationResponse.data.enabled,
      });
      if (tab === "members") {
        const response = await adminRequest<PageResponse<Member>>(accessToken, {
          url: `${base}/members?${PAGE}`,
        });
        if (response.status >= 300) throw new Error();
        setMembers(response.data.content);
      } else if (tab === "domains") {
        const response = await adminRequest<PageResponse<Domain>>(accessToken, {
          url: `${base}/domains?${PAGE}`,
        });
        if (response.status >= 300) throw new Error();
        setDomains(response.data.content);
      } else if (tab === "groups") {
        const response = await adminRequest<PageResponse<Group>>(accessToken, {
          url: `${base}/groups?${PAGE}`,
        });
        if (response.status >= 300) throw new Error();
        setGroups(response.data.content);
      } else if (tab === "identity-providers") {
        const response = await adminRequest<PageResponse<Provider>>(accessToken, {
          url: `${base}/identity-providers?${PAGE}`,
        });
        if (response.status >= 300) throw new Error();
        setProviders(response.data.content);
      } else if (tab === "invitations") {
        const response = await adminRequest<PageResponse<Invitation>>(accessToken, {
          url: `${base}/invitations?${PAGE}`,
        });
        if (response.status >= 300) throw new Error();
        setInvitations(response.data.content);
      }
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken, base, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const run = async (key: string, request: Parameters<typeof adminRequest>[1], success: string) => {
    if (!accessToken || saving) return;
    setSaving(key);
    try {
      const response = await adminRequest(accessToken, request);
      if (response.status >= 300) throw new Error();
      alerts.addAlert(success);
      await load();
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setSaving(null);
    }
  };

  const saveOverview = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    void run(
      "overview",
      {
        url: base,
        method: "PUT",
        data: {
          alias: organization?.alias,
          ...overview,
          attributes: organization?.attributes ?? {},
        },
      },
      copy.saved,
    );
  };

  if (loading && !organization) return <LoadingState />;
  if (error || !organization) return <ErrorState message={copy.operationError} />;

  const detailBase = `/admin/organizations/${encodeURIComponent(id)}`;
  const tabs = [
    ["overview", copy.overview],
    ["members", copy.members],
    ["domains", copy.domains],
    ["groups", copy.groups],
    ["identity-providers", copy.identityProviders],
    ["invitations", copy.invitations],
  ].map(([key, label]) => ({ key, label, href: `${detailBase}/${key}` }));

  return (
    <div className="d-grid gap-3">
      <AdminBreadcrumb
        items={[{ label: copy.title, href: "/admin/organizations" }, { label: organization.name }]}
      />
      <AdminPageHeader
        title={organization.name}
        description={`${copy.alias}: ${organization.alias}`}
      />
      <DetailTabs tabs={tabs} active={tab} />
      {tab === "overview" && (
        <Card className="admin-panel-card">
          <Card.Body>
            <Form onSubmit={saveOverview} className="d-grid gap-3">
              <Form.Group controlId="organization-detail-name">
                <Form.Label>{copy.name}</Form.Label>
                <Form.Control
                  value={overview.name}
                  onChange={(event) =>
                    setOverview((value) => ({ ...value, name: event.target.value }))
                  }
                  disabled={!canManage}
                  required
                />
              </Form.Group>
              <Form.Group controlId="organization-detail-description">
                <Form.Label>{copy.description}</Form.Label>
                <Form.Control
                  as="textarea"
                  value={overview.description}
                  onChange={(event) =>
                    setOverview((value) => ({ ...value, description: event.target.value }))
                  }
                  disabled={!canManage}
                />
              </Form.Group>
              <Form.Group controlId="organization-detail-redirect">
                <Form.Label>{copy.redirectUrl}</Form.Label>
                <Form.Control
                  type="url"
                  value={overview.redirectUrl}
                  onChange={(event) =>
                    setOverview((value) => ({ ...value, redirectUrl: event.target.value }))
                  }
                  disabled={!canManage}
                />
              </Form.Group>
              <Form.Check
                type="switch"
                label={copy.enabled}
                checked={overview.enabled}
                onChange={(event) =>
                  setOverview((value) => ({ ...value, enabled: event.target.checked }))
                }
                disabled={!canManage}
              />
              {canManage && (
                <div className="admin-form-actions">
                  <Button type="submit" className="btn-primary" disabled={saving !== null}>
                    {saving === "overview" ? (
                      <Spinner animation="border" size="sm" aria-hidden="true" />
                    ) : (
                      <AdminActionIcon action="save" />
                    )}
                    <span>{copy.save}</span>
                  </Button>
                </div>
              )}
            </Form>
          </Card.Body>
        </Card>
      )}
      {tab === "members" && (
        <CollectionCard
          title={copy.members}
          addLabel={copy.addMember}
          addTargetId="organization-member-user-id"
          canManage={canManage}
        >
          <Form
            className="row g-2 mb-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                "member",
                { url: `${base}/members`, method: "POST", data: { userId: Number(memberUserId) } },
                copy.memberAdded,
              );
            }}
          >
            <Form.Control
              id="organization-member-user-id"
              className="col"
              type="number"
              min={1}
              placeholder={copy.userId}
              value={memberUserId}
              onChange={(event) => setMemberUserId(event.target.value)}
              disabled={!canManage}
              required
            />
            <Button
              type="submit"
              className="btn-primary col-auto"
              disabled={!canManage || saving !== null}
            >
              {saving === "member" ? (
                <Spinner animation="border" size="sm" aria-hidden="true" />
              ) : (
                <AdminActionIcon action="add" />
              )}{" "}
              {copy.add}
            </Button>
          </Form>
          <DataTable isEmpty={members.length === 0} emptyMessage={dictionary.admin.resources.empty}>
            <thead>
              <tr>
                <th>{copy.username}</th>
                <th>{copy.email}</th>
                <th>{copy.membershipType}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId}>
                  <td>{member.username}</td>
                  <td>{member.email ?? "—"}</td>
                  <td>{member.membershipType}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CollectionCard>
      )}
      {tab === "domains" && (
        <CollectionCard
          title={copy.domains}
          addLabel={copy.addDomain}
          addTargetId="organization-domain"
          canManage={canManage}
        >
          <Form
            className="row g-2 mb-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                "domain",
                { url: `${base}/domains`, method: "POST", data: { domain } },
                copy.domainAdded,
              );
            }}
          >
            <Form.Control
              id="organization-domain"
              className="col"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder={copy.domain}
              disabled={!canManage}
              required
            />
            <Button
              type="submit"
              className="btn-primary col-auto"
              disabled={!canManage || saving !== null}
            >
              {saving === "domain" ? (
                <Spinner animation="border" size="sm" aria-hidden="true" />
              ) : (
                <AdminActionIcon action="add" />
              )}{" "}
              {copy.add}
            </Button>
          </Form>
          <DataTable isEmpty={domains.length === 0} emptyMessage={dictionary.admin.resources.empty}>
            <thead>
              <tr>
                <th>{copy.domain}</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((item) => (
                <tr key={item.id}>
                  <td>{item.domain}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CollectionCard>
      )}
      {tab === "groups" && (
        <CollectionCard
          title={copy.groups}
          addLabel={copy.addGroup}
          addTargetId="organization-group-name"
          canManage={canManage}
        >
          <Form
            className="row g-2 mb-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                "group",
                {
                  url: `${base}/groups`,
                  method: "POST",
                  data: {
                    name: groupName,
                    description: null,
                    enabled: true,
                    roles: groupRoles
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  },
                },
                copy.groupAdded,
              );
            }}
          >
            <Form.Control
              id="organization-group-name"
              className="col"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder={copy.groupName}
              disabled={!canManage}
              required
            />
            <Form.Control
              className="col"
              value={groupRoles}
              onChange={(event) => setGroupRoles(event.target.value)}
              placeholder={copy.roles}
              disabled={!canManage}
            />
            <Button
              type="submit"
              className="btn-primary col-auto"
              disabled={!canManage || saving !== null}
            >
              {saving === "group" ? (
                <Spinner animation="border" size="sm" aria-hidden="true" />
              ) : (
                <AdminActionIcon action="add" />
              )}{" "}
              {copy.add}
            </Button>
          </Form>
          <DataTable isEmpty={groups.length === 0} emptyMessage={dictionary.admin.resources.empty}>
            <thead>
              <tr>
                <th>{copy.groupName}</th>
                <th>{copy.roles}</th>
                <th>{copy.status}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <td>{group.name}</td>
                  <td>{group.roles.join(", ") || "—"}</td>
                  <td>
                    <Badge bg={group.enabled ? "success" : "secondary"}>
                      {group.enabled ? copy.enabled : copy.disabled}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CollectionCard>
      )}
      {tab === "identity-providers" && (
        <CollectionCard
          title={copy.identityProviders}
          addLabel={copy.addIdentityProvider}
          addTargetId="organization-provider-alias"
          canManage={canManage}
        >
          <Form
            className="row g-2 mb-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                "provider",
                {
                  url: `${base}/identity-providers`,
                  method: "POST",
                  data: { providerAlias, enabled: true },
                },
                copy.identityProviderAdded,
              );
            }}
          >
            <Form.Control
              id="organization-provider-alias"
              className="col"
              value={providerAlias}
              onChange={(event) => setProviderAlias(event.target.value)}
              placeholder={copy.providerAlias}
              disabled={!canManage}
              required
            />
            <Button
              type="submit"
              className="btn-primary col-auto"
              disabled={!canManage || saving !== null}
            >
              {saving === "provider" ? (
                <Spinner animation="border" size="sm" aria-hidden="true" />
              ) : (
                <AdminActionIcon action="add" />
              )}{" "}
              {copy.add}
            </Button>
          </Form>
          <DataTable
            isEmpty={providers.length === 0}
            emptyMessage={dictionary.admin.resources.empty}
          >
            <thead>
              <tr>
                <th>{copy.providerAlias}</th>
                <th>{copy.status}</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.id}>
                  <td>{provider.providerAlias}</td>
                  <td>{provider.enabled ? copy.enabled : copy.disabled}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CollectionCard>
      )}
      {tab === "invitations" && (
        <CollectionCard
          title={copy.invitations}
          addLabel={copy.createInvitation}
          addTargetId="organization-invitation-email"
          canManage={canManage}
        >
          <Form
            className="row g-2 mb-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                "invitation",
                {
                  url: `${base}/invitations`,
                  method: "POST",
                  data: { email: inviteEmail, name: inviteName || null, lifespanHours: 72 },
                },
                copy.invitationCreated,
              );
            }}
          >
            <Form.Control
              id="organization-invitation-email"
              className="col"
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder={copy.email}
              disabled={!canManage}
              required
            />
            <Form.Control
              className="col"
              value={inviteName}
              onChange={(event) => setInviteName(event.target.value)}
              placeholder={copy.inviteeName}
              disabled={!canManage}
            />
            <Button
              type="submit"
              className="btn-primary col-auto"
              disabled={!canManage || saving !== null}
            >
              {saving === "invitation" ? (
                <Spinner animation="border" size="sm" aria-hidden="true" />
              ) : (
                <AdminActionIcon action="add" />
              )}{" "}
              {copy.add}
            </Button>
          </Form>
          <DataTable
            isEmpty={invitations.length === 0}
            emptyMessage={dictionary.admin.resources.empty}
          >
            <thead>
              <tr>
                <th>{copy.email}</th>
                <th>{copy.status}</th>
                <th>{copy.expiresAt}</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td>{invitation.email}</td>
                  <td>{invitation.status}</td>
                  <td>{new Date(invitation.expiresAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CollectionCard>
      )}
    </div>
  );
}

function CollectionCard({
  title,
  addLabel,
  addTargetId,
  canManage,
  children,
}: {
  title: string;
  addLabel: string;
  addTargetId: string;
  canManage: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="admin-panel-card">
      <Card.Body>
        <div className="admin-detail-heading mb-3">
          <div>
            <h2 className="h5 mb-1">{title}</h2>
          </div>
          {canManage && (
            <Button
              type="button"
              className="btn-primary"
              onClick={() => document.getElementById(addTargetId)?.focus()}
            >
              <AdminActionIcon action="add" />
              {addLabel}
            </Button>
          )}
        </div>
        {children}
      </Card.Body>
    </Card>
  );
}
