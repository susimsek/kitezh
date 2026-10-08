"use client";

import { useEffect, useState } from "react";
import Link from "@/routing/Link";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useLocale } from "@/i18n/client";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { useAdminAuth } from "./AdminAuthProvider";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { Icon, type IconName } from "@/components/shared/Icon";

type Dashboard = { clients: number; users: number; sessions: number; consents: number };
type ServerInfo = {
  issuer: string;
  discoveryEndpoint: string;
  jwksEndpoint: string;
  activeSigningKey: { kid: string; algorithm: string; createdAt: string } | null;
};
type Health = { status: string };
type Event = {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  occurredAt: string;
};
export function AdminDashboard({ dictionary }: { dictionary: Dictionary }) {
  const locale = useLocale();
  const { accessToken } = useAdminAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [health, setHealth] = useState<string>("—");
  useEffect(() => {
    if (!accessToken) return;
    const c = new AbortController();
    Promise.all([
      adminRequest<Dashboard>(accessToken, { url: "/api/admin/dashboard", signal: c.signal }),
      adminRequest<PageResponse<Event>>(accessToken, {
        url: "/api/admin/events?size=6&sort=occurredAt,desc",
        signal: c.signal,
      }),
      adminRequest<ServerInfo>(accessToken, {
        url: "/api/admin/server-info",
        signal: c.signal,
      }),
      typeof fetch === "function"
        ? fetch("/actuator/health/readiness", { signal: c.signal })
            .then(async (response) => (response.ok ? ((await response.json()) as Health) : null))
            .catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([d, e, info, readiness]) => {
        if (d.status === 200) setDashboard(d.data);
        if (e.status < 300) setEvents(e.data.content);
        if (info.status < 300) setServerInfo(info.data);
        setHealth(readiness?.status ?? "DOWN");
      })
      .catch(() => {});
    return () => c.abort();
  }, [accessToken]);
  const cards: ReadonlyArray<readonly [string, number | undefined, IconName]> = [
    [dictionary.admin.nav.clients, dashboard?.clients, "addressCard"],
    [dictionary.admin.nav.users, dashboard?.users, "users"],
    [dictionary.admin.nav.sessions, dashboard?.sessions, "laptop"],
    [dictionary.admin.nav.consents, dashboard?.consents, "shieldHalved"],
  ];
  return (
    <div className="d-grid gap-4">
      <div className="row g-3 g-xl-4">
        {cards.map(([label, count, icon]) => (
          <div className="col-sm-6 col-xl-3" key={label}>
            <div className="admin-stat-card card h-100">
              <div className="card-body d-flex align-items-start justify-content-between gap-3">
                <div>
                  <div className="admin-stat-label text-body-secondary small mb-2">{label}</div>
                  <div className="admin-stat-value fw-semibold">{count ?? "-"}</div>
                </div>
                <span className="admin-stat-icon">
                  <Icon icon={icon} />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="row g-3">
        <div className="col-lg-6">
          <div className="admin-panel-card card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center gap-2 fw-semibold mb-3">
                <Icon icon="heartPulse" />
                {dictionary.admin.dashboard.serverHealth}
              </div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className={`badge ${health === "UP" ? "text-bg-success" : "text-bg-danger"}`}>
                  {health}
                </span>
                <span className="small text-body-secondary">
                  {dictionary.admin.dashboard.readinessProbe}
                </span>
              </div>
              <div className="small text-body-secondary text-break">
                {serverInfo?.issuer ?? "—"}
              </div>
              <Link className="btn btn-sm btn-secondary mt-3" href={`/admin/server-info`}>
                <ActionIcon action="view" />
                {dictionary.admin.dashboard.openServerInfo}
              </Link>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="admin-panel-card card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center gap-2 fw-semibold mb-3">
                <Icon icon="key" />
                {dictionary.admin.dashboard.activeSigningKey}
              </div>
              {serverInfo?.activeSigningKey ? (
                <>
                  <div className="font-monospace small text-break">
                    {serverInfo.activeSigningKey.kid}
                  </div>
                  <div className="mt-2">
                    <span className="badge text-bg-secondary">
                      {serverInfo.activeSigningKey.algorithm}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-body-secondary">—</div>
              )}
              <Link className="btn btn-sm btn-secondary mt-3" href={`/admin/keys`}>
                <ActionIcon action="manage" />
                {dictionary.admin.dashboard.manageKeys}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-panel-card card">
        <div className="card-header bg-body d-flex justify-content-between align-items-center py-3">
          <div>
            <div className="d-flex align-items-center gap-2 fw-semibold">
              <Icon icon="clockRotateLeft" />
              {dictionary.admin.dashboard.recentEvents}
            </div>
            <div className="small text-body-secondary">
              {dictionary.admin.dashboard.recentActivity}
            </div>
          </div>
          <Link className="btn btn-sm btn-secondary" href={`/admin/events`}>
            <ActionIcon action="view" />
            {dictionary.admin.dashboard.viewAll}
          </Link>
        </div>
        <div className="list-group list-group-flush">
          {events.map((e) => (
            <div className="list-group-item d-flex gap-3 align-items-start" key={e.id}>
              <BadgeLike action={e.action} />
              <div className="flex-grow-1 min-w-0">
                <div className="fw-medium">
                  {e.actor}
                  <span className="text-body-secondary fw-normal"> · {e.targetType}</span>
                </div>
                <div className="small text-body-secondary text-truncate">{e.targetId}</div>
              </div>
              <div className="small text-body-secondary text-nowrap">
                {new Date(e.occurredAt).toLocaleString(locale)}
              </div>
            </div>
          ))}
          {events.length === 0 && <div className="p-4 text-body-secondary">—</div>}
        </div>
      </div>
    </div>
  );
}
function BadgeLike({ action }: { action: string }) {
  return <span className="badge text-bg-secondary font-monospace">{action}</span>;
}
