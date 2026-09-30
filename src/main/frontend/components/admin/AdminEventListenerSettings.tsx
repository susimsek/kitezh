"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Form, Spinner, Table } from "react-bootstrap";

import { useDictionary } from "@/i18n/client";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";

import { ActionIcon } from "@/components/shared/ActionIcon";
import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { ConfirmModal } from "./ConfirmModal";

type EventType = "USER_EVENT" | "ADMIN_EVENT";
type Provider = {
  id: string;
  name: string;
  providerType: "WEBHOOK";
  endpointUrl: string;
  enabled: boolean;
  maxAttempts: number;
  backoffSeconds: number;
  eventTypes: EventType[];
};
type Delivery = {
  id: string;
  providerId: string;
  eventId: string;
  eventType: EventType;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  attempts: number;
  nextAttemptAt?: string | null;
  lastError?: string | null;
};

const EMPTY_FORM = {
  name: "",
  endpointUrl: "",
  enabled: true,
  maxAttempts: 3,
  backoffSeconds: 30,
  eventTypes: ["USER_EVENT", "ADMIN_EVENT"] as EventType[],
};

export default function AdminEventListenerSettings() {
  const dictionary = useDictionary();
  const copy = dictionary.admin.events;
  const { access, accessToken } = useAdminAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadProviders = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await adminRequest<PageResponse<Provider>>(accessToken, {
        url: "/api/admin/event-listeners?page=0&size=100&sort=name,asc",
      });
      if (response.status >= 300) throw new Error();
      setProviders(response.data?.content ?? []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    adminRequest<PageResponse<Provider>>(accessToken, {
      url: "/api/admin/event-listeners?page=0&size=100&sort=name,asc",
    })
      .then((response) => {
        if (cancelled) return;
        if (response.status >= 300) throw new Error();
        setProviders(response.data?.content ?? []);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const loadDeliveries = async (providerId: string) => {
    if (!accessToken) return;
    setSelectedProviderId(providerId);
    const response = await adminRequest<PageResponse<Delivery>>(accessToken, {
      url: `/api/admin/event-listeners/deliveries?providerId=${encodeURIComponent(providerId)}&page=0&size=20&sort=createdAt,desc`,
    });
    if (response.status < 300) setDeliveries(response.data.content);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || form.eventTypes.length === 0) return;
    setSaving(true);
    try {
      const response = await adminRequest<Provider>(accessToken, {
        method: editingId ? "PUT" : "POST",
        url: editingId
          ? `/api/admin/event-listeners/${editingId}`
          : "/api/admin/event-listeners",
        data: { ...form, providerType: "WEBHOOK" },
      });
      if (response.status >= 300) throw new Error();
      setForm(EMPTY_FORM);
      setEditingId(null);
      setError(false);
      await loadProviders();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!accessToken || !deletingId) return;
    try {
      const response = await adminRequest(accessToken, {
        method: "DELETE",
        url: `/api/admin/event-listeners/${deletingId}`,
      });
      if (response.status >= 300) throw new Error();
      setDeletingId(null);
      if (selectedProviderId === deletingId) {
        setSelectedProviderId(null);
        setDeliveries([]);
      }
      await loadProviders();
    } catch {
      setError(true);
    }
  };

  const retry = async (deliveryId: string) => {
    if (!accessToken) return;
    setRetryingId(deliveryId);
    try {
      const response = await adminRequest(accessToken, {
        method: "POST",
        url: `/api/admin/event-listeners/deliveries/${deliveryId}/retry`,
      });
      if (response.status >= 300) throw new Error();
      if (selectedProviderId) await loadDeliveries(selectedProviderId);
    } catch {
      setError(true);
    } finally {
      setRetryingId(null);
    }
  };

  const edit = (provider: Provider) => {
    setEditingId(provider.id);
    setForm({
      name: provider.name,
      endpointUrl: provider.endpointUrl,
      enabled: provider.enabled,
      maxAttempts: provider.maxAttempts,
      backoffSeconds: provider.backoffSeconds,
      eventTypes: provider.eventTypes,
    });
  };

  const toggleEventType = (eventType: EventType, checked: boolean) => {
    setForm((current) => ({
      ...current,
      eventTypes: checked
        ? [...new Set([...current.eventTypes, eventType])]
        : current.eventTypes.filter((value) => value !== eventType),
    }));
  };

  return (
    <Card className="admin-panel-card">
      <Card.Body>
        <div className="admin-detail-heading">
          <div>
            <h2 className="h5 mb-2">{copy.listenerTitle}</h2>
            <p className="text-body-secondary mb-0">{copy.listenerDescription}</p>
          </div>
          {access?.manageEvents && (
            <Button
              className="btn-primary"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
            >
              <AdminActionIcon action="add" />
              {copy.listenerCreate}
            </Button>
          )}
        </div>
        {error && <Alert variant="danger">{copy.listenerError}</Alert>}
        {loading ? (
          <div role="status">{copy.loading}</div>
        ) : (
          <>
            <Table responsive hover className="mt-4 align-middle">
              <thead>
                <tr>
                  <th>{copy.listenerName}</th>
                  <th>{copy.listenerEndpoint}</th>
                  <th>{copy.listenerStatus}</th>
                  <th>{copy.listenerEvents}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr key={provider.id}>
                    <td>{provider.name}</td>
                    <td className="font-monospace text-break">{provider.endpointUrl}</td>
                    <td>
                      <Badge bg={provider.enabled ? "success" : "secondary"}>
                        {provider.enabled ? copy.listenerEnabled : copy.listenerDisabled}
                      </Badge>
                    </td>
                    <td>{provider.eventTypes.join(", ")}</td>
                    <td className="text-end">
                      <Button size="sm" variant="outline-secondary" onClick={() => void loadDeliveries(provider.id)}>
                        <ActionIcon action="view" /> {copy.listenerDeliveries}
                      </Button>{" "}
                      {access?.manageEvents && (
                        <>
                          <Button size="sm" variant="outline-secondary" onClick={() => edit(provider)}>
                            <ActionIcon action="edit" />
                          </Button>{" "}
                          <Button size="sm" variant="outline-danger" onClick={() => setDeletingId(provider.id)}>
                            <ActionIcon action="delete" />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {providers.length === 0 && <p className="text-body-secondary">{copy.listenerEmpty}</p>}
          </>
        )}
        {access?.manageEvents && (
          <Form className="border-top pt-4 mt-4" noValidate onSubmit={submit}>
            <h3 className="h6">{editingId ? copy.listenerEdit : copy.listenerCreate}</h3>
            <div className="row g-3">
              <Form.Group className="col-md-6" controlId="event-listener-name">
                <Form.Label>{copy.listenerName}</Form.Label>
                <Form.Control required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Form.Group>
              <Form.Group className="col-md-6" controlId="event-listener-endpoint">
                <Form.Label>{copy.listenerEndpoint}</Form.Label>
                <Form.Control required type="url" placeholder="https://example.test/events" value={form.endpointUrl} onChange={(event) => setForm({ ...form, endpointUrl: event.target.value })} />
                <Form.Text>{copy.listenerHttpsHint}</Form.Text>
              </Form.Group>
              <Form.Group className="col-md-3" controlId="event-listener-attempts">
                <Form.Label>{copy.listenerMaxAttempts}</Form.Label>
                <Form.Control required type="number" min={1} max={10} value={form.maxAttempts} onChange={(event) => setForm({ ...form, maxAttempts: Number(event.target.value) })} />
              </Form.Group>
              <Form.Group className="col-md-3" controlId="event-listener-backoff">
                <Form.Label>{copy.listenerBackoff}</Form.Label>
                <Form.Control required type="number" min={1} max={86400} value={form.backoffSeconds} onChange={(event) => setForm({ ...form, backoffSeconds: Number(event.target.value) })} />
              </Form.Group>
              <div className="col-md-6">
                <Form.Label>{copy.listenerEvents}</Form.Label>
                <div>
                  {(["USER_EVENT", "ADMIN_EVENT"] as EventType[]).map((eventType) => (
                    <Form.Check key={eventType} inline type="checkbox" label={eventType} checked={form.eventTypes.includes(eventType)} onChange={(event) => toggleEventType(eventType, event.target.checked)} />
                  ))}
                </div>
              </div>
              <div className="col-12">
                <Form.Check type="switch" label={copy.listenerEnabled} checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
              </div>
            </div>
            <div className="admin-form-actions mt-4">
              <Button disabled={saving || form.eventTypes.length === 0} type="submit">
                {saving ? <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" /> : <AdminActionIcon action="save" />}
                {copy.listenerSave}
              </Button>
            </div>
          </Form>
        )}
        {selectedProviderId && (
          <div className="border-top pt-4 mt-4">
            <h3 className="h6">{copy.listenerDeliveryHistory}</h3>
            <Table responsive size="sm">
              <thead><tr><th>{copy.listenerDeliveryEvent}</th><th>{copy.listenerDeliveryStatus}</th><th>{copy.listenerDeliveryAttempts}</th><th>{copy.listenerDeliveryError}</th><th /></tr></thead>
              <tbody>{deliveries.map((delivery) => <tr key={delivery.id}><td>{delivery.eventType}</td><td><Badge bg={delivery.status === "SUCCEEDED" ? "success" : delivery.status === "FAILED" ? "danger" : "warning"}>{delivery.status}</Badge></td><td>{delivery.attempts}</td><td>{delivery.lastError || "—"}</td><td className="text-end">{access?.manageEvents && delivery.status !== "SUCCEEDED" && <Button size="sm" disabled={retryingId === delivery.id} onClick={() => void retry(delivery.id)}>{retryingId === delivery.id && <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />}{copy.listenerRetry}</Button>}</td></tr>)}</tbody>
            </Table>
          </div>
        )}
      </Card.Body>
      <ConfirmModal show={deletingId !== null} message={copy.listenerDeleteMessage} cancelLabel={dictionary.admin.common.cancel} confirmLabel={copy.listenerDelete} busy={false} onCancel={() => setDeletingId(null)} onConfirm={() => void remove()} />
    </Card>
  );
}
