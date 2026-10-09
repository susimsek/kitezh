"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Spinner, Stack } from "react-bootstrap";
import type { Dictionary } from "@/i18n/get-dictionary";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { RecoveryCodesActions } from "@/components/shared/RecoveryCodesActions";
import {
  TotpSetupDetails,
  type TotpSetupDetails as TotpSetupDetailsData,
} from "@/components/shared/TotpSetupDetails";
import { useAccountAuth } from "./AccountAuthProvider";

type Status = {
  enabled: boolean;
  available: boolean;
  required: boolean;
  issuer: string;
  digits: number;
  warningThreshold?: number;
};
type Setup = TotpSetupDetailsData;

export function MfaSettings({ dictionary }: { dictionary: Dictionary }) {
  const { accessToken, clearLocalSession } = useAccountAuth();
  const copy = dictionary.account.security.mfa;
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryRemaining, setRecoveryRemaining] = useState<number | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/account/mfa", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const value = (await response.json()) as Status;
        setStatus(value);
        if (!value.enabled) return null;
        return fetch("/api/account/mfa/recovery-codes", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      })
      .then(async (response) => {
        if (!response || !response.ok) return;
        const value = (await response.json()) as {
          remaining: number;
          warningThreshold: number;
        };
        setRecoveryRemaining(value.remaining);
        setStatus((current) =>
          current ? { ...current, warningThreshold: value.warningThreshold } : current,
        );
      })
      .catch(() => setError(copy.error));
  }, [accessToken, copy.error]);
  if (!status || !status.available) return null;
  const setupMfa = async () => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/mfa/setup", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error(await responseError(response, copy.error));
      setSetup(await response.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.error);
    } finally {
      setBusy(false);
    }
  };
  const generateRecoveryCodes = async () => {
    if (!accessToken || !status.enabled) return;
    setRecoveryBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/mfa/recovery-codes", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error(await responseError(response, copy.recoveryError));
      const value = (await response.json()) as { codes: string[]; remaining: number };
      setRecoveryCodes(value.codes);
      setRecoveryRemaining(value.remaining);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.recoveryError);
    } finally {
      setRecoveryBusy(false);
    }
  };

  const mutate = async (url: string) => {
    const expectedDigits = setup?.digits ?? status.digits;
    if (!accessToken || !new RegExp(`^\\d{${expectedDigits}}$`).test(code)) {
      setCodeError(copy.invalidCode);
      return;
    }
    setBusy(true);
    setError(null);
    setCodeError(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        if (response.status === 400) {
          setCodeError(await responseError(response, copy.invalidCode));
          return;
        }
        throw new Error(await responseError(response, copy.error));
      }
      setCode("");
      setSetup(null);
      clearLocalSession();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="admin-panel-card account-panel-card">
      <Card.Header className="bg-body p-4 border-bottom">
        <h2 className="h5 mb-1">{copy.title}</h2>
        <div className="small text-body-secondary">{copy.help}</div>
      </Card.Header>
      <Card.Body className="p-4">
        <Stack gap={3}>
          {error && <Alert variant="danger">{error}</Alert>}
          {status.enabled ? (
            <>
              <Alert variant="success">{copy.enabled}</Alert>
              <Form.Control
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={status.digits}
                isInvalid={Boolean(codeError)}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setCodeError(null);
                }}
                placeholder={copy.code}
              />
              <Form.Control.Feedback type="invalid">{codeError}</Form.Control.Feedback>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => void mutate("/api/account/mfa/disable")}
              >
                {busy ? (
                  <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                ) : (
                  <ActionIcon action="delete" />
                )}
                {copy.disable}
              </Button>
            </>
          ) : (
            <>
              {!setup && (
                <Button disabled={busy} onClick={() => void setupMfa()}>
                  {busy ? (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  ) : (
                    <ActionIcon action="add" />
                  )}
                  {copy.setup}
                </Button>
              )}
              {setup && (
                <>
                  <TotpSetupDetails
                    setup={setup}
                    copy={{
                      qrTitle: copy.qrTitle,
                      unableToScan: copy.unableToScan,
                      scanBarcode: copy.scanBarcode,
                      secret: copy.secret,
                      type: copy.type,
                      typeTotp: copy.typeTotp,
                      algorithm: copy.algorithm,
                      digits: copy.digits,
                      period: copy.period,
                    }}
                  />
                  <Form.Control
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={setup.digits}
                    isInvalid={Boolean(codeError)}
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value);
                      setCodeError(null);
                    }}
                    placeholder={copy.code}
                  />
                  <Form.Control.Feedback type="invalid">{codeError}</Form.Control.Feedback>
                  <Button disabled={busy} onClick={() => void mutate("/api/account/mfa/enable")}>
                    {busy ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <ActionIcon action="check" />
                    )}
                    {copy.enable}
                  </Button>
                </>
              )}
            </>
          )}
          <hr className="my-1" />
          <div>
            <h3 className="h6 mb-1">{copy.recoveryTitle}</h3>
            <p className="small text-body-secondary mb-3">{copy.recoveryHelp}</p>
            {!status.enabled ? (
              <Alert variant="info" className="mb-0">
                {copy.recoveryDisabled}
              </Alert>
            ) : (
              <Stack gap={2}>
                {recoveryCodes ? (
                  <>
                    <Alert variant="warning" className="mb-0">
                      {copy.recoveryCodesReady}
                    </Alert>
                    <div className="bg-body-tertiary rounded p-3 font-monospace small">
                      {recoveryCodes.map((value) => (
                        <div key={value}>{value}</div>
                      ))}
                    </div>
                    <RecoveryCodesActions
                      codes={recoveryCodes}
                      labels={{
                        copy: copy.recoveryCopy,
                        copied: copy.recoveryCopied,
                        download: copy.recoveryDownload,
                        print: copy.recoveryPrint,
                      }}
                    />
                  </>
                ) : recoveryRemaining !== null ? (
                  <>
                    <div className="small text-body-secondary">
                      {copy.recoveryRemaining.replace("{{count}}", String(recoveryRemaining))}
                    </div>
                    {recoveryRemaining <= (status.warningThreshold ?? 0) && (
                      <Alert variant="warning" className="mb-0">
                        {copy.recoveryWarning.replace("{{count}}", String(recoveryRemaining))}
                      </Alert>
                    )}
                  </>
                ) : null}
                <Button
                  variant="primary"
                  disabled={recoveryBusy}
                  onClick={() => void generateRecoveryCodes()}
                >
                  {recoveryBusy ? (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  ) : (
                    <ActionIcon action="regenerate" />
                  )}
                  {recoveryCodes ? copy.recoveryRegenerate : copy.recoveryGenerate}
                </Button>
              </Stack>
            )}
          </div>
        </Stack>
      </Card.Body>
    </Card>
  );
}

async function responseError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === "string" && body.detail.trim() ? body.detail : fallback;
  } catch {
    return fallback;
  }
}
