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
  vendor: "LDAP" | "ACTIVE_DIRECTORY";
  authenticationType: "SIMPLE" | "KERBEROS";
  startTls: boolean;
  trustStorePath: string;
  trustStorePassword: string;
  trustStoreType: "JKS" | "PKCS12";
  connectionPooling: boolean;
  referral: "FOLLOW" | "IGNORE" | "THROW";
  connectTimeoutMs: number;
  readTimeoutMs: number;
  batchSize: number;
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
  syncRegistrations: boolean;
  fullSyncIntervalMinutes: number;
  changedSyncIntervalMinutes: number;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  lastSyncError?: string;
  lastSyncImported?: number;
  lastSyncUpdated?: number;
};

type MapperType =
  | "USER_ATTRIBUTE"
  | "FULL_NAME"
  | "HARDCODED_ATTRIBUTE"
  | "ROLE"
  | "GROUP"
  | "HARDCODED_ROLE"
  | "MSAD_USER_ACCOUNT"
  | "CERTIFICATE";

type Mapper = {
  id?: number;
  name: string;
  type: MapperType;
  enabled: boolean;
  ldapAttribute: string;
  userAttribute: string;
  hardcodedValue: string;
  targetName: string;
  groupSearchBase: string;
  groupObjectClass: string;
  groupNameAttribute: string;
  groupMemberAttribute: string;
};

type FormValues = { providers: Provider[] };
const emptyProvider: Provider = {
  name: "",
  enabled: false,
  priority: 100,
  connectionUrl: "ldaps://",
  vendor: "ACTIVE_DIRECTORY",
  authenticationType: "SIMPLE",
  startTls: false,
  trustStorePath: "",
  trustStorePassword: "",
  trustStoreType: "JKS",
  connectionPooling: false,
  referral: "THROW",
  connectTimeoutMs: 5000,
  readTimeoutMs: 5000,
  batchSize: 500,
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
  syncRegistrations: false,
  fullSyncIntervalMinutes: 0,
  changedSyncIntervalMinutes: 0,
};

const emptyMapper: Mapper = {
  name: "",
  type: "USER_ATTRIBUTE",
  enabled: true,
  ldapAttribute: "",
  userAttribute: "",
  hardcodedValue: "",
  targetName: "",
  groupSearchBase: "",
  groupObjectClass: "groupOfNames",
  groupNameAttribute: "cn",
  groupMemberAttribute: "member",
};

type MapperCopy = {
  mappers: string;
  mapperDescription: string;
  addMapper: string;
  mapperName: string;
  mapperType: string;
  ldapAttribute: string;
  userAttribute: string;
  hardcodedValue: string;
  targetName: string;
  groupSearchBase: string;
  groupObjectClass: string;
  groupNameAttribute: string;
  groupMemberAttribute: string;
  mapperEnabled: string;
  saveMapper: string;
  updateMapper: string;
  deleteMapper: string;
  mapperError: string;
};

function LdapMapperPanel({
  accessToken,
  providerId,
  copy,
}: {
  accessToken: string;
  providerId: string;
  copy: MapperCopy;
}) {
  const alerts = useConsoleAlerts();
  const [open, setOpen] = useState(false);
  const [mappers, setMappers] = useState<Mapper[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const mapperSchema = z.object({
    id: z.number().optional(),
    name: z.string().trim().min(1).max(100),
    type: z.enum([
      "USER_ATTRIBUTE",
      "FULL_NAME",
      "HARDCODED_ATTRIBUTE",
      "ROLE",
      "GROUP",
      "HARDCODED_ROLE",
      "MSAD_USER_ACCOUNT",
      "CERTIFICATE",
    ]),
    enabled: z.boolean(),
    ldapAttribute: z.string().max(100),
    userAttribute: z.string().max(100),
    hardcodedValue: z.string().max(2000),
    targetName: z.string().max(200),
    groupSearchBase: z.string().max(1000),
    groupObjectClass: z.string().max(100),
    groupNameAttribute: z.string().max(100),
    groupMemberAttribute: z.string().max(100),
  });
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Mapper>({
    resolver: zodResolver(mapperSchema),
    defaultValues: emptyMapper,
    mode: "onChange",
  });

  const load = async () => {
    setLoading(true);
    try {
      const response = await adminRequest<Mapper[]>(accessToken, {
        url: `/api/admin/settings/ldap/${providerId}/mappers`,
      });
      if (response.status >= 300 || !Array.isArray(response.data)) throw new Error();
      setMappers(response.data);
      setOpen(true);
    } catch {
      alerts.addError(copy.mapperError);
    } finally {
      setLoading(false);
    }
  };

  const save = handleSubmit(async (values) => {
    setBusy(values.id ? `save-${values.id}` : "create");
    try {
      const response = await adminRequest<Mapper>(accessToken, {
        method: values.id ? "PUT" : "POST",
        url: values.id
          ? `/api/admin/settings/ldap/${providerId}/mappers/${values.id}`
          : `/api/admin/settings/ldap/${providerId}/mappers`,
        data: values,
      });
      if (response.status >= 300) throw new Error();
      setMappers((current) =>
        values.id
          ? current.map((mapper) => (mapper.id === values.id ? response.data : mapper))
          : [...current, response.data],
      );
      reset(emptyMapper);
      alerts.addAlert(values.id ? copy.updateMapper : copy.saveMapper);
    } catch {
      alerts.addError(copy.mapperError);
    } finally {
      setBusy(null);
    }
  });

  const edit = (mapper: Mapper) => reset(mapper);

  const remove = async (mapper: Mapper) => {
    if (!mapper.id) return;
    setBusy(`delete-${mapper.id}`);
    try {
      const response = await adminRequest(accessToken, {
        method: "DELETE",
        url: `/api/admin/settings/ldap/${providerId}/mappers/${mapper.id}`,
      });
      if (response.status >= 300) throw new Error();
      setMappers((current) => current.filter((value) => value.id !== mapper.id));
      alerts.addAlert(copy.deleteMapper);
    } catch {
      alerts.addError(copy.mapperError);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="admin-panel-card">
      <Card.Body>
        <div className="admin-detail-heading mb-3">
          <div>
            <h4 className="h6 mb-1">{copy.mappers}</h4>
            <p className="text-body-secondary mb-0">{copy.mapperDescription}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={open ? undefined : load}
            disabled={loading}
          >
            {loading && (
              <Spinner animation="border" size="sm" aria-hidden="true" className="me-2" />
            )}
            {copy.mappers}
          </Button>
        </div>
        {open && (
          <>
            <Form noValidate onSubmit={save}>
              <div className="d-grid gap-3">
                <Form.Group controlId={`ldap-${providerId}-mapper-name`}>
                  <Form.Label>{copy.mapperName}</Form.Label>
                  <Form.Control isInvalid={Boolean(errors.name)} {...register("name")} />
                  <Form.Control.Feedback type="invalid">
                    {errors.name?.message}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Group controlId={`ldap-${providerId}-mapper-type`}>
                  <Form.Label>{copy.mapperType}</Form.Label>
                  <Form.Select {...register("type")}>
                    <option value="USER_ATTRIBUTE">User attribute</option>
                    <option value="FULL_NAME">Full name</option>
                    <option value="HARDCODED_ATTRIBUTE">Hardcoded attribute</option>
                    <option value="ROLE">Role</option>
                    <option value="GROUP">Group</option>
                    <option value="HARDCODED_ROLE">Hardcoded role</option>
                    <option value="MSAD_USER_ACCOUNT">MSAD user account</option>
                    <option value="CERTIFICATE">Certificate</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group controlId={`ldap-${providerId}-mapper-ldap-attribute`}>
                  <Form.Label>{copy.ldapAttribute}</Form.Label>
                  <Form.Control {...register("ldapAttribute")} />
                </Form.Group>
                <Form.Group controlId={`ldap-${providerId}-mapper-user-attribute`}>
                  <Form.Label>{copy.userAttribute}</Form.Label>
                  <Form.Control {...register("userAttribute")} />
                </Form.Group>
                <Form.Group controlId={`ldap-${providerId}-mapper-hardcoded-value`}>
                  <Form.Label>{copy.hardcodedValue}</Form.Label>
                  <Form.Control {...register("hardcodedValue")} />
                </Form.Group>
                <Form.Group controlId={`ldap-${providerId}-mapper-target-name`}>
                  <Form.Label>{copy.targetName}</Form.Label>
                  <Form.Control {...register("targetName")} />
                </Form.Group>
                <Form.Group controlId={`ldap-${providerId}-mapper-group-search-base`}>
                  <Form.Label>{copy.groupSearchBase}</Form.Label>
                  <Form.Control {...register("groupSearchBase")} />
                </Form.Group>
                <Form.Group controlId={`ldap-${providerId}-mapper-group-object-class`}>
                  <Form.Label>{copy.groupObjectClass}</Form.Label>
                  <Form.Control {...register("groupObjectClass")} />
                </Form.Group>
                <Form.Group controlId={`ldap-${providerId}-mapper-group-name-attribute`}>
                  <Form.Label>{copy.groupNameAttribute}</Form.Label>
                  <Form.Control {...register("groupNameAttribute")} />
                </Form.Group>
                <Form.Group controlId={`ldap-${providerId}-mapper-group-member-attribute`}>
                  <Form.Label>{copy.groupMemberAttribute}</Form.Label>
                  <Form.Control {...register("groupMemberAttribute")} />
                </Form.Group>
                <Form.Check type="switch" label={copy.mapperEnabled} {...register("enabled")} />
              </div>
              <div className="admin-form-actions mt-3">
                <Button type="submit" variant="primary" disabled={isSubmitting || busy !== null}>
                  {isSubmitting && (
                    <Spinner animation="border" size="sm" aria-hidden="true" className="me-2" />
                  )}
                  {copy.saveMapper}
                </Button>
              </div>
            </Form>
            <div className="d-grid gap-2 mt-4">
              {mappers.map((mapper) => (
                <div className="d-flex justify-content-between align-items-center" key={mapper.id}>
                  <span>
                    {mapper.name} ({mapper.type})
                  </span>
                  <span className="d-flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => edit(mapper)}
                      disabled={busy !== null}
                    >
                      {copy.updateMapper}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => remove(mapper)}
                      disabled={busy !== null}
                    >
                      {busy === `delete-${mapper.id}` && (
                        <Spinner animation="border" size="sm" aria-hidden="true" className="me-2" />
                      )}
                      {copy.deleteMapper}
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
}

export default function LdapFederationSettings() {
  const dictionary = useDictionary();
  const copy = dictionary.admin.ldapFederation;
  const validation = dictionary.admin.common.validation;
  const { accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [testingIndex, setTestingIndex] = useState<number | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
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
    vendor: z.enum(["LDAP", "ACTIVE_DIRECTORY"]),
    authenticationType: z.enum(["SIMPLE", "KERBEROS"]),
    startTls: z.boolean(),
    trustStorePath: z.string().max(1000),
    trustStorePassword: z.string().max(2000),
    trustStoreType: z.enum(["JKS", "PKCS12"]),
    connectionPooling: z.boolean(),
    referral: z.enum(["FOLLOW", "IGNORE", "THROW"]),
    connectTimeoutMs: z.number().int().min(100).max(600000),
    readTimeoutMs: z.number().int().min(100).max(600000),
    batchSize: z.number().int().min(1).max(10000),
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
    syncRegistrations: z.boolean(),
    fullSyncIntervalMinutes: z.number().int().min(0, validation.positiveNumber),
    changedSyncIntervalMinutes: z.number().int().min(0, validation.positiveNumber),
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
    syncRegistrations: provider.syncRegistrations ?? false,
    vendor: provider.vendor ?? "LDAP",
    authenticationType: provider.authenticationType ?? "SIMPLE",
    startTls: provider.startTls ?? false,
    trustStorePath: provider.trustStorePath ?? "",
    trustStorePassword: provider.trustStorePassword ?? "",
    trustStoreType: provider.trustStoreType ?? "JKS",
    connectionPooling: provider.connectionPooling ?? false,
    referral: provider.referral ?? "THROW",
    connectTimeoutMs: provider.connectTimeoutMs ?? 5000,
    readTimeoutMs: provider.readTimeoutMs ?? 5000,
    batchSize: provider.batchSize ?? 500,
    fullSyncIntervalMinutes: provider.fullSyncIntervalMinutes ?? 0,
    changedSyncIntervalMinutes: provider.changedSyncIntervalMinutes ?? 0,
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
        setError(false);
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

  const sync = async (index: number, mode: "FULL" | "CHANGED") => {
    const providerId = getValues(`providers.${index}.id`);
    if (!accessToken || !providerId) return;
    setSyncing(`${mode}-${index}`);
    try {
      const response = await adminRequest(accessToken, {
        method: "POST",
        url: `/api/admin/settings/ldap/${providerId}/sync?mode=${mode}`,
      });
      if (response.status >= 300) throw new Error();
      alerts.addAlert(copy.syncSucceeded);
    } catch {
      alerts.addError(copy.syncFailed);
    } finally {
      setSyncing(null);
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
                        <div className="d-grid gap-3">
                          <Form.Group controlId={`ldap-${index}-vendor`}>
                            <Form.Label>{copy.vendor}</Form.Label>
                            <Form.Select {...register(path("vendor"))}>
                              <option value="LDAP">{copy.ldapVendor}</option>
                              <option value="ACTIVE_DIRECTORY">{copy.activeDirectoryVendor}</option>
                            </Form.Select>
                          </Form.Group>
                          <Form.Group controlId={`ldap-${index}-authentication-type`}>
                            <Form.Label>{copy.authenticationType}</Form.Label>
                            <Form.Select {...register(path("authenticationType"))}>
                              <option value="SIMPLE">{copy.simpleAuthentication}</option>
                              <option value="KERBEROS">{copy.kerberosAuthentication}</option>
                            </Form.Select>
                          </Form.Group>
                        </div>
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
                        <Form.Check
                          type="switch"
                          label={copy.startTls}
                          {...register(path("startTls"))}
                        />
                        <Form.Group controlId={`ldap-${index}-trust-store-path`}>
                          <Form.Label>{copy.trustStorePath}</Form.Label>
                          <Form.Control {...register(path("trustStorePath"))} />
                        </Form.Group>
                        <Form.Group controlId={`ldap-${index}-trust-store-password`}>
                          <Form.Label>{copy.trustStorePassword}</Form.Label>
                          <Form.Control
                            type="password"
                            autoComplete="new-password"
                            {...register(path("trustStorePassword"))}
                          />
                        </Form.Group>
                        <div className="d-grid gap-3">
                          <Form.Group controlId={`ldap-${index}-trust-store-type`}>
                            <Form.Label>{copy.trustStoreType}</Form.Label>
                            <Form.Select {...register(path("trustStoreType"))}>
                              <option value="JKS">JKS</option>
                              <option value="PKCS12">PKCS12</option>
                            </Form.Select>
                          </Form.Group>
                          <Form.Group controlId={`ldap-${index}-referral`}>
                            <Form.Label>{copy.referral}</Form.Label>
                            <Form.Select {...register(path("referral"))}>
                              <option value="FOLLOW">{copy.followReferral}</option>
                              <option value="IGNORE">{copy.ignoreReferral}</option>
                              <option value="THROW">{copy.throwReferral}</option>
                            </Form.Select>
                          </Form.Group>
                        </div>
                        <Form.Check
                          type="switch"
                          label={copy.connectionPooling}
                          {...register(path("connectionPooling"))}
                        />
                        <div className="d-grid gap-3">
                          {(["connectTimeoutMs", "readTimeoutMs", "batchSize"] as const).map(
                            (name) => (
                              <Form.Group controlId={`ldap-${index}-${name}`} key={name}>
                                <Form.Label>{copy[name]}</Form.Label>
                                <Form.Control
                                  type="number"
                                  min={name === "batchSize" ? 1 : 100}
                                  {...register(path(name), { valueAsNumber: true })}
                                />
                              </Form.Group>
                            ),
                          )}
                        </div>
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
                        <Form.Check
                          type="switch"
                          label={copy.syncRegistrations}
                          {...register(path("syncRegistrations"))}
                        />
                        <Form.Group controlId={`ldap-${index}-full-sync-interval`}>
                          <Form.Label>{copy.fullSyncIntervalMinutes}</Form.Label>
                          <Form.Control
                            type="number"
                            min={0}
                            {...register(path("fullSyncIntervalMinutes"), { valueAsNumber: true })}
                          />
                        </Form.Group>
                        <Form.Group controlId={`ldap-${index}-changed-sync-interval`}>
                          <Form.Label>{copy.changedSyncIntervalMinutes}</Form.Label>
                          <Form.Control
                            type="number"
                            min={0}
                            {...register(path("changedSyncIntervalMinutes"), {
                              valueAsNumber: true,
                            })}
                          />
                        </Form.Group>
                        {accessToken && getValues(`providers.${index}.id`) && (
                          <LdapMapperPanel
                            accessToken={accessToken}
                            providerId={getValues(`providers.${index}.id`)!}
                            copy={copy}
                          />
                        )}
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
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={syncing !== null}
                          onClick={() => sync(index, "FULL")}
                        >
                          {syncing === `FULL-${index}` && (
                            <Spinner
                              animation="border"
                              size="sm"
                              aria-hidden="true"
                              className="me-2"
                            />
                          )}
                          {copy.syncFull}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={syncing !== null}
                          onClick={() => sync(index, "CHANGED")}
                        >
                          {syncing === `CHANGED-${index}` && (
                            <Spinner
                              animation="border"
                              size="sm"
                              aria-hidden="true"
                              className="me-2"
                            />
                          )}
                          {copy.syncChanged}
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
