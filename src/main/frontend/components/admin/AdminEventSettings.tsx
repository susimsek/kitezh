"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { z } from "zod";

import { useDictionary } from "@/i18n/client";
import { adminRequest } from "@/lib/admin-api";
import { useForm } from "@/lib/form";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";

export type EventSettings = {
  eventsEnabled: boolean;
  adminEventsEnabled: boolean;
  adminEventsDetailsEnabled: boolean;
  eventsExpirationDays: number;
};

export default function AdminEventSettings() {
  const dictionary = useDictionary();
  const copy = dictionary.admin.events;
  const validation = dictionary.admin.common.validation;
  const { access, accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState(false);
  const schema = z.object({
    eventsEnabled: z.boolean(),
    adminEventsEnabled: z.boolean(),
    adminEventsDetailsEnabled: z.boolean(),
    eventsExpirationDays: z.number().int().min(0, validation.invalid).max(3650, validation.invalid),
  });
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EventSettings>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      eventsEnabled: true,
      adminEventsEnabled: true,
      adminEventsDetailsEnabled: true,
      eventsExpirationDays: 0,
    },
  });

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<EventSettings>(accessToken, { url: "/api/admin/events/config" })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        reset(response.data);
        setSettingsLoaded(true);
        setSettingsError(false);
      })
      .catch(() => setSettingsError(true));
  }, [accessToken, reset]);

  const saveSettings = handleSubmit(async (values) => {
    if (!accessToken) return;
    setSettingsError(false);
    try {
      const response = await adminRequest<EventSettings>(accessToken, {
        method: "PUT",
        url: "/api/admin/events/config",
        data: values,
      });
      if (response.status >= 300) throw new Error();
      reset(response.data);
      alerts.addAlert(copy.settingsSaved);
    } catch {
      alerts.addError(copy.settingsError);
    }
  });

  return (
    <div className="d-grid gap-4">
      {settingsError && <Alert variant="danger">{copy.settingsError}</Alert>}
      <Card className="admin-panel-card">
        <Card.Body>
          {!settingsLoaded ? (
            <div role="status">{copy.loading}</div>
          ) : (
            <Form noValidate onSubmit={saveSettings}>
              <h2 className="h5 mb-2">{copy.settingsTitle}</h2>
              <p className="text-body-secondary mb-4">{copy.settingsDescription}</p>
              <div className="d-grid gap-3">
                <Form.Check
                  type="switch"
                  disabled={!access?.manageEvents}
                  label={copy.eventsEnabled}
                  {...register("eventsEnabled")}
                />
                <Form.Check
                  type="switch"
                  disabled={!access?.manageEvents}
                  label={copy.adminEventsEnabled}
                  {...register("adminEventsEnabled")}
                />
                <Form.Check
                  type="switch"
                  disabled={!access?.manageEvents}
                  label={copy.adminEventsDetailsEnabled}
                  {...register("adminEventsDetailsEnabled")}
                />
                <Form.Group controlId="event-retention-days">
                  <Form.Label>{copy.eventsExpirationDays}</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    max={3650}
                    isInvalid={Boolean(errors.eventsExpirationDays)}
                    disabled={!access?.manageEvents}
                    {...register("eventsExpirationDays", { valueAsNumber: true })}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.eventsExpirationDays?.message}
                  </Form.Control.Feedback>
                  <Form.Text>{copy.eventsExpirationHint}</Form.Text>
                </Form.Group>
              </div>
              {access?.manageEvents && (
                <div className="admin-form-actions mt-4">
                  <Button disabled={isSubmitting} type="submit">
                    {isSubmitting ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <AdminActionIcon action="save" />
                    )}
                    {copy.saveSettings}
                  </Button>
                </div>
              )}
            </Form>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
