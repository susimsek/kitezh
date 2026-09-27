"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useFieldArray } from "react-hook-form";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { z } from "zod";

import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { useDictionary } from "@/i18n/client";
import { adminRequest } from "@/lib/admin-api";
import { useForm } from "@/lib/form";

import { AdminActionIcon } from "./AdminActionIcon";
import { useAdminAuth } from "./AdminAuthProvider";

type Provider = {
  id?: string;
  name: string;
  enabled: boolean;
  priority: number;
  connectionUrl: string;
  bindDn: string;
  bindPassword: string;
  bindPasswordConfigured?: boolean;
  usersDn: string;
  usernameAttribute: string;
  uuidAttribute: string;
  emailAttribute: string;
  firstNameAttribute: string;
  lastNameAttribute: string;
  rdnAttribute: string;
  objectClasses: string;
  searchScope: "OBJECT" | "ONE_LEVEL" | "SUBTREE";
  editMode: "READ_ONLY" | "WRITABLE" | "UNSYNCED";
  importUsers: boolean;
  trustEmail: boolean;
};

type FormValues = { providers: Provider[] };
const emptyProvider: Provider = {
  name: "",
  enabled: false,
  priority: 100,
  connectionUrl: "ldaps://",
  bindDn: "",
  bindPassword: "",
  usersDn: "",
  usernameAttribute: "sAMAccountName",
  uuidAttribute: "objectGUID",
  emailAttribute: "mail",
  firstNameAttribute: "givenName",
  lastNameAttribute: "sn",
  rdnAttribute: "sAMAccountName",
  objectClasses: "person,user",
  searchScope: "SUBTREE",
  editMode: "READ_ONLY",
  importUsers: true,
  trustEmail: false,
};

export default function LdapFederationSettings() {
  const dictionary = useDictionary();
  const copy = dictionary.admin.ldapFederation;
  const validation = dictionary.admin.common.validation;
  const { accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [testingIndex, setTestingIndex] = useState<number | null>(null);
  const providerSchema = z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1, validation.required).max(100),
    enabled: z.boolean(),
    priority: z.number().int().min(0, validation.positiveNumber).max(10000),
    connectionUrl: z
      .string()
      .trim()
      .regex(/^ldaps?:\/\/\S+$/i, copy.invalidUrl),
    bindDn: z.string().max(500),
    bindPassword: z.string().max(2000),
    bindPasswordConfigured: z.boolean().optional(),
    usersDn: z.string().trim().min(1, validation.required).max(1000),
    usernameAttribute: z.string().trim().min(1, validation.required).max(100),
    uuidAttribute: z.string().trim().min(1, validation.required).max(100),
    emailAttribute: z.string().trim().min(1, validation.required).max(100),
    firstNameAttribute: z.string().trim().min(1, validation.required).max(100),
    lastNameAttribute: z.string().trim().min(1, validation.required).max(100),
    rdnAttribute: z.string().trim().min(1, validation.required).max(100),
    objectClasses: z.string().trim().min(1, validation.required).max(1000),
    searchScope: z.enum(["OBJECT", "ONE_LEVEL", "SUBTREE"]),
    editMode: z.enum(["READ_ONLY", "WRITABLE", "UNSYNCED"]),
    importUsers: z.boolean(),
    trustEmail: z.boolean(),
  });
  const schema = z.object({ providers: z.array(providerSchema).max(20) });
  const {
    register,
    control,
    reset,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { providers: [emptyProvider] },
    mode: "onChange",
  });
  const { fields, append, remove } = useFieldArray({ control, name: "providers" });
  const normalizeProvider = (provider: Provider): Provider => ({
    ...provider,
    usernameAttribute: provider.usernameAttribute || emptyProvider.usernameAttribute,
    emailAttribute: provider.emailAttribute || emptyProvider.emailAttribute,
  });

  const appendProvider = () => {
    append({ ...emptyProvider });
  };

  const removeProvider = (index: number) => {
    remove(index);
  };

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<Provider[]>(accessToken, { url: "/api/admin/settings/ldap" })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        reset({
          providers: response.data.map((provider) =>
            normalizeProvider({ ...provider, bindPassword: "" }),
          ),
        });
        setLoaded(true);
      })
      .catch(() => setError(true));
  }, [accessToken, reset]);

  const save = handleSubmit(async (values) => {
    if (!accessToken) return;
    setError(false);
    try {
      const response = await adminRequest<Provider[]>(accessToken, {
        method: "PUT",
        url: "/api/admin/settings/ldap",
        data: {
          providers: values.providers.map((provider) => normalizeProvider(provider)),
        },
      });
      if (response.status >= 300) throw new Error();
      reset({
        providers: response.data.map((provider) =>
          normalizeProvider({ ...provider, bindPassword: "" }),
        ),
      });
      alerts.addAlert(copy.saved);
    } catch {
      setError(true);
      alerts.addError(copy.error);
    }
  });

  const test = async (index: number) => {
    if (!accessToken) return;
    setTestingIndex(index);
    setError(false);
    try {
      const response = await adminRequest(accessToken, {
        method: "POST",
        url: "/api/admin/settings/ldap/test",
        data: {
          provider: normalizeProvider(getValues(`providers.${index}`)),
        },
      });
      if (response.status >= 300) throw new Error();
      alerts.addAlert(copy.testSucceeded);
    } catch {
      setError(true);
      alerts.addError(copy.testFailed);
    } finally {
      setTestingIndex(null);
    }
  };

  return (
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
              <Button type="button" variant="primary" onClick={appendProvider}>
                <AdminActionIcon action="add" /> {copy.add}
              </Button>
            </div>
            {error && <Alert variant="danger">{copy.error}</Alert>}
            <div className="d-grid gap-4">
              {fields.map((field, index) => {
                const fieldErrors = errors.providers?.[index];
                const path = (name: keyof Provider) => `providers.${index}.${name}` as const;
                return (
                  <Card key={field.id} className="admin-panel-card">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h3 className="h6 mb-0">
                          {copy.provider} {index + 1}
                        </h3>
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => removeProvider(index)}
                        >
                          <AdminActionIcon action="delete" /> {copy.remove}
                        </Button>
                      </div>
                      <div className="d-grid gap-3">
                        <Form.Group controlId={`ldap-${index}-name`}>
                          <Form.Label>{copy.name}</Form.Label>
                          <Form.Control
                            isInvalid={Boolean(fieldErrors?.name)}
                            {...register(path("name"))}
                          />
                          <Form.Control.Feedback type="invalid">
                            {fieldErrors?.name?.message}
                          </Form.Control.Feedback>
                        </Form.Group>
                        <Form.Group controlId={`ldap-${index}-url`}>
                          <Form.Label>{copy.connectionUrl}</Form.Label>
                          <Form.Control
                            isInvalid={Boolean(fieldErrors?.connectionUrl)}
                            {...register(path("connectionUrl"))}
                          />
                          <Form.Control.Feedback type="invalid">
                            {fieldErrors?.connectionUrl?.message}
                          </Form.Control.Feedback>
                        </Form.Group>
                        <Form.Group controlId={`ldap-${index}-bind-dn`}>
                          <Form.Label>{copy.bindDn}</Form.Label>
                          <Form.Control {...register(path("bindDn"))} />
                        </Form.Group>
                        <Form.Group controlId={`ldap-${index}-bind-password`}>
                          <Form.Label>{copy.bindPassword}</Form.Label>
                          <Form.Control
                            type="password"
                            autoComplete="new-password"
                            placeholder={
                              field.bindPasswordConfigured ? copy.keepPassword : undefined
                            }
                            {...register(path("bindPassword"))}
                          />
                        </Form.Group>
                        <Form.Group controlId={`ldap-${index}-users-dn`}>
                          <Form.Label>{copy.usersDn}</Form.Label>
                          <Form.Control
                            isInvalid={Boolean(fieldErrors?.usersDn)}
                            {...register(path("usersDn"))}
                          />
                          <Form.Control.Feedback type="invalid">
                            {fieldErrors?.usersDn?.message}
                          </Form.Control.Feedback>
                        </Form.Group>
                        <div className="d-grid gap-3">
                          <Form.Group controlId={`ldap-${index}-usernameAttribute`}>
                            <Form.Label>{copy.usernameAttribute}</Form.Label>
                            <Form.Control
                              isInvalid={Boolean(fieldErrors?.usernameAttribute)}
                              {...register(path("usernameAttribute"))}
                            />
                            <Form.Control.Feedback type="invalid">
                              {fieldErrors?.usernameAttribute?.message}
                            </Form.Control.Feedback>
                          </Form.Group>
                          <Form.Group controlId={`ldap-${index}-uuidAttribute`}>
                            <Form.Label>{copy.uuidAttribute}</Form.Label>
                            <Form.Control
                              isInvalid={Boolean(fieldErrors?.uuidAttribute)}
                              {...register(`providers.${index}.uuidAttribute`)}
                            />
                            <Form.Control.Feedback type="invalid">
                              {fieldErrors?.uuidAttribute?.message}
                            </Form.Control.Feedback>
                          </Form.Group>
                          <Form.Group controlId={`ldap-${index}-emailAttribute`}>
                            <Form.Label>{copy.emailAttribute}</Form.Label>
                            <Form.Control
                              isInvalid={Boolean(fieldErrors?.emailAttribute)}
                              {...register(path("emailAttribute"))}
                            />
                            <Form.Control.Feedback type="invalid">
                              {fieldErrors?.emailAttribute?.message}
                            </Form.Control.Feedback>
                          </Form.Group>
                          {(
                            ["firstNameAttribute", "lastNameAttribute", "rdnAttribute"] as const
                          ).map((name) => (
                            <Form.Group controlId={`ldap-${index}-${name}`} key={name}>
                              <Form.Label>{copy[name]}</Form.Label>
                              <Form.Control
                                isInvalid={Boolean(fieldErrors?.[name])}
                                {...register(path(name))}
                              />
                              <Form.Control.Feedback type="invalid">
                                {fieldErrors?.[name]?.message}
                              </Form.Control.Feedback>
                            </Form.Group>
                          ))}
                        </div>
                        <Form.Group controlId={`ldap-${index}-object-classes`}>
                          <Form.Label>{copy.objectClasses}</Form.Label>
                          <Form.Control {...register(path("objectClasses"))} />
                        </Form.Group>
                        <div className="d-grid gap-3">
                          <Form.Group controlId={`ldap-${index}-scope`}>
                            <Form.Label>{copy.searchScope}</Form.Label>
                            <Form.Select {...register(path("searchScope"))}>
                              <option value="SUBTREE">{copy.subtree}</option>
                              <option value="ONE_LEVEL">{copy.oneLevel}</option>
                              <option value="OBJECT">{copy.object}</option>
                            </Form.Select>
                          </Form.Group>
                          <Form.Group controlId={`ldap-${index}-edit-mode`}>
                            <Form.Label>{copy.editMode}</Form.Label>
                            <Form.Select {...register(path("editMode"))}>
                              <option value="READ_ONLY">{copy.readOnly}</option>
                              <option value="WRITABLE">{copy.writable}</option>
                              <option value="UNSYNCED">{copy.unsynced}</option>
                            </Form.Select>
                          </Form.Group>
                        </div>
                        <Form.Check
                          type="switch"
                          label={copy.enabled}
                          {...register(path("enabled"))}
                        />
                        <Form.Check
                          type="switch"
                          label={copy.importUsers}
                          {...register(path("importUsers"))}
                        />
                        <Form.Check
                          type="switch"
                          label={copy.trustEmail}
                          {...register(path("trustEmail"))}
                        />
                        <Form.Group controlId={`ldap-${index}-priority`}>
                          <Form.Label>{copy.priority}</Form.Label>
                          <Form.Control
                            type="number"
                            min={0}
                            {...register(path("priority"), { valueAsNumber: true })}
                          />
                        </Form.Group>
                      </div>
                      <div className="admin-form-actions mt-4">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={testingIndex !== null}
                          onClick={() => test(index)}
                        >
                          {testingIndex === index ? (
                            <Spinner
                              animation="border"
                              size="sm"
                              aria-hidden="true"
                              className="me-2"
                            />
                          ) : (
                            <AdminActionIcon action="check" />
                          )}
                          {copy.test}
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                );
              })}
            </div>
            <div className="admin-form-actions mt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Spinner animation="border" size="sm" aria-hidden="true" className="me-2" />
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
  );
}
