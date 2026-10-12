"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { z } from "zod";

import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { useForm } from "@/lib/form";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { AdminBreadcrumb } from "./AdminBreadcrumb";
import { AdminPageHeader } from "./AdminPageHeader";
import { ErrorState, LoadingState } from "./AsyncState";

type Organization = {
  id: number;
  alias: string;
  name: string;
  displayName?: string | null;
  description?: string | null;
  enabled: boolean;
};
type Member = {
  id?: number;
  userId: number;
  username: string;
  email?: string | null;
  role?: string;
};
type Domain = { id: number; domain: string; verified: boolean; verificationToken?: string };
type Invitation = {
  id: number;
  email: string;
  role: string;
  expiresAt: string;
  revokedAt?: string | null;
};
type OrganizationGroup = {
  id: number;
  name: string;
  parentId?: number | null;
  memberCount: number;
};
type Claim = {
  id: number;
  claimName: string;
  claimValue: string;
  addToAccessToken: boolean;
  addToIdToken: boolean;
  addToUserInfo: boolean;
};
type Provider = {
  providerAlias: string;
  providerType: string;
  displayName: string;
  enabled: boolean;
};

export function OrganizationDetail({ dictionary, id }: { dictionary: Dictionary; id: string }) {
  const { access, accessToken } = useAdminAuth();
  const copy = dictionary.admin.organizations;
  const organizationId = Number(id);
  const canManage = Boolean(access?.manageOrganizations || access?.isAdmin);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [groups, setGroups] = useState<OrganizationGroup[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const memberSchema = z.object({
    userId: z.string().min(1),
    role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
  });
  const domainSchema = z.object({ domain: z.string().trim().min(1).max(255) });
  const invitationSchema = z.object({
    email: z.string().trim().email(),
    role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
  });
  const groupSchema = z.object({ name: z.string().trim().min(1).max(100) });
  const claimSchema = z.object({
    claimName: z.string().trim().min(1).max(200),
    claimValue: z.string().trim().min(1).max(2000),
  });
  const providerSchema = z.object({ providerAlias: z.string().trim().min(1).max(100) });
  const memberForm = useForm<z.infer<typeof memberSchema>>({
    resolver: zodResolver(memberSchema),
    defaultValues: { userId: "", role: "MEMBER" },
  });
  const domainForm = useForm<z.infer<typeof domainSchema>>({
    resolver: zodResolver(domainSchema),
    defaultValues: { domain: "" },
  });
  const invitationForm = useForm<z.infer<typeof invitationSchema>>({
    resolver: zodResolver(invitationSchema),
    defaultValues: { email: "", role: "MEMBER" },
  });
  const groupForm = useForm<z.infer<typeof groupSchema>>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: "" },
  });
  const claimForm = useForm<z.infer<typeof claimSchema>>({
    resolver: zodResolver(claimSchema),
    defaultValues: { claimName: "", claimValue: "" },
  });
  const providerForm = useForm<z.infer<typeof providerSchema>>({
    resolver: zodResolver(providerSchema),
    defaultValues: { providerAlias: "" },
  });

  const load = useCallback(() => {
    if (!accessToken || !Number.isFinite(organizationId)) return;
    setLoading(true);
    Promise.all([
      adminRequest<Organization>(accessToken, {
        url: `/api/admin/organizations/${organizationId}`,
      }),
      adminRequest<PageResponse<Member>>(accessToken, {
        url: `/api/admin/organizations/${organizationId}/members?page=0&size=20&sort=user.username,asc`,
      }),
      adminRequest<Domain[]>(accessToken, {
        url: `/api/admin/organizations/${organizationId}/domains`,
      }),
      adminRequest<PageResponse<Invitation>>(accessToken, {
        url: `/api/admin/organizations/${organizationId}/invitations?page=0&size=20&sort=createdAt,desc`,
      }),
      adminRequest<PageResponse<OrganizationGroup>>(accessToken, {
        url: `/api/admin/organizations/${organizationId}/groups?page=0&size=20&sort=name,asc`,
      }),
      adminRequest<Claim[]>(accessToken, {
        url: `/api/admin/organizations/${organizationId}/claims`,
      }),
      adminRequest<Provider[]>(accessToken, {
        url: `/api/admin/organizations/${organizationId}/identity-providers`,
      }),
    ])
      .then(
        ([
          org,
          memberPage,
          domainResult,
          invitationPage,
          groupPage,
          claimResult,
          providerResult,
        ]) => {
          if (
            [
              org,
              memberPage,
              domainResult,
              invitationPage,
              groupPage,
              claimResult,
              providerResult,
            ].some((response) => response.status >= 300)
          )
            throw new Error();
          setOrganization(org.data);
          setMembers(memberPage.data.content);
          setDomains(domainResult.data);
          setInvitations(invitationPage.data.content);
          setGroups(groupPage.data.content);
          setClaims(claimResult.data);
          setProviders(providerResult.data);
          setError(false);
        },
      )
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accessToken, organizationId]);

  useEffect(() => {
    // Loading state is synchronized with the organization request lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const submit = async (
    url: string,
    data: unknown,
    reset: () => void,
    method: "POST" | "DELETE" = "POST",
  ) => {
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const response = await adminRequest(accessToken, { url, method, data });
      if (response.status >= 300) throw new Error();
      reset();
      load();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!organization) return <ErrorState message={copy.operationError} />;

  return (
    <div className="d-grid gap-4">
      {error && <ErrorState message={copy.operationError} />}
      <AdminBreadcrumb
        items={[{ label: copy.title, href: "/admin/organizations" }, { label: organization.name }]}
      />
      <AdminPageHeader
        title={organization.displayName || organization.name}
        description={`${copy.alias}: ${organization.alias}`}
      />
      <Row className="g-4">
        <Col xs={12} xl={6}>
          <CollectionCard title={copy.members}>
            {canManage && (
              <Form
                className="d-flex gap-2 mb-3"
                onSubmit={memberForm.handleSubmit(
                  (data) =>
                    void submit(
                      `/api/admin/organizations/${organizationId}/members`,
                      { userId: Number(data.userId), role: data.role },
                      () => memberForm.reset(),
                    ),
                )}
              >
                <Form.Control placeholder="User ID" {...memberForm.register("userId")} />
                <Form.Select style={{ maxWidth: 140 }} {...memberForm.register("role")}>
                  <option>MEMBER</option>
                  <option>ADMIN</option>
                  <option>OWNER</option>
                </Form.Select>
                <Button disabled={saving} type="submit">
                  {saving ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <AdminActionIcon action="add" />
                  )}{" "}
                  {copy.addMember}
                </Button>
              </Form>
            )}
            <Table responsive size="sm">
              <thead>
                <tr>
                  <th>{copy.memberUsername}</th>
                  <th>{copy.memberRole}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.userId}>
                    <td>{member.username}</td>
                    <td>{member.role}</td>
                    <td className="text-end">
                      {canManage && (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={saving}
                          onClick={() =>
                            void submit(
                              `/api/admin/organizations/${organizationId}/members/${member.userId}`,
                              undefined,
                              () => {},
                              "DELETE",
                            )
                          }
                        >
                          {saving ? <Spinner animation="border" size="sm" /> : copy.removeMember}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CollectionCard>
        </Col>
        <Col xs={12} xl={6}>
          <CollectionCard title={copy.domains}>
            {canManage && (
              <Form
                className="d-flex gap-2 mb-3"
                onSubmit={domainForm.handleSubmit(
                  (data) =>
                    void submit(`/api/admin/organizations/${organizationId}/domains`, data, () =>
                      domainForm.reset(),
                    ),
                )}
              >
                <Form.Control placeholder={copy.domain} {...domainForm.register("domain")} />
                <Button disabled={saving} type="submit">
                  {saving ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <AdminActionIcon action="add" />
                  )}{" "}
                  {copy.addDomain}
                </Button>
              </Form>
            )}
            <Table responsive size="sm">
              <thead>
                <tr>
                  <th>{copy.domain}</th>
                  <th>{copy.verified}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {domains.map((domain) => (
                  <tr key={domain.id}>
                    <td>{domain.domain}</td>
                    <td>{domain.verified ? "✓" : "—"}</td>
                    <td className="text-end">
                      {canManage && !domain.verified && (
                        <Button
                          size="sm"
                          disabled={saving}
                          onClick={() =>
                            void submit(
                              `/api/admin/organizations/${organizationId}/domains/${domain.id}/verify`,
                              {},
                              () => {},
                            )
                          }
                        >
                          {saving ? <Spinner animation="border" size="sm" /> : copy.verify}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CollectionCard>
        </Col>
        <Col xs={12} xl={6}>
          <CollectionCard title={copy.invitations}>
            {canManage && (
              <Form
                className="d-flex gap-2 mb-3"
                onSubmit={invitationForm.handleSubmit(
                  (data) =>
                    void submit(
                      `/api/admin/organizations/${organizationId}/invitations`,
                      data,
                      () => invitationForm.reset(),
                    ),
                )}
              >
                <Form.Control
                  type="email"
                  placeholder={copy.inviteEmail}
                  {...invitationForm.register("email")}
                />
                <Form.Select style={{ maxWidth: 140 }} {...invitationForm.register("role")}>
                  <option>MEMBER</option>
                  <option>ADMIN</option>
                  <option>OWNER</option>
                </Form.Select>
                <Button disabled={saving} type="submit">
                  {saving ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <AdminActionIcon action="add" />
                  )}{" "}
                  {copy.invite}
                </Button>
              </Form>
            )}
            <Table responsive size="sm">
              <thead>
                <tr>
                  <th>{copy.inviteEmail}</th>
                  <th>{copy.memberRole}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td>{invitation.email}</td>
                    <td>{invitation.role}</td>
                    <td>{invitation.revokedAt ? copy.revoke : ""}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CollectionCard>
        </Col>
        <Col xs={12} xl={6}>
          <CollectionCard title={copy.groups}>
            {canManage && (
              <Form
                className="d-flex gap-2 mb-3"
                onSubmit={groupForm.handleSubmit(
                  (data) =>
                    void submit(`/api/admin/organizations/${organizationId}/groups`, data, () =>
                      groupForm.reset(),
                    ),
                )}
              >
                <Form.Control placeholder={copy.groupName} {...groupForm.register("name")} />
                <Button disabled={saving} type="submit">
                  {saving ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <AdminActionIcon action="add" />
                  )}{" "}
                  {copy.addGroup}
                </Button>
              </Form>
            )}
            <Table responsive size="sm">
              <thead>
                <tr>
                  <th>{copy.groupName}</th>
                  <th>{copy.members}</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id}>
                    <td>{group.name}</td>
                    <td>{group.memberCount}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CollectionCard>
        </Col>
        <Col xs={12} xl={6}>
          <CollectionCard title={copy.claims}>
            {canManage && (
              <Form
                className="d-grid gap-2 mb-3"
                onSubmit={claimForm.handleSubmit(
                  (data) =>
                    void submit(
                      `/api/admin/organizations/${organizationId}/claims`,
                      { ...data, addToAccessToken: true },
                      () => claimForm.reset(),
                    ),
                )}
              >
                <Form.Control placeholder={copy.claimName} {...claimForm.register("claimName")} />
                <Form.Control placeholder={copy.claimValue} {...claimForm.register("claimValue")} />
                <Button disabled={saving} type="submit">
                  {saving ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <AdminActionIcon action="add" />
                  )}{" "}
                  {copy.addClaim}
                </Button>
              </Form>
            )}
            <Table responsive size="sm">
              <thead>
                <tr>
                  <th>{copy.claimName}</th>
                  <th>{copy.claimValue}</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.id}>
                    <td>{claim.claimName}</td>
                    <td>{claim.claimValue}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CollectionCard>
        </Col>
        <Col xs={12} xl={6}>
          <CollectionCard title={copy.identityProviders}>
            {canManage && (
              <Form
                className="d-flex gap-2 mb-3"
                onSubmit={providerForm.handleSubmit(
                  (data) =>
                    void submit(
                      `/api/admin/organizations/${organizationId}/identity-providers`,
                      data,
                      () => providerForm.reset(),
                    ),
                )}
              >
                <Form.Control
                  placeholder={copy.providerAlias}
                  {...providerForm.register("providerAlias")}
                />
                <Button disabled={saving} type="submit">
                  {saving ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <AdminActionIcon action="add" />
                  )}{" "}
                  {copy.linkProvider}
                </Button>
              </Form>
            )}
            <Table responsive size="sm">
              <thead>
                <tr>
                  <th>{copy.providerAlias}</th>
                  <th>{copy.enabled}</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr key={provider.providerAlias}>
                    <td>{provider.displayName || provider.providerAlias}</td>
                    <td>{provider.enabled ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CollectionCard>
        </Col>
      </Row>
    </div>
  );
}

function CollectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="admin-panel-card h-100">
      <Card.Body>
        <Card.Title>{title}</Card.Title>
        {children}
      </Card.Body>
    </Card>
  );
}
