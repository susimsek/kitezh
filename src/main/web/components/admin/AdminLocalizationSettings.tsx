"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Spinner } from "react-bootstrap";

import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import Link from "@/routing/Link";
import { useRouter } from "@/routing/navigation";
import { webBundleMessages, type MessageBundle } from "@/i18n/bundles";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";

import { AdminActionIcon } from "./AdminActionIcon";
import { useAdminAuth } from "./AdminAuthProvider";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { DataTable } from "./DataTable";
import { ErrorState, LoadingState } from "./AsyncState";
import { PaginationControls } from "./PaginationControls";
import { ResourceFilters } from "./ResourceFilters";
import { DetailTabs } from "./DetailTabs";
import { useAdminTableState } from "./useAdminTableState";

type Settings = {
  internationalizationEnabled: boolean;
  defaultLocale: string;
  supportedLocales: string[];
  availableLocales: string[];
  availableBundles: string[];
};
type Override = {
  id: number;
  locale: string;
  bundle: string;
  messageKey: string;
  messageValue: string;
};
type EffectiveMessage = { key: string; value: string; source: "bundled" | "override" };
export type LocalizationSection = "settings" | "overrides" | "effective";

export default function AdminLocalizationSettings({
  dictionary,
  section,
  mode = "list",
}: {
  dictionary: Dictionary;
  section: LocalizationSection;
  mode?: "list" | "create";
}) {
  const copy = dictionary.admin.localization;
  const resources = dictionary.admin.resources;
  const { access, accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [override, setOverride] = useState({
    locale: "en",
    bundle: "admin",
    messageKey: "",
    messageValue: "",
  });
  const [bundleFilter, setBundleFilter] = useState<MessageBundle>("admin");
  const [effectiveLocale, setEffectiveLocale] = useState<Locale>("en");
  const [effectiveBundle, setEffectiveBundle] = useState<MessageBundle>("admin");
  const [effectiveQuery, setEffectiveQuery] = useState("");
  const [effectivePage, setEffectivePage] = useState(0);
  const [effectiveSize, setEffectiveSize] = useState(20);
  const [effectiveSort, setEffectiveSort] = useState("messageKey,asc");
  const [effectiveBundled, setEffectiveBundled] = useState<Record<string, string>>({});
  const [effectiveOverrides, setEffectiveOverrides] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [messages, setMessages] = useState<Override[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [messageSaving, setMessageSaving] = useState(false);
  const [error, setError] = useState(false);
  const { clearFilters, page, query, setPage, setQuery, setSize, setSort, size, sort } =
    useAdminTableState(20, false, "locale,asc");

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<Settings>(accessToken, { url: "/api/admin/settings/localization" })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setSettings(response.data);
        setDraft(response.data);
      })
      .catch(() => setError(true));
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<PageResponse<Override>>(accessToken, {
      url: `/api/admin/settings/localization/messages?q=${encodeURIComponent(query)}&locale=${encodeURIComponent("")}&bundle=${encodeURIComponent(bundleFilter)}&page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`,
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setMessages(response.data.content);
        setTotalPages(response.data.totalPages);
        setTotalElements(response.data.totalElements);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accessToken, bundleFilter, page, query, size, sort]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const overrideRequest = fetch(
      `/api/auth/localization/messages?locale=${encodeURIComponent(effectiveLocale)}&bundle=${encodeURIComponent(effectiveBundle)}`,
      { credentials: "same-origin" },
    ).then((response) => (response.ok ? response.json() : {}));
    const bundledRequest =
      effectiveBundle === "backend" || effectiveBundle === "email"
        ? adminRequest<Record<string, string>>(accessToken, {
            url: `/api/admin/settings/localization/bundled?locale=${encodeURIComponent(effectiveLocale)}&bundle=${encodeURIComponent(effectiveBundle)}`,
          }).then((response) => (response.status < 300 ? response.data : {}))
        : Promise.resolve({});
    void Promise.all([overrideRequest, bundledRequest])
      .then(([overrides, bundled]) => {
        if (!cancelled) {
          setEffectiveOverrides(overrides as Record<string, string>);
          setEffectiveBundled(bundled as Record<string, string>);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEffectiveOverrides({});
          setEffectiveBundled({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, effectiveBundle, effectiveLocale]);

  const effectiveMessages = useMemo(() => {
    const bundled =
      effectiveBundle === "backend" || effectiveBundle === "email"
        ? effectiveBundled
        : webBundleMessages(effectiveLocale, effectiveBundle);
    const keys = new Set([...Object.keys(bundled), ...Object.keys(effectiveOverrides)]);
    const normalizedQuery = effectiveQuery.trim().toLowerCase();
    const messages = [...keys]
      .filter(
        (key) =>
          !normalizedQuery ||
          `${key} ${effectiveOverrides[key] ?? bundled[key]}`
            .toLowerCase()
            .includes(normalizedQuery),
      )
      .map((key) => ({
        key,
        value: effectiveOverrides[key] ?? bundled[key] ?? "",
        source: effectiveOverrides[key] === undefined ? "bundled" : "override",
      })) as EffectiveMessage[];
    const [field, direction] = effectiveSort.split(",");
    const multiplier = direction === "desc" ? -1 : 1;
    return messages.sort((left, right) => {
      const leftValue =
        field === "messageValue" ? left.value : field === "source" ? left.source : left.key;
      const rightValue =
        field === "messageValue" ? right.value : field === "source" ? right.source : right.key;
      return multiplier * leftValue.localeCompare(rightValue);
    });
  }, [
    effectiveBundle,
    effectiveBundled,
    effectiveLocale,
    effectiveOverrides,
    effectiveQuery,
    effectiveSort,
  ]);

  const effectiveTotalElements = effectiveMessages.length;
  const effectiveTotalPages = Math.ceil(effectiveTotalElements / effectiveSize);
  const effectivePageMessages = effectiveMessages.slice(
    effectivePage * effectiveSize,
    (effectivePage + 1) * effectiveSize,
  );

  const saveSettings = async () => {
    if (!accessToken || !draft) return;
    setSaving(true);
    try {
      const response = await adminRequest<Settings>(accessToken, {
        method: "PUT",
        url: "/api/admin/settings/localization",
        data: {
          internationalizationEnabled: draft.internationalizationEnabled,
          defaultLocale: draft.defaultLocale,
          supportedLocales: draft.supportedLocales,
        },
      });
      if (response.status >= 300) throw new Error();
      setSettings(response.data);
      setDraft(response.data);
      alerts.addAlert(copy.saved);
    } catch {
      alerts.addError(copy.error);
    } finally {
      setSaving(false);
    }
  };

  const saveOverride = async () => {
    if (!accessToken || !override.messageKey.trim() || !override.messageValue.trim()) return;
    setMessageSaving(true);
    try {
      const response = await adminRequest<Override>(accessToken, {
        method: editing === null ? "POST" : "PUT",
        url:
          editing === null
            ? "/api/admin/settings/localization/messages"
            : `/api/admin/settings/localization/messages/${editing}`,
        data: override,
      });
      if (response.status >= 300) throw new Error();
      setOverride({
        locale: draft?.defaultLocale ?? "en",
        bundle: bundleFilter,
        messageKey: "",
        messageValue: "",
      });
      setEditing(null);
      setPage(0);
      setError(false);
      if (mode === "create") router.push("/admin/settings/localization/overrides");
      window.dispatchEvent(new Event("admin-table-state"));
    } catch {
      setError(true);
    } finally {
      setMessageSaving(false);
    }
  };

  const deleteOverride = async (id: number) => {
    if (!accessToken) return;
    setMessageSaving(true);
    try {
      const response = await adminRequest(accessToken, {
        method: "DELETE",
        url: `/api/admin/settings/localization/messages/${id}`,
      });
      if (response.status >= 300) throw new Error();
      setPage(0);
      window.dispatchEvent(new Event("admin-table-state"));
    } catch {
      setError(true);
    } finally {
      setMessageSaving(false);
    }
  };

  if (loading || !draft || !settings) return <LoadingState />;
  return (
    <div className="d-grid gap-4">
      {error && <ErrorState message={copy.error} />}
      <DetailTabs
        tabs={[
          {
            key: "settings",
            label: copy.settingsTab,
            href: "/admin/settings/localization",
          },
          {
            key: "overrides",
            label: copy.overridesTab,
            href: "/admin/settings/localization/overrides",
          },
          {
            key: "effective",
            label: copy.effectiveTab,
            href: "/admin/settings/localization/effective",
          },
        ]}
        active={section}
      />
      {section === "settings" && (
        <Card className="admin-panel-card">
          <Card.Body>
            <Form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void saveSettings();
              }}
            >
              <h2 className="h5 mb-2">{copy.title}</h2>
              <p className="text-body-secondary mb-4">{copy.subtitle}</p>
              <div className="d-grid gap-3">
                <Form.Check
                  type="switch"
                  label={copy.enabled}
                  checked={draft.internationalizationEnabled}
                  onChange={(event) =>
                    setDraft({ ...draft, internationalizationEnabled: event.target.checked })
                  }
                />
                <Form.Group controlId="localization-default-locale">
                  <Form.Label>{copy.defaultLocale}</Form.Label>
                  <Form.Select
                    value={draft.defaultLocale}
                    onChange={(event) => setDraft({ ...draft, defaultLocale: event.target.value })}
                  >
                    {draft.availableLocales.map((locale) => (
                      <option key={locale} value={locale}>
                        {locale}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group>
                  <Form.Label>{copy.supportedLocales}</Form.Label>
                  <div className="d-flex flex-wrap gap-3">
                    {draft.availableLocales.map((locale) => (
                      <Form.Check
                        key={locale}
                        type="checkbox"
                        label={locale}
                        checked={draft.supportedLocales.includes(locale)}
                        onChange={(event) => {
                          const supported = event.target.checked
                            ? [...new Set([...draft.supportedLocales, locale])]
                            : draft.supportedLocales.filter((value) => value !== locale);
                          setDraft({ ...draft, supportedLocales: supported });
                        }}
                      />
                    ))}
                  </div>
                </Form.Group>
              </div>
              <div className="admin-form-actions mt-4">
                <Button disabled={saving} type="submit">
                  {saving ? (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  ) : (
                    <AdminActionIcon action="save" />
                  )}
                  {copy.save}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}
      {section === "effective" && (
        <>
          <div className="admin-detail-heading">
            <div>
              <h2 className="h5 mb-1">{copy.effectiveTitle}</h2>
              <p className="text-body-secondary mb-0">{copy.effectiveSubtitle}</p>
            </div>
          </div>
          <ResourceFilters
            query={effectiveQuery}
            searchLabel={copy.searchEffective}
            onQueryChange={(value) => {
              setEffectiveQuery(value);
              setEffectivePage(0);
            }}
            sort={{
              label: resources.sort,
              value: effectiveSort,
              options: [
                { value: "messageKey,asc", label: `${copy.messageKey} · ${resources.ascending}` },
                {
                  value: "messageKey,desc",
                  label: `${copy.messageKey} · ${resources.descending}`,
                },
                {
                  value: "messageValue,asc",
                  label: `${copy.messageValue} · ${resources.ascending}`,
                },
                { value: "source,asc", label: `${copy.source} · ${resources.ascending}` },
              ],
              onChange: (value) => {
                setEffectiveSort(value);
                setEffectivePage(0);
              },
            }}
            activeFilters={
              effectiveQuery
                ? [
                    {
                      label: copy.searchEffective,
                      value: effectiveQuery,
                      onRemove: () => {
                        setEffectiveQuery("");
                        setEffectivePage(0);
                      },
                    },
                  ]
                : []
            }
            clearFiltersLabel={resources.clearFilters}
            onClearFilters={() => {
              setEffectiveQuery("");
              setEffectivePage(0);
            }}
            resultCount={effectiveTotalElements}
            recordsLabel={resources.records}
          >
            <Form.Select
              aria-label={copy.locale}
              value={effectiveLocale}
              onChange={(event) => {
                setEffectiveLocale(event.target.value as Locale);
                setEffectivePage(0);
              }}
              className="admin-resource-filter-control"
            >
              {settings.availableLocales.map((locale) => (
                <option key={locale} value={locale}>
                  {locale}
                </option>
              ))}
            </Form.Select>
            <Form.Select
              aria-label={copy.bundle}
              value={effectiveBundle}
              onChange={(event) => {
                setEffectiveBundle(event.target.value as MessageBundle);
                setEffectivePage(0);
              }}
              className="admin-resource-filter-control"
            >
              {settings.availableBundles.map((bundle) => (
                <option key={bundle} value={bundle}>
                  {copy.bundleNames[bundle as MessageBundle] ?? bundle}
                </option>
              ))}
            </Form.Select>
          </ResourceFilters>
          <DataTable
            className="effective-messages-table"
            isEmpty={effectiveMessages.length === 0}
            emptyMessage={copy.effectiveEmpty}
            footer={
              effectiveTotalElements > 0 ? (
                <PaginationControls
                  next={resources.next}
                  previous={resources.previous}
                  first={resources.first}
                  last={resources.last}
                  rowsPerPage={resources.rowsPerPage}
                  pageLabel={resources.page}
                  onPageChange={setEffectivePage}
                  onSizeChange={(value) => {
                    setEffectiveSize(value);
                    setEffectivePage(0);
                  }}
                  page={effectivePage}
                  size={effectiveSize}
                  totalElements={effectiveTotalElements}
                  totalPages={effectiveTotalPages}
                  pageSizeId="effective-message-page-size"
                />
              ) : undefined
            }
          >
            <thead>
              <tr>
                <th>{copy.messageKey}</th>
                <th>{copy.messageValue}</th>
                <th>{copy.source}</th>
              </tr>
            </thead>
            <tbody>
              {effectivePageMessages.map((item) => (
                <tr key={item.key}>
                  <td data-label={copy.messageKey} className="font-monospace">
                    {item.key}
                  </td>
                  <td data-label={copy.messageValue}>{item.value}</td>
                  <td data-label={copy.source}>
                    {item.source === "override" ? copy.override : copy.bundled}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </>
      )}
      {section === "overrides" && (
        <Card className="admin-panel-card">
          <Card.Body>
            <div className="admin-detail-heading mb-4">
              <div>
                <h2 className="h5 mb-1">{copy.overridesTitle}</h2>
                <p className="text-body-secondary mb-0">{copy.overridesSubtitle}</p>
              </div>
              {access?.isAdmin && mode !== "create" && (
                <Link
                  className="btn btn-primary text-nowrap"
                  href="/admin/settings/localization/overrides/new"
                >
                  <AdminActionIcon action="add" />
                  {copy.create}
                </Link>
              )}
            </div>
            {(mode === "create" || editing !== null) && (
              <div className="d-grid gap-3 mb-4">
                <Form.Group controlId="localization-message-locale">
                  <Form.Label>{copy.locale}</Form.Label>
                  <Form.Select
                    value={override.locale}
                    onChange={(event) => setOverride({ ...override, locale: event.target.value })}
                  >
                    {settings.availableLocales.map((locale) => (
                      <option key={locale} value={locale}>
                        {locale}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group controlId="localization-message-bundle">
                  <Form.Label>{copy.bundle}</Form.Label>
                  <Form.Select
                    value={override.bundle}
                    onChange={(event) => setOverride({ ...override, bundle: event.target.value })}
                  >
                    {settings.availableBundles.map((bundle) => (
                      <option key={bundle} value={bundle}>
                        {copy.bundleNames[bundle as MessageBundle] ?? bundle}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group controlId="localization-message-key">
                  <Form.Label>{copy.messageKey}</Form.Label>
                  <Form.Control
                    value={override.messageKey}
                    list="localization-message-keys"
                    onChange={(event) =>
                      setOverride({ ...override, messageKey: event.target.value })
                    }
                  />
                  <datalist id="localization-message-keys">
                    {effectiveMessages.map((item) => (
                      <option key={item.key} value={item.key} />
                    ))}
                  </datalist>
                </Form.Group>
                <Form.Group controlId="localization-message-value">
                  <Form.Label>{copy.messageValue}</Form.Label>
                  <Form.Control
                    value={override.messageValue}
                    onChange={(event) =>
                      setOverride({ ...override, messageValue: event.target.value })
                    }
                  />
                </Form.Group>
                <div>
                  <Button disabled={messageSaving} onClick={() => void saveOverride()}>
                    {messageSaving ? (
                      <Spinner animation="border" size="sm" aria-hidden="true" />
                    ) : (
                      <AdminActionIcon action="save" />
                    )}
                    {editing === null ? copy.create : copy.update}
                  </Button>{" "}
                  {editing !== null && (
                    <Button
                      variant="secondary"
                      disabled={messageSaving}
                      onClick={() => {
                        setEditing(null);
                        setOverride({
                          locale: settings.defaultLocale,
                          bundle: bundleFilter,
                          messageKey: "",
                          messageValue: "",
                        });
                      }}
                    >
                      {copy.cancel}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card.Body>
          {mode !== "create" && (
            <ResourceFilters
              query={query}
              searchLabel={copy.search}
              onQueryChange={setQuery}
              sort={{
                label: resources.sort,
                value: sort,
                options: [
                  { value: "locale,asc", label: `${copy.locale} · ${resources.ascending}` },
                  { value: "bundle,asc", label: `${copy.bundle} · ${resources.ascending}` },
                  { value: "messageKey,asc", label: `${copy.messageKey} · ${resources.ascending}` },
                ],
                onChange: setSort,
              }}
              activeFilters={[
                ...(query
                  ? [{ label: copy.search, value: query, onRemove: () => setQuery("") }]
                  : []),
                ...(bundleFilter
                  ? [
                      {
                        label: copy.bundle,
                        value: bundleFilter,
                        onRemove: () => setBundleFilter("admin"),
                      },
                    ]
                  : []),
              ]}
              clearFiltersLabel={resources.clearFilters}
              onClearFilters={clearFilters}
              resultCount={totalElements}
              recordsLabel={resources.records}
            />
          )}
          {mode !== "create" && (
            <DataTable
              isEmpty={messages.length === 0}
              emptyMessage={copy.empty}
              footer={
                totalElements > 0 ? (
                  <PaginationControls
                    next={resources.next}
                    previous={resources.previous}
                    first={resources.first}
                    last={resources.last}
                    rowsPerPage={resources.rowsPerPage}
                    pageLabel={resources.page}
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
                  <th>{copy.locale}</th>
                  <th>{copy.bundle}</th>
                  <th>{copy.messageKey}</th>
                  <th>{copy.messageValue}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {messages.map((item) => (
                  <tr key={item.id}>
                    <td data-label={copy.locale}>{item.locale}</td>
                    <td data-label={copy.bundle}>{item.bundle}</td>
                    <td data-label={copy.messageKey} className="font-monospace">
                      {item.messageKey}
                    </td>
                    <td data-label={copy.messageValue}>{item.messageValue}</td>
                    <td className="text-end">
                      <Button
                        variant="link"
                        size="sm"
                        aria-label={`${copy.edit}: ${item.messageKey}`}
                        onClick={() => {
                          setEditing(item.id);
                          setOverride({
                            locale: item.locale,
                            bundle: item.bundle,
                            messageKey: item.messageKey,
                            messageValue: item.messageValue,
                          });
                        }}
                      >
                        <AdminActionIcon action="edit" />
                      </Button>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-danger"
                        aria-label={`${copy.delete}: ${item.messageKey}`}
                        disabled={messageSaving}
                        onClick={() => void deleteOverride(item.id)}
                      >
                        <AdminActionIcon action="delete" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      )}
    </div>
  );
}
