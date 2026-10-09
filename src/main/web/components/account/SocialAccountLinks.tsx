"use client";

import { useEffect, useState } from "react";
import { Button, Card, Spinner, Stack } from "react-bootstrap";
import { useSearchParams } from "@/routing/navigation";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { Icon } from "@/components/shared/Icon";
import { providerIcon } from "@/lib/provider-icons";
import type { Dictionary } from "@/i18n/get-dictionary";
import { requestAccount } from "@/lib/account-api";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { useAccountAuth } from "./AccountAuthProvider";

type SocialLink = {
  provider: string;
  displayName: string;
  iconKey: string;
  linked: boolean;
  configured: boolean;
  enabled: boolean;
};

export function SocialAccountLinks({ dictionary }: { dictionary: Dictionary }) {
  const { accessToken } = useAccountAuth();
  const copy = dictionary.account.security.socialLinks;
  const searchParams = useSearchParams();
  const alerts = useConsoleAlerts();
  const [links, setLinks] = useState<SocialLink[] | null>(null);
  const [error, setError] = useState(false);
  const [startingProvider, setStartingProvider] = useState<string | null>(null);
  const [pending, setPending] = useState<SocialLink | null>(null);
  const [removingProvider, setRemovingProvider] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    void requestAccount<SocialLink[]>(accessToken, {
      method: "GET",
      url: "/api/account/social-links",
    })
      .then(setLinks)
      .catch(() => setError(true));
  }, [accessToken]);

  useEffect(() => {
    if (searchParams.get("social_linked") === "1") {
      alerts.addAlert(copy.success);
    }
  }, [alerts, copy.success, searchParams]);

  const startLink = (provider: string) => {
    setStartingProvider(provider);
    window.open(`/account/social-links/${encodeURIComponent(provider)}/start`, "_self");
  };

  const removeLink = async () => {
    if (!accessToken || !pending) return;
    const provider = pending.provider;
    setRemovingProvider(provider);
    try {
      await requestAccount<void>(accessToken, {
        method: "DELETE",
        url: `/api/account/social-links/${encodeURIComponent(provider)}`,
      });
      setLinks((current) =>
        current === null
          ? null
          : current.map((link) => (link.provider === provider ? { ...link, linked: false } : link)),
      );
      setPending(null);
      alerts.addAlert(copy.removeSuccess);
    } catch {
      alerts.addError(copy.removeError);
    } finally {
      setRemovingProvider(null);
    }
  };

  return (
    <Card className="admin-panel-card account-panel-card">
      <Card.Header className="bg-body p-4 border-bottom">
        <h2 className="h5 mb-1">{copy.title}</h2>
        <div className="small text-body-secondary">{copy.help}</div>
      </Card.Header>
      <Card.Body className="p-4">
        {error && <div className="alert alert-danger">{copy.error}</div>}
        {!links && !error ? (
          <div className="d-flex align-items-center gap-2" role="status">
            <Spinner animation="border" size="sm" />
            <span>{dictionary.account.common.loading}</span>
          </div>
        ) : (
          <Stack gap={2}>
            {(links ?? []).map((link) => (
              <div
                className="d-flex align-items-center justify-content-between gap-3 border rounded-2 p-3"
                key={link.provider}
              >
                <div className="d-flex align-items-center gap-3">
                  <Icon icon={providerIcon(link.iconKey)} size="lg" />
                  <div>
                    <div className="fw-semibold">{link.displayName}</div>
                    <div className="small text-body-secondary">
                      {link.linked
                        ? copy.connected
                        : !link.configured
                          ? copy.notConfigured
                          : copy.notConnected}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={link.linked ? "danger" : "primary"}
                  disabled={
                    ((!link.configured || !link.enabled) && !link.linked) ||
                    startingProvider !== null ||
                    removingProvider !== null
                  }
                  onClick={() => {
                    if (!link.linked && (!link.configured || !link.enabled)) return;
                    if (link.linked) setPending(link);
                    else startLink(link.provider);
                  }}
                >
                  {(startingProvider === link.provider || removingProvider === link.provider) && (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  )}
                  {link.linked ? copy.remove : copy.connect}
                  {!link.linked && startingProvider !== link.provider && (
                    <ActionIcon action="assign" className="ms-2" />
                  )}
                  {link.linked && removingProvider !== link.provider && (
                    <ActionIcon action="remove" className="ms-2" />
                  )}
                </Button>
              </div>
            ))}
          </Stack>
        )}
      </Card.Body>
      <ConfirmModal
        show={pending !== null}
        message={copy.removeConfirm}
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={copy.remove}
        busy={removingProvider !== null}
        onCancel={() => setPending(null)}
        onConfirm={() => void removeLink()}
      />
    </Card>
  );
}
