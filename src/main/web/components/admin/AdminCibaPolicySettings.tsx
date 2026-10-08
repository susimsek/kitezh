"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { z } from "zod";

import { useDictionary } from "@/i18n/client";
import { adminRequest } from "@/lib/admin-api";
import { useForm } from "@/lib/form";

import { AdminActionIcon } from "./AdminActionIcon";
import { useAdminAuth } from "./AdminAuthProvider";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";

type CibaPolicy = {
  requestLifespanSeconds: number;
  pollingIntervalSeconds: number;
  deliveryMode: "all" | "poll" | "ping" | "push";
  userVerification: "required" | "preferred" | "discouraged";
  mfaRequired: boolean;
  stepUpRequired: boolean;
  stepUpAcr: string | null;
};
type CibaPolicyForm = Omit<CibaPolicy, "stepUpAcr"> & { stepUpAcr: string };

export default function AdminCibaPolicySettings() {
  const dictionary = useDictionary();
  const copy = dictionary.admin.ciba;
  const validation = dictionary.admin.common.validation;
  const { access, accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const schema = z.object({
    requestLifespanSeconds: z
      .number()
      .int()
      .min(30, validation.invalid)
      .max(3600, validation.invalid),
    pollingIntervalSeconds: z
      .number()
      .int()
      .min(1, validation.invalid)
      .max(300, validation.invalid),
    deliveryMode: z.enum(["all", "poll", "ping", "push"]),
    userVerification: z.enum(["required", "preferred", "discouraged"]),
    mfaRequired: z.boolean(),
    stepUpRequired: z.boolean(),
    stepUpAcr: z.string().max(100, validation.invalid),
  });
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CibaPolicyForm>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      requestLifespanSeconds: 300,
      pollingIntervalSeconds: 5,
      deliveryMode: "all",
      userVerification: "preferred",
      mfaRequired: false,
      stepUpRequired: false,
      stepUpAcr: "",
    },
  });

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<CibaPolicy>(accessToken, { url: "/api/admin/settings/ciba-policy" })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        reset({ ...response.data, stepUpAcr: response.data.stepUpAcr ?? "" });
        setLoaded(true);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }, [accessToken, reset]);

  const save = handleSubmit(async (values) => {
    if (!accessToken) return;
    setLoadError(false);
    try {
      const response = await adminRequest<CibaPolicy>(accessToken, {
        method: "PUT",
        url: "/api/admin/settings/ciba-policy",
        data: { ...values, stepUpAcr: values.stepUpAcr.trim() || null },
      });
      if (response.status >= 300) throw new Error();
      reset({ ...response.data, stepUpAcr: response.data.stepUpAcr ?? "" });
      alerts.addAlert(copy.saved);
    } catch {
      alerts.addError(copy.error);
    }
  });

  return (
    <div className="d-grid gap-4">
      {loadError && <Alert variant="danger">{copy.error}</Alert>}
      <Card className="admin-panel-card">
        <Card.Body>
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
                <Form.Group controlId="ciba-request-lifespan">
                  <Form.Label>{copy.requestLifespan}</Form.Label>
                  <Form.Control
                    type="number"
                    min={30}
                    max={3600}
                    isInvalid={Boolean(errors.requestLifespanSeconds)}
                    disabled={!access?.isAdmin}
                    {...register("requestLifespanSeconds", { valueAsNumber: true })}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.requestLifespanSeconds?.message}
                  </Form.Control.Feedback>
                  <Form.Text>{copy.requestLifespanHint}</Form.Text>
                </Form.Group>
                <Form.Group controlId="ciba-polling-interval">
                  <Form.Label>{copy.pollingInterval}</Form.Label>
                  <Form.Control
                    type="number"
                    min={1}
                    max={300}
                    isInvalid={Boolean(errors.pollingIntervalSeconds)}
                    disabled={!access?.isAdmin}
                    {...register("pollingIntervalSeconds", { valueAsNumber: true })}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.pollingIntervalSeconds?.message}
                  </Form.Control.Feedback>
                  <Form.Text>{copy.pollingIntervalHint}</Form.Text>
                </Form.Group>
                <Form.Group controlId="ciba-delivery-mode">
                  <Form.Label>{copy.deliveryMode}</Form.Label>
                  <Form.Select disabled={!access?.isAdmin} {...register("deliveryMode")}>
                    <option value="all">{copy.deliveryModes.all}</option>
                    <option value="poll">{copy.deliveryModes.poll}</option>
                    <option value="ping">{copy.deliveryModes.ping}</option>
                    <option value="push">{copy.deliveryModes.push}</option>
                  </Form.Select>
                  <Form.Text>{copy.deliveryModeHint}</Form.Text>
                </Form.Group>
                <Form.Group controlId="ciba-user-verification">
                  <Form.Label>{copy.userVerification}</Form.Label>
                  <Form.Select disabled={!access?.isAdmin} {...register("userVerification")}>
                    <option value="required">{copy.userVerificationModes.required}</option>
                    <option value="preferred">{copy.userVerificationModes.preferred}</option>
                    <option value="discouraged">{copy.userVerificationModes.discouraged}</option>
                  </Form.Select>
                  <Form.Text>{copy.userVerificationHint}</Form.Text>
                </Form.Group>
                <Form.Check
                  type="switch"
                  label={copy.mfaRequired}
                  disabled={!access?.isAdmin}
                  {...register("mfaRequired")}
                />
                <Form.Check
                  type="switch"
                  label={copy.stepUpRequired}
                  disabled={!access?.isAdmin}
                  {...register("stepUpRequired")}
                />
                <Form.Group controlId="ciba-step-up-acr">
                  <Form.Label>{copy.stepUpAcr}</Form.Label>
                  <Form.Control
                    type="text"
                    maxLength={100}
                    isInvalid={Boolean(errors.stepUpAcr)}
                    disabled={!access?.isAdmin}
                    {...register("stepUpAcr")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.stepUpAcr?.message}
                  </Form.Control.Feedback>
                  <Form.Text>{copy.stepUpAcrHint}</Form.Text>
                </Form.Group>
              </div>
            </Form>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
