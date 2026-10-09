"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Badge, Button, Card, Form, Spinner, Stack } from "react-bootstrap";
import { z } from "zod";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useDateTimeFormatter } from "@/i18n/useDateTimeFormatter";
import { useForm } from "@/lib/form";
import { accountRequest, requestAccount, type AccountWebAuthnCredential } from "@/lib/account-api";
import type { PageResponse } from "@/lib/api-types";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { DetailLoadingState, EmptyState, ErrorState } from "@/components/admin/AsyncState";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { Icon } from "@/components/shared/Icon";
import { registerPasskey } from "@/lib/webauthn";
import { useAccountAuth } from "./AccountAuthProvider";

export function PasskeySettings({ dictionary }: { dictionary: Dictionary }) {
  const copy = dictionary.account.security.passkeys;
  const formatDateTime = useDateTimeFormatter();
  const { accessToken } = useAccountAuth();
  const alerts = useConsoleAlerts();
  const [data, setData] = useState<PageResponse<AccountWebAuthnCredential> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [pending, setPending] = useState<AccountWebAuthnCredential | null>(null);
  const [removing, setRemoving] = useState(false);
  const supported = typeof window !== "undefined" && Boolean(window.PublicKeyCredential);
  const form = useForm<{ label: string }>({
    resolver: zodResolver(
      z.object({ label: z.string().trim().min(1, copy.labelRequired).max(100, copy.labelTooLong) }),
    ),
    defaultValues: { label: "" },
  });
  const items = data?.content ?? [];

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      setData(
        await requestAccount<PageResponse<AccountWebAuthnCredential>>(accessToken, {
          url: "/api/account/webauthn/credentials?page=0&size=20",
        }),
      );
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    requestAccount<PageResponse<AccountWebAuthnCredential>>(accessToken, {
      url: "/api/account/webauthn/credentials?page=0&size=20",
    })
      .then((value) => {
        if (!active) return;
        setData(value);
        setError(false);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  const add = async ({ label }: { label: string }) => {
    if (!accessToken) return;
    setBusy(true);
    try {
      await registerPasskey(async (url, init) => {
        const response = await accountRequest<unknown>(accessToken, {
          url,
          method: init?.method as "POST",
          headers: init?.headers as Record<string, string> | undefined,
          data: init?.body,
        });
        return { status: response.status, data: response.data };
      }, label.trim());
      form.reset();
      await load();
      alerts.addAlert(copy.added);
    } catch {
      alerts.addError(copy.addError);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!accessToken || !pending) return;
    setRemoving(true);
    try {
      await requestAccount<void>(accessToken, {
        method: "DELETE",
        url: `/api/account/webauthn/credentials/${encodeURIComponent(pending.credentialId)}`,
      });
      setPending(null);
      await load();
      alerts.addAlert(copy.removed);
    } catch {
      alerts.addError(copy.removeError);
    } finally {
      setRemoving(false);
    }
  };

  const rename = async (credentialId: string, label: string) => {
    if (!accessToken) return;
    setRenaming(credentialId);
    try {
      await requestAccount<void>(accessToken, {
        method: "PUT",
        url: `/api/account/webauthn/credentials/${encodeURIComponent(credentialId)}`,
        data: { label: label.trim() },
      });
      await load();
      alerts.addAlert(copy.renamed);
    } catch {
      alerts.addError(copy.renameError);
    } finally {
      setRenaming(null);
    }
  };

  return (
    <>
      <Card className="admin-panel-card account-panel-card">
        <Card.Header className="bg-body p-4 border-bottom">
          <h2 className="h5 mb-1">{copy.title}</h2>
          <div className="small text-body-secondary">{copy.help}</div>
        </Card.Header>
        <Card.Body className="p-4">
          <Stack gap={3}>
            {!supported && <Alert variant="info">{copy.unsupported}</Alert>}
            <Form onSubmit={form.handleSubmit(add)} noValidate>
              <Stack gap={2}>
                <Form.Group controlId="passkey-label">
                  <Form.Label>{copy.label}</Form.Label>
                  <Form.Control
                    maxLength={100}
                    isInvalid={Boolean(form.formState.errors.label)}
                    placeholder={copy.labelPlaceholder}
                    {...form.register("label")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {form.formState.errors.label?.message}
                  </Form.Control.Feedback>
                </Form.Group>
                <div>
                  <Button disabled={busy || !supported} type="submit">
                    {busy ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <ActionIcon action="add" />
                    )}
                    {copy.add}
                  </Button>
                </div>
              </Stack>
            </Form>
            {loading ? (
              <DetailLoadingState />
            ) : error ? (
              <ErrorState message={copy.error} />
            ) : items.length === 0 ? (
              <EmptyState message={copy.empty} />
            ) : (
              <div className="d-grid gap-2">
                {items.map((credential) => (
                  <PasskeyRow
                    key={credential.credentialId}
                    credential={credential}
                    copy={copy}
                    formatDateTime={formatDateTime}
                    onRename={rename}
                    renaming={renaming === credential.credentialId}
                    removing={removing}
                    onRemove={() => setPending(credential)}
                  />
                ))}
              </div>
            )}
          </Stack>
        </Card.Body>
      </Card>
      <ConfirmModal
        show={pending !== null}
        message={copy.removeConfirm}
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={copy.remove}
        busy={removing}
        onCancel={() => setPending(null)}
        onConfirm={() => void remove()}
      />
    </>
  );
}

function PasskeyRow({
  credential,
  copy,
  formatDateTime,
  onRename,
  renaming,
  removing,
  onRemove,
}: {
  credential: AccountWebAuthnCredential;
  copy: Dictionary["account"]["security"]["passkeys"];
  formatDateTime: (value: string) => string;
  onRename: (credentialId: string, label: string) => Promise<void>;
  renaming: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  const form = useForm<{ label: string }>({
    resolver: zodResolver(
      z.object({ label: z.string().trim().min(1, copy.labelRequired).max(100, copy.labelTooLong) }),
    ),
    defaultValues: { label: credential.label || "" },
  });
  return (
    <div className="account-session-card">
      <div className="d-flex align-items-start gap-3">
        <div className="account-session-icon">
          <Icon icon="key" />
        </div>
        <div className="flex-grow-1 min-w-0">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <strong>{credential.label || copy.unnamed}</strong>
            {credential.backupState && <Badge bg="success">{copy.backedUp}</Badge>}
          </div>
          <div className="account-session-meta mt-2">
            <span>
              {copy.created}: {formatDateTime(credential.createdAt)}
            </span>
            <span>
              {copy.lastUsed}: {formatDateTime(credential.lastUsedAt)}
            </span>
          </div>
          <div className="small text-body-secondary mt-2">
            {credential.transports.length > 0
              ? credential.transports.join(", ")
              : copy.transportUnknown}
          </div>
          {credential.signatureCount !== undefined && (
            <div className="small text-body-secondary">
              {copy.signatureCount}: {credential.signatureCount} · {copy.userVerification}:{" "}
              {credential.uvInitialized ? copy.yes : copy.no}
            </div>
          )}
          <Form
            className="d-flex gap-2 mt-3"
            onSubmit={form.handleSubmit(({ label }) => onRename(credential.credentialId, label))}
          >
            <Form.Control aria-label={copy.label} maxLength={100} {...form.register("label")} />
            <Button disabled={renaming} type="submit" variant="secondary">
              {renaming ? (
                <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
              ) : (
                <ActionIcon action="save" />
              )}
              {copy.rename}
            </Button>
          </Form>
        </div>
        <Button
          aria-label={`${copy.remove}: ${credential.label || copy.unnamed}`}
          disabled={removing || renaming}
          onClick={onRemove}
          type="button"
          variant="danger"
        >
          {removing ? (
            <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
          ) : (
            <ActionIcon action="delete" />
          )}
          <span className="d-none d-sm-inline">{copy.remove}</span>
        </Button>
      </div>
    </div>
  );
}
