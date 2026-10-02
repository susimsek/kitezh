"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { z } from "zod";

import { BrandLogo } from "@/components/shared/BrandLogo";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { useDictionary } from "@/i18n/client";
import { adminRequest } from "@/lib/admin-api";
import { useForm } from "@/lib/form";

import { AdminActionIcon } from "./AdminActionIcon";
import { useAdminAuth } from "./AdminAuthProvider";

type BrandingSettings = {
  applicationName: string;
  logoPath: string;
  faviconPath: string;
  appleTouchIconPath: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
};

const defaultSettings: BrandingSettings = {
  applicationName: "Authorization Server",
  logoPath: "/brand/logo.svg",
  faviconPath: "/favicon.ico",
  appleTouchIconPath: "/apple-icon.png",
  primaryColor: "#0d6efd",
  accentColor: "#0b2b69",
  backgroundColor: "#f8f9fa",
};

export default function AdminBrandingSettings() {
  const dictionary = useDictionary();
  const copy = dictionary.admin.branding;
  const validation = dictionary.admin.common.validation;
  const { accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const [loadedSettings, setLoadedSettings] = useState<BrandingSettings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const schema = z.object({
    applicationName: z.string().trim().min(1, validation.required).max(100, validation.invalid),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, validation.invalid),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, validation.invalid),
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, validation.invalid),
  });
  const {
    register,
    reset,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<
    Pick<BrandingSettings, "applicationName" | "primaryColor" | "accentColor" | "backgroundColor">
  >({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: defaultSettings,
  });
  const primaryColor = watch("primaryColor");
  const accentColor = watch("accentColor");
  const backgroundColor = watch("backgroundColor");

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<BrandingSettings>(accessToken, { url: "/api/admin/settings/branding" })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setLoadedSettings(response.data);
        reset(response.data);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }, [accessToken, reset]);

  const save = handleSubmit(async (values) => {
    if (!accessToken) return;
    setLoadError(false);
    try {
      const response = await adminRequest<BrandingSettings>(accessToken, {
        method: "PUT",
        url: "/api/admin/settings/branding",
        data: values,
      });
      if (response.status >= 300) throw new Error();
      setLoadedSettings(response.data);
      reset(response.data);
      window.dispatchEvent(new Event("branding-updated"));
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
          {!loadedSettings ? (
            <div role="status">{copy.loading}</div>
          ) : (
            <Form noValidate onSubmit={save}>
              <h2 className="h5 mb-2">{copy.title}</h2>
              <p className="text-body-secondary mb-4">{copy.subtitle}</p>
              <div className="d-grid gap-3">
                <Form.Group controlId="branding-application-name">
                  <Form.Label>{copy.applicationName}</Form.Label>
                  <Form.Control
                    type="text"
                    isInvalid={Boolean(errors.applicationName)}
                    {...register("applicationName")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.applicationName?.message}
                  </Form.Control.Feedback>
                  <Form.Text>{copy.applicationNameHint}</Form.Text>
                </Form.Group>
                <Form.Group controlId="branding-primary-color">
                  <Form.Label>{copy.primaryColor}</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="#0d6efd"
                    isInvalid={Boolean(errors.primaryColor)}
                    {...register("primaryColor")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.primaryColor?.message}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Group controlId="branding-accent-color">
                  <Form.Label>{copy.accentColor}</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="#0b2b69"
                    isInvalid={Boolean(errors.accentColor)}
                    {...register("accentColor")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.accentColor?.message}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Group controlId="branding-background-color">
                  <Form.Label>{copy.backgroundColor}</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="#f8f9fa"
                    isInvalid={Boolean(errors.backgroundColor)}
                    {...register("backgroundColor")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.backgroundColor?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </div>
              <div className="admin-form-actions mt-4">
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  ) : (
                    <AdminActionIcon action="save" />
                  )}
                  {copy.save}
                </Button>
              </div>
            </Form>
          )}
        </Card.Body>
      </Card>
      {loadedSettings && (
        <Card className="admin-panel-card">
          <Card.Body>
            <h2 className="h5 mb-2">{copy.previewTitle}</h2>
            <p className="text-body-secondary mb-4">{copy.previewSubtitle}</p>
            <div
              className="branding-preview rounded-3 p-4 d-flex align-items-center gap-3"
              style={{ backgroundColor }}
            >
              <span className="admin-brand-mark" style={{ backgroundColor: accentColor }}>
                <BrandLogo size={36} />
              </span>
              <strong style={{ color: primaryColor }}>{watch("applicationName")}</strong>
            </div>
            <dl className="row mt-4 mb-0">
              <dt className="col-sm-4">{copy.logoPath}</dt>
              <dd className="col-sm-8 font-monospace text-break">{loadedSettings.logoPath}</dd>
              <dt className="col-sm-4">{copy.faviconPath}</dt>
              <dd className="col-sm-8 font-monospace text-break">{loadedSettings.faviconPath}</dd>
              <dt className="col-sm-4">{copy.appleTouchIconPath}</dt>
              <dd className="col-sm-8 font-monospace text-break mb-0">
                {loadedSettings.appleTouchIconPath}
              </dd>
            </dl>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
