"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { useWatch } from "react-hook-form";
import { z } from "zod";

import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { useDictionary } from "@/i18n/client";
import { adminRequest } from "@/lib/admin-api";
import { useForm } from "@/lib/form";

import { AdminActionIcon } from "./AdminActionIcon";
import { useAdminAuth } from "./AdminAuthProvider";
import { ConfirmModal } from "./ConfirmModal";

type Policy = {
  idleTimeout: string;
  maxLifespan: string | null;
  maxLimited: boolean;
  revokedBefore: string | null;
};

type PolicyForm = {
  idleTimeout: string;
  maxLifespan: string;
  maxLimited: boolean;
};

const isoDuration =
  /^P(?=.+)(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?=.+)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/;

function formValues(policy: Policy): PolicyForm {
  return {
    idleTimeout: policy.idleTimeout,
    maxLifespan: policy.maxLifespan ?? "",
    maxLimited: policy.maxLimited,
  };
}

export default function AdminOfflineAccessSettings() {
  const dictionary = useDictionary();
  const copy = dictionary.admin.offlineAccess;
  const validation = dictionary.admin.common.validation;
  const { access, accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const schema = z
    .object({
      idleTimeout: z.string().trim().regex(isoDuration, validation.invalid),
      maxLifespan: z
        .string()
        .trim()
        .refine((value) => value.length === 0 || isoDuration.test(value), validation.invalid),
      maxLimited: z.boolean(),
    })
    .refine((value) => !value.maxLimited || value.maxLifespan.length > 0, {
      message: validation.invalid,
      path: ["maxLifespan"],
    });
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PolicyForm>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { idleTimeout: "P30D", maxLifespan: "", maxLimited: false },
  });
  const maxLimited = useWatch({ control, name: "maxLimited" });

  useEffect(() => {
    if (!accessToken) return;
    void adminRequest<Policy>(accessToken, { url: "/api/admin/settings/offline-access" })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        reset(formValues(response.data));
        setLoaded(true);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }, [accessToken, reset]);

  const save = handleSubmit(async (values) => {
    if (!accessToken) return;
    setLoadError(false);
    try {
      const response = await adminRequest<Policy>(accessToken, {
        method: "PUT",
        url: "/api/admin/settings/offline-access",
        data: {
          idleTimeout: values.idleTimeout.trim(),
          maxLifespan: values.maxLimited ? values.maxLifespan.trim() || null : null,
          maxLimited: values.maxLimited,
        },
      });
      if (response.status >= 300) throw new Error();
      reset(formValues(response.data));
      alerts.addAlert(copy.saved);
    } catch {
      alerts.addError(copy.error);
    }
  });

  const revokeAll = async () => {
    if (!accessToken) return;
    setRevokeBusy(true);
    try {
      const response = await adminRequest<Policy>(accessToken, {
        method: "POST",
        url: "/api/admin/settings/offline-access/revoke-all",
      });
      if (response.status >= 300) throw new Error();
      reset(formValues(response.data));
      setRevokeOpen(false);
      alerts.addAlert(copy.revoked);
    } catch {
      alerts.addError(copy.error);
    } finally {
      setRevokeBusy(false);
    }
  };

  return (
    <>
      <Card className="admin-panel-card">
        <Card.Body>
          {loadError && <Alert variant="danger">{copy.error}</Alert>}
          {!loaded ? (
            <div role="status">{copy.loading}</div>
          ) : (
            <Form noValidate onSubmit={save}>
              <div className="admin-detail-heading mb-4">
                <div>
                  <h2 className="h5 mb-1">{copy.title}</h2>
                  <p className="text-body-secondary mb-0">{copy.description}</p>
                </div>
                {access?.isAdmin && (
                  <Button disabled={isSubmitting} type="submit">
                    {isSubmitting ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <AdminActionIcon action="save" />
                    )}
                    {copy.save}
                  </Button>
                )}
              </div>
              <div className="d-grid gap-3">
                <Form.Group controlId="offline-idle">
                  <Form.Label>{copy.idleTimeout}</Form.Label>
                  <Form.Control
                    disabled={!access?.isAdmin}
                    isInvalid={Boolean(errors.idleTimeout)}
                    {...register("idleTimeout")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.idleTimeout?.message}
                  </Form.Control.Feedback>
                  <Form.Text>{copy.durationHint}</Form.Text>
                </Form.Group>
                <Form.Check
                  id="offline-max-limited"
                  type="switch"
                  label={copy.maxLimited}
                  disabled={!access?.isAdmin}
                  {...register("maxLimited")}
                />
                <Form.Group controlId="offline-max">
                  <Form.Label>{copy.maxLifespan}</Form.Label>
                  <Form.Control
                    disabled={!access?.isAdmin || !maxLimited}
                    isInvalid={Boolean(errors.maxLifespan)}
                    {...register("maxLifespan")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.maxLifespan?.message}
                  </Form.Control.Feedback>
                  <Form.Text>{copy.durationHint}</Form.Text>
                </Form.Group>
                <div className="d-flex justify-content-between align-items-center gap-3 border-top pt-3">
                  <div>
                    <div className="fw-semibold">{copy.revokeAllTitle}</div>
                    <div className="small text-body-secondary">{copy.revokeAllHelp}</div>
                  </div>
                  {access?.isAdmin && (
                    <Button
                      variant="danger"
                      disabled={isSubmitting || revokeBusy}
                      onClick={() => setRevokeOpen(true)}
                    >
                      <AdminActionIcon action="revoke" />
                      {copy.revokeAll}
                    </Button>
                  )}
                </div>
              </div>
            </Form>
          )}
        </Card.Body>
      </Card>
      <ConfirmModal
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={copy.revokeAll}
        busy={revokeBusy}
        message={copy.revokeAllConfirm}
        onCancel={() => setRevokeOpen(false)}
        onConfirm={() => void revokeAll()}
        show={revokeOpen}
      />
    </>
  );
}
