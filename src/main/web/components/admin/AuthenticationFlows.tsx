"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { useForm } from "@/lib/form";
import { z } from "zod";

import { useDictionary } from "@/i18n/client";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { AdminActionIcon } from "./AdminActionIcon";
import { useAdminAuth } from "./AdminAuthProvider";
import { AdminPageHeader } from "./AdminPageHeader";
import { ConfirmModal } from "./ConfirmModal";
import { DetailTabs } from "./DetailTabs";
import { DetailLoadingState, ErrorState } from "./AsyncState";
import { PaginationControls } from "./PaginationControls";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import type { SubmitHandler, UseFormReturn } from "react-hook-form";

type Requirement = "REQUIRED" | "ALTERNATIVE" | "DISABLED" | "CONDITIONAL";
type FlowType = "BASIC" | "FORM";
type BindingType =
  | "BROWSER"
  | "REGISTRATION"
  | "RESET_CREDENTIALS"
  | "FIRST_BROKER_LOGIN"
  | "POST_BROKER_LOGIN"
  | "DIRECT_GRANT";

type Flow = {
  id: number;
  alias: string;
  name: string;
  description: string | null;
  flowType: FlowType;
  topLevel: boolean;
  builtIn: boolean;
  requirement: Requirement | null;
  priority: number;
};

type Execution = {
  id: number;
  flowId: number;
  providerId: string;
  displayName: string;
  requirement: Exclude<Requirement, "CONDITIONAL">;
  priority: number;
  authenticatorReference: string | null;
  configuration: string | null;
};

type FlowNode = {
  nodeType: "EXECUTION" | "SUB_FLOW";
  id: number;
  name: string;
  providerId: string | null;
  requirement: Requirement;
  priority: number;
  builtIn: boolean;
};

type FlowDetail = { flow: Flow; executions: Execution[]; subFlows: Flow[]; nodes: FlowNode[] };
type Binding = {
  bindingType: BindingType;
  flowId: number | null;
  flowAlias: string | null;
  flowName: string | null;
};
type AuthenticationCopy = Dictionary["admin"]["authentication"];

const requirements: Requirement[] = ["REQUIRED", "ALTERNATIVE", "DISABLED", "CONDITIONAL"];
const executionRequirements: Exclude<Requirement, "CONDITIONAL">[] = [
  "REQUIRED",
  "ALTERNATIVE",
  "DISABLED",
];

const flowSchema = (requirementMessage: string) =>
  z.object({
    alias: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9][a-z0-9._-]*$/),
    name: z.string().trim().min(1).max(200),
    description: z.string().max(1000),
    flowType: z.enum(["BASIC", "FORM"]),
    requirement: z.enum(requirements).nullable(),
    priority: z.number().int().min(0, requirementMessage),
  });

const executionSchema = z.object({
  providerId: z.string().trim().min(1).max(100),
  displayName: z.string().trim().min(1).max(200),
  requirement: z.enum(executionRequirements),
  authenticatorReference: z.string().max(100),
  configuration: z.string().max(4000),
  priority: z.number().int().min(0),
});

type FlowValues = z.infer<ReturnType<typeof flowSchema>>;
type ExecutionValues = z.infer<typeof executionSchema>;

const emptyFlow: FlowValues = {
  alias: "",
  name: "",
  description: "",
  flowType: "BASIC",
  requirement: null,
  priority: 10,
};

const emptyExecution: ExecutionValues = {
  providerId: "username-password-form",
  displayName: "",
  requirement: "REQUIRED",
  authenticatorReference: "",
  configuration: "",
  priority: 10,
};

type FlowFormProps = {
  copy: AuthenticationCopy;
  form: UseFormReturn<FlowValues>;
  onCancel?: () => void;
  onSubmit: SubmitHandler<FlowValues>;
  submitLabel: string;
  submitting: boolean;
  topLevel?: boolean;
  metadataLocked?: boolean;
};

type ExecutionFormProps = {
  copy: AuthenticationCopy;
  form: UseFormReturn<ExecutionValues>;
  onCancel: () => void;
  onSubmit: SubmitHandler<ExecutionValues>;
  providers: string[];
  submitLabel: string;
  submitting: boolean;
  metadataLocked?: boolean;
};

type NodeRowProps = {
  label: string;
  secondary: string;
  requirement: Requirement | null;
  onOpen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete?: () => void;
  copy: AuthenticationCopy;
  disabled: boolean;
  movingNodeKey: string | null;
  nodeKey: string;
  opening: boolean;
};

type BindingsCardProps = {
  bindings: Binding[];
  flows: Flow[];
  copy: AuthenticationCopy;
  saving: boolean;
  onSave: (bindingType: BindingType, flowId: number | null) => void;
};

type BindingRowProps = Omit<BindingsCardProps, "bindings"> & { binding: Binding };

export default function AuthenticationFlows() {
  const dictionary = useDictionary();
  const copy = dictionary.admin.authentication;
  const { accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [flowPage, setFlowPage] = useState(0);
  const [flowSize, setFlowSize] = useState(20);
  const [totalFlows, setTotalFlows] = useState(0);
  const [totalFlowPages, setTotalFlowPages] = useState(0);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<FlowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingFlow, setCreatingFlow] = useState(false);
  const [creatingSubFlow, setCreatingSubFlow] = useState(false);
  const [creatingExecution, setCreatingExecution] = useState(false);
  const [editingExecutionId, setEditingExecutionId] = useState<number | null>(null);
  const [deletingFlowId, setDeletingFlowId] = useState<number | null>(null);
  const [deletingExecutionId, setDeletingExecutionId] = useState<number | null>(null);
  const [movingNodeKey, setMovingNodeKey] = useState<string | null>(null);
  const [openingNodeKey, setOpeningNodeKey] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState("flow-list");

  const flowForm = useForm<FlowValues>({
    resolver: zodResolver(flowSchema(dictionary.admin.common.validation.required)),
    defaultValues: emptyFlow,
  });
  const subFlowForm = useForm<FlowValues>({
    resolver: zodResolver(flowSchema(dictionary.admin.common.validation.required)),
    defaultValues: { ...emptyFlow, requirement: "ALTERNATIVE" },
  });
  const executionForm = useForm<ExecutionValues>({
    resolver: zodResolver(executionSchema),
    defaultValues: emptyExecution,
  });
  const flowEditForm = useForm<FlowValues>({
    resolver: zodResolver(flowSchema(dictionary.admin.common.validation.required)),
    defaultValues: emptyFlow,
  });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [flowsResponse, bindingsResponse, providersResponse] = await Promise.all([
        adminRequest<PageResponse<Flow>>(accessToken, {
          url: `/api/admin/authentication/flows?page=${flowPage}&size=${flowSize}&sort=name,asc`,
        }),
        adminRequest<Binding[]>(accessToken, { url: "/api/admin/authentication/bindings" }),
        adminRequest<string[]>(accessToken, {
          url: "/api/admin/authentication/execution-providers",
        }),
      ]);
      if (
        flowsResponse.status >= 300 ||
        bindingsResponse.status >= 300 ||
        providersResponse.status >= 300
      ) {
        throw new Error("load");
      }
      setFlows(flowsResponse.data.content);
      setTotalFlows(flowsResponse.data.totalElements);
      setTotalFlowPages(flowsResponse.data.totalPages);
      setBindings(bindingsResponse.data);
      setProviders(providersResponse.data);
      setSelectedId((current) =>
        flowsResponse.data.content.some((flow) => flow.id === current)
          ? current
          : (flowsResponse.data.content[0]?.id ?? null),
      );
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken, flowPage, flowSize]);

  const loadDetail = useCallback(
    async (id: number) => {
      if (!accessToken) return;
      setSelectedId(id);
      setDetailLoading(true);
      setDetailError(false);
      try {
        const response = await adminRequest<FlowDetail>(accessToken, {
          url: `/api/admin/authentication/flows/${id}`,
        });
        if (response.status >= 300) throw new Error("detail");
        setDetail(response.data);
        flowEditForm.reset({
          alias: response.data.flow.alias,
          name: response.data.flow.name,
          description: response.data.flow.description ?? "",
          flowType: response.data.flow.flowType,
          requirement: response.data.flow.requirement,
          priority: response.data.flow.priority,
        });
      } catch {
        setDetailError(true);
      } finally {
        setDetailLoading(false);
        setOpeningNodeKey(null);
      }
    },
    [accessToken, flowEditForm],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    if (selectedId === null) return;
    const timeout = window.setTimeout(() => void loadDetail(selectedId), 0);
    return () => window.clearTimeout(timeout);
  }, [loadDetail, selectedId]);

  const selectedFlow = useMemo(
    () => detail?.flow ?? flows.find((flow) => flow.id === selectedId),
    [detail, flows, selectedId],
  );

  const requestMutation = async (action: () => Promise<void>, successMessage: string) => {
    setSaving(true);
    try {
      await action();
      alerts.addAlert(successMessage);
      await load();
      if (selectedId !== null) await loadDetail(selectedId);
    } catch {
      alerts.addError(copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  const createFlow = async (values: FlowValues) => {
    if (!accessToken) return;
    await requestMutation(async () => {
      const response = await adminRequest<Flow>(accessToken, {
        method: "POST",
        url: "/api/admin/authentication/flows",
        data: { ...values, requirement: null },
      });
      if (response.status >= 300) throw new Error("create");
      flowForm.reset(emptyFlow);
      setCreatingFlow(false);
      setActiveDetailTab("flow-list");
      setSelectedId(response.data.id);
    }, copy.saveSuccess);
  };

  const createSubFlow = async (values: FlowValues) => {
    if (!accessToken || !selectedId) return;
    await requestMutation(async () => {
      const response = await adminRequest<Flow>(accessToken, {
        method: "POST",
        url: `/api/admin/authentication/flows/${selectedId}/sub-flows`,
        data: values,
      });
      if (response.status >= 300) throw new Error("create");
      subFlowForm.reset({ ...emptyFlow, requirement: "ALTERNATIVE" });
      setCreatingSubFlow(false);
    }, copy.saveSuccess);
  };

  const saveFlow = async (values: FlowValues) => {
    if (!accessToken || !selectedId) return;
    await requestMutation(async () => {
      const response = await adminRequest<Flow>(accessToken, {
        method: "PUT",
        url: `/api/admin/authentication/flows/${selectedId}`,
        data: values,
      });
      if (response.status >= 300) throw new Error("save");
    }, copy.saveSuccess);
  };

  const createExecution = async (values: ExecutionValues) => {
    if (!accessToken || !selectedId) return;
    await requestMutation(async () => {
      const response = await adminRequest<Execution>(accessToken, {
        method: "POST",
        url: `/api/admin/authentication/flows/${selectedId}/executions`,
        data: values,
      });
      if (response.status >= 300) throw new Error("create");
      executionForm.reset(emptyExecution);
      setCreatingExecution(false);
    }, copy.saveSuccess);
  };

  const saveExecution = async (values: ExecutionValues) => {
    if (!accessToken || !selectedId || editingExecutionId === null) return;
    await requestMutation(async () => {
      const response = await adminRequest<Execution>(accessToken, {
        method: "PUT",
        url: `/api/admin/authentication/flows/${selectedId}/executions/${editingExecutionId}`,
        data: values,
      });
      if (response.status >= 300) throw new Error("save");
      setEditingExecutionId(null);
    }, copy.saveSuccess);
  };

  const deleteFlow = async () => {
    if (!accessToken || deletingFlowId === null) return;
    setSaving(true);
    try {
      const response = await adminRequest(accessToken, {
        method: "DELETE",
        url: `/api/admin/authentication/flows/${deletingFlowId}`,
      });
      if (response.status >= 300) throw new Error("delete");
      setDeletingFlowId(null);
      setSelectedId(null);
      setDetail(null);
      alerts.addAlert(copy.deleteSuccess);
      await load();
    } catch {
      alerts.addError(copy.deleteError);
    } finally {
      setSaving(false);
    }
  };

  const deleteExecution = async () => {
    if (!accessToken || !selectedId || deletingExecutionId === null) return;
    setSaving(true);
    try {
      const response = await adminRequest(accessToken, {
        method: "DELETE",
        url: `/api/admin/authentication/flows/${selectedId}/executions/${deletingExecutionId}`,
      });
      if (response.status >= 300) throw new Error("delete");
      setDeletingExecutionId(null);
      await loadDetail(selectedId);
      alerts.addAlert(copy.deleteSuccess);
    } catch {
      alerts.addError(copy.deleteError);
    } finally {
      setSaving(false);
    }
  };

  const moveNode = async (
    nodeType: "EXECUTION" | "SUB_FLOW",
    nodeId: number,
    direction: "UP" | "DOWN",
  ) => {
    if (!accessToken || !selectedId) return;
    const movingKey = `${nodeType}-${nodeId}-${direction}`;
    setMovingNodeKey(movingKey);
    setSaving(true);
    try {
      const response = await adminRequest<FlowDetail>(accessToken, {
        method: "PUT",
        url: `/api/admin/authentication/flows/${selectedId}/nodes/${nodeType}/${nodeId}/position`,
        data: { direction },
      });
      if (response.status >= 300) throw new Error("move");
      setDetail(response.data);
    } catch {
      alerts.addError(copy.saveError);
    } finally {
      setSaving(false);
      setMovingNodeKey(null);
    }
  };

  const saveBinding = async (bindingType: BindingType, flowId: number | null) => {
    if (!accessToken) return;
    setSaving(true);
    try {
      const response = await adminRequest<Binding>(
        accessToken,
        flowId === null
          ? { method: "DELETE", url: `/api/admin/authentication/bindings/${bindingType}` }
          : {
              method: "PUT",
              url: `/api/admin/authentication/bindings/${bindingType}`,
              data: { flowId },
            },
      );
      if (response.status >= 300) throw new Error("binding");
      setBindings((current) =>
        current.map((binding) => (binding.bindingType === bindingType ? response.data : binding)),
      );
      alerts.addAlert(flowId === null ? copy.bindingRemoved : copy.bindingSaved);
    } catch {
      alerts.addError(copy.bindingError);
    } finally {
      setSaving(false);
    }
  };

  const startEditExecution = (execution: Execution) => {
    executionForm.reset({
      providerId: execution.providerId,
      displayName: execution.displayName,
      requirement: execution.requirement,
      authenticatorReference: execution.authenticatorReference ?? "",
      configuration: execution.configuration ?? "",
      priority: execution.priority,
    });
    setEditingExecutionId(execution.id);
  };

  const changeFlowPage = (page: number) => {
    setFlowPage(page);
    setActiveDetailTab("graph");
    setSelectedId(null);
    setDetail(null);
  };

  const changeFlowSize = (size: number) => {
    setFlowSize(size);
    setFlowPage(0);
    setActiveDetailTab("graph");
    setSelectedId(null);
    setDetail(null);
  };

  const renderNode = (node: FlowNode) => {
    if (!detail) return null;
    const execution = detail.executions.find((value) => value.id === node.id);
    return (
      <NodeRow
        key={`${node.nodeType}-${node.id}`}
        label={node.name}
        secondary={node.providerId ?? copy.subFlows}
        requirement={node.requirement}
        onOpen={() => {
          if (node.nodeType === "SUB_FLOW") {
            setActiveDetailTab("graph");
            setOpeningNodeKey(`${node.nodeType}-${node.id}`);
            void loadDetail(node.id);
          } else if (execution) {
            setActiveDetailTab("executions");
            startEditExecution(execution);
          }
        }}
        onMoveUp={() => void moveNode(node.nodeType, node.id, "UP")}
        onMoveDown={() => void moveNode(node.nodeType, node.id, "DOWN")}
        onDelete={
          node.nodeType === "EXECUTION" && !detail.flow.builtIn
            ? () => setDeletingExecutionId(node.id)
            : undefined
        }
        copy={copy}
        disabled={saving || detail.flow.builtIn}
        movingNodeKey={movingNodeKey}
        opening={openingNodeKey === `${node.nodeType}-${node.id}`}
        nodeKey={`${node.nodeType}-${node.id}`}
      />
    );
  };

  if (loading) return <DetailLoadingState />;
  if (loadError) return <ErrorState message={copy.loadError} />;

  return (
    <>
      <AdminPageHeader
        title={copy.flowsTitle}
        description={copy.flowsDescription}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setActiveDetailTab("flow-list");
              setCreatingFlow((current) => !current);
            }}
            variant="primary"
          >
            <AdminActionIcon action="add" />
            {copy.createFlow}
          </Button>
        }
      />
      <DetailTabs
        active="flows"
        tabs={[
          { key: "policies", label: copy.policies, href: "/admin/authentication" },
          { key: "flows", label: copy.flows, href: "/admin/authentication/flows" },
        ]}
      />
      <p className="text-body-secondary">{copy.singleIssuerNote}</p>
      {detailError && <Alert variant="danger">{copy.loadError}</Alert>}
      <DetailTabs
        active={activeDetailTab}
        tabs={[
          {
            key: "flow-list",
            label: copy.flowList,
            onSelect: () => setActiveDetailTab("flow-list"),
          },
          ...(detail
            ? [
                {
                  key: "settings",
                  label: copy.flowSettings,
                  onSelect: () => setActiveDetailTab("settings"),
                },
                {
                  key: "graph",
                  label: copy.flowGraph,
                  onSelect: () => setActiveDetailTab("graph"),
                },
                {
                  key: "executions",
                  label: copy.executions,
                  onSelect: () => setActiveDetailTab("executions"),
                },
                {
                  key: "bindings",
                  label: copy.bindings,
                  onSelect: () => setActiveDetailTab("bindings"),
                },
              ]
            : []),
        ]}
      />
      {activeDetailTab === "flow-list" && (
        <Card className="admin-panel-card mt-4">
          <Card.Body>
            <div className="admin-detail-heading">
              <div>
                <Card.Title>{copy.flowList}</Card.Title>
                <Card.Text className="text-body-secondary">{totalFlows}</Card.Text>
              </div>
            </div>
            {creatingFlow && (
              <FlowForm
                copy={copy}
                form={flowForm}
                onCancel={() => setCreatingFlow(false)}
                onSubmit={createFlow}
                submitLabel={copy.createFlow}
                submitting={saving}
                topLevel
              />
            )}
            {flows.length === 0 ? (
              <p className="text-body-secondary mb-0">{copy.noFlows}</p>
            ) : (
              <div className="d-grid gap-2">
                {flows.map((flow) => (
                  <Button
                    className="text-start"
                    disabled={detailLoading}
                    key={flow.id}
                    onClick={() => {
                      setActiveDetailTab("graph");
                      void loadDetail(flow.id);
                    }}
                    variant={flow.id === selectedId ? "primary" : "light"}
                  >
                    <span className="d-flex justify-content-between gap-2">
                      <span>
                        {detailLoading && flow.id === selectedId && (
                          <Spinner
                            animation="border"
                            aria-hidden="true"
                            className="me-2"
                            size="sm"
                          />
                        )}
                        {flow.name}
                      </span>
                      {flow.builtIn && (
                        <Badge bg={flow.id === selectedId ? "light" : "secondary"}>
                          {copy.builtIn}
                        </Badge>
                      )}
                    </span>
                    <small className="d-block opacity-75 font-monospace">{flow.alias}</small>
                  </Button>
                ))}
              </div>
            )}
            <PaginationControls
              page={flowPage}
              totalPages={totalFlowPages}
              totalElements={totalFlows}
              size={flowSize}
              rowsPerPage={dictionary.admin.resources.rowsPerPage}
              pageLabel={dictionary.admin.resources.page}
              previous={dictionary.admin.resources.previous}
              next={dictionary.admin.resources.next}
              first={dictionary.admin.resources.first}
              last={dictionary.admin.resources.last}
              onPageChange={changeFlowPage}
              onSizeChange={changeFlowSize}
              pageSizeId="authentication-flow-page-size"
            />
          </Card.Body>
        </Card>
      )}
      {activeDetailTab !== "flow-list" && (
        <div className="mt-4">
          {!selectedFlow ? (
            <Card className="admin-panel-card">
              <Card.Body className="text-body-secondary">{copy.selectFlow}</Card.Body>
            </Card>
          ) : detailLoading && !detail ? (
            <DetailLoadingState />
          ) : detail ? (
            <div className="d-grid gap-4">
              <Card className="admin-panel-card">
                <Card.Body>
                  <div className="admin-detail-heading">
                    <div>
                      <Card.Title>{copy.flowGraph}</Card.Title>
                      <Card.Text className="text-body-secondary mb-0">
                        {detail.flow.alias}
                      </Card.Text>
                    </div>
                    {!detail.flow.builtIn && (
                      <Button variant="danger" onClick={() => setDeletingFlowId(detail.flow.id)}>
                        <ActionIcon action="delete" />
                        {copy.deleteFlow}
                      </Button>
                    )}
                  </div>
                  {activeDetailTab === "settings" && (
                    <FlowForm
                      copy={copy}
                      form={flowEditForm}
                      onSubmit={saveFlow}
                      submitLabel={copy.saveFlow}
                      submitting={saving}
                      topLevel={detail.flow.topLevel}
                      metadataLocked={detail.flow.builtIn}
                    />
                  )}
                  {activeDetailTab === "graph" && (
                    <>
                      <div className="admin-detail-heading mt-4">
                        <div>
                          <h3 className="h6 mb-1">{copy.flowGraph}</h3>
                          <p className="text-body-secondary mb-0">{detail.nodes.length}</p>
                        </div>
                        {!detail.flow.builtIn && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setCreatingSubFlow((current) => !current)}
                          >
                            <ActionIcon action="add" />
                            {copy.createSubFlow}
                          </Button>
                        )}
                      </div>
                      {creatingSubFlow && !detail.flow.builtIn && (
                        <FlowForm
                          copy={copy}
                          form={subFlowForm}
                          onCancel={() => setCreatingSubFlow(false)}
                          onSubmit={createSubFlow}
                          submitLabel={copy.createSubFlow}
                          submitting={saving}
                        />
                      )}
                      <div className="d-grid gap-2 mt-3">{detail.nodes.map(renderNode)}</div>
                    </>
                  )}
                  {activeDetailTab === "executions" && (
                    <>
                      <div className="admin-detail-heading mt-4">
                        <div>
                          <h3 className="h6 mb-1">{copy.executions}</h3>
                          <p className="text-body-secondary mb-0">{detail.executions.length}</p>
                        </div>
                        {!detail.flow.builtIn && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setCreatingExecution((current) => !current)}
                          >
                            <ActionIcon action="add" />
                            {copy.addExecution}
                          </Button>
                        )}
                      </div>
                      <div className="d-grid gap-2 mt-3">
                        {detail.nodes
                          .filter((node) => node.nodeType === "EXECUTION")
                          .map(renderNode)}
                      </div>
                      {(creatingExecution || editingExecutionId !== null) && (
                        <ExecutionForm
                          copy={copy}
                          form={executionForm}
                          onCancel={() => {
                            setCreatingExecution(false);
                            setEditingExecutionId(null);
                          }}
                          onSubmit={editingExecutionId === null ? createExecution : saveExecution}
                          providers={providers}
                          submitLabel={
                            editingExecutionId === null ? copy.addExecution : copy.saveExecution
                          }
                          submitting={saving}
                          metadataLocked={detail.flow.builtIn}
                        />
                      )}
                    </>
                  )}
                  {activeDetailTab === "bindings" && (
                    <BindingsCard
                      bindings={bindings}
                      flows={flows}
                      copy={copy}
                      saving={saving}
                      onSave={saveBinding}
                    />
                  )}
                </Card.Body>
              </Card>
            </div>
          ) : null}
        </div>
      )}
      <ConfirmModal
        show={deletingFlowId !== null}
        message={copy.deleteConfirm}
        cancelLabel={copy.cancel}
        confirmLabel={copy.deleteFlow}
        busy={saving}
        onCancel={() => setDeletingFlowId(null)}
        onConfirm={() => void deleteFlow()}
      />
      <ConfirmModal
        show={deletingExecutionId !== null}
        message={copy.deleteConfirm}
        cancelLabel={copy.cancel}
        confirmLabel={copy.deleteExecution}
        busy={saving}
        onCancel={() => setDeletingExecutionId(null)}
        onConfirm={() => void deleteExecution()}
      />
    </>
  );
}

function FlowForm({
  copy,
  form,
  onCancel,
  onSubmit,
  submitLabel,
  submitting,
  topLevel = false,
  metadataLocked = false,
}: FlowFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;
  return (
    <Form className="d-grid gap-3 mt-3" noValidate onSubmit={handleSubmit(onSubmit)}>
      <Row className="g-3">
        <Col md={6}>
          <Form.Group controlId="authentication-flow-alias">
            <Form.Label>{copy.alias}</Form.Label>
            <Form.Control
              disabled={metadataLocked}
              isInvalid={Boolean(errors.alias)}
              {...register("alias")}
            />
            <Form.Control.Feedback type="invalid">{errors.alias?.message}</Form.Control.Feedback>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group controlId="authentication-flow-name">
            <Form.Label>{copy.name}</Form.Label>
            <Form.Control
              disabled={metadataLocked}
              isInvalid={Boolean(errors.name)}
              {...register("name")}
            />
            <Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback>
          </Form.Group>
        </Col>
      </Row>
      <Row className="g-3">
        <Col md={4}>
          <Form.Group controlId="authentication-flow-type">
            <Form.Label>{copy.flowType}</Form.Label>
            <Form.Select disabled={metadataLocked} {...register("flowType")}>
              <option value="BASIC">BASIC</option>
              <option value="FORM">FORM</option>
            </Form.Select>
          </Form.Group>
        </Col>
        {!topLevel && (
          <Col md={4}>
            <Form.Group controlId="authentication-flow-requirement">
              <Form.Label>{copy.requirement}</Form.Label>
              <Form.Select disabled={metadataLocked} {...register("requirement")}>
                {requirements.map((value) => (
                  <option key={value} value={value}>
                    {value === "REQUIRED"
                      ? copy.required
                      : value === "ALTERNATIVE"
                        ? copy.alternative
                        : value === "DISABLED"
                          ? copy.disabled
                          : copy.conditional}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
        )}
        <Col md={4}>
          <Form.Group controlId="authentication-flow-priority">
            <Form.Label>{copy.priority}</Form.Label>
            <Form.Control
              disabled={metadataLocked}
              type="number"
              isInvalid={Boolean(errors.priority)}
              {...register("priority", { valueAsNumber: true })}
            />
            <Form.Control.Feedback type="invalid">{errors.priority?.message}</Form.Control.Feedback>
          </Form.Group>
        </Col>
      </Row>
      <Form.Group controlId="authentication-flow-description">
        <Form.Label>{copy.description}</Form.Label>
        <Form.Control
          disabled={metadataLocked}
          as="textarea"
          rows={2}
          isInvalid={Boolean(errors.description)}
          {...register("description")}
        />
        <Form.Control.Feedback type="invalid">{errors.description?.message}</Form.Control.Feedback>
      </Form.Group>
      <div className="admin-form-actions">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            {copy.cancel}
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? (
            <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
          ) : (
            <ActionIcon action="save" />
          )}
          {submitLabel}
        </Button>
      </div>
    </Form>
  );
}

function ExecutionForm({
  copy,
  form,
  onCancel,
  onSubmit,
  providers,
  submitLabel,
  submitting,
  metadataLocked = false,
}: ExecutionFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;
  return (
    <Form className="d-grid gap-3 mt-3" noValidate onSubmit={handleSubmit(onSubmit)}>
      <Row className="g-3">
        <Col md={6}>
          <Form.Group controlId="authentication-execution-provider">
            <Form.Label>{copy.provider}</Form.Label>
            <Form.Select
              disabled={metadataLocked}
              isInvalid={Boolean(errors.providerId)}
              {...register("providerId")}
            >
              {providers.map((provider: string) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </Form.Select>
            <Form.Control.Feedback type="invalid">
              {errors.providerId?.message}
            </Form.Control.Feedback>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group controlId="authentication-execution-name">
            <Form.Label>{copy.name}</Form.Label>
            <Form.Control
              disabled={metadataLocked}
              isInvalid={Boolean(errors.displayName)}
              {...register("displayName")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.displayName?.message}
            </Form.Control.Feedback>
          </Form.Group>
        </Col>
      </Row>
      <Row className="g-3">
        <Col md={4}>
          <Form.Group controlId="authentication-execution-requirement">
            <Form.Label>{copy.requirement}</Form.Label>
            <Form.Select {...register("requirement")}>
              {executionRequirements.map((value) => (
                <option key={value} value={value}>
                  {value === "REQUIRED"
                    ? copy.required
                    : value === "ALTERNATIVE"
                      ? copy.alternative
                      : copy.disabled}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group controlId="authentication-execution-reference">
            <Form.Label>{copy.reference}</Form.Label>
            <Form.Control
              isInvalid={Boolean(errors.authenticatorReference)}
              {...register("authenticatorReference")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.authenticatorReference?.message}
            </Form.Control.Feedback>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group controlId="authentication-execution-priority">
            <Form.Label>{copy.priority}</Form.Label>
            <Form.Control
              type="number"
              isInvalid={Boolean(errors.priority)}
              {...register("priority", { valueAsNumber: true })}
            />
            <Form.Control.Feedback type="invalid">{errors.priority?.message}</Form.Control.Feedback>
          </Form.Group>
        </Col>
      </Row>
      <Form.Group controlId="authentication-execution-configuration">
        <Form.Label>{copy.configuration}</Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          isInvalid={Boolean(errors.configuration)}
          {...register("configuration")}
        />
        <Form.Control.Feedback type="invalid">
          {errors.configuration?.message}
        </Form.Control.Feedback>
      </Form.Group>
      <div className="admin-form-actions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          {copy.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? (
            <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
          ) : (
            <ActionIcon action="save" />
          )}
          {submitLabel}
        </Button>
      </div>
    </Form>
  );
}

function NodeRow({
  label,
  secondary,
  requirement,
  onOpen,
  onMoveUp,
  onMoveDown,
  onDelete,
  copy,
  disabled,
  movingNodeKey,
  nodeKey,
  opening,
}: NodeRowProps) {
  const movingUp = movingNodeKey === `${nodeKey}-UP`;
  const movingDown = movingNodeKey === `${nodeKey}-DOWN`;
  return (
    <div className="border rounded p-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
      <button
        className="btn btn-link text-start p-0 text-decoration-none"
        disabled={opening}
        onClick={onOpen}
        type="button"
      >
        <span className="d-block">
          {opening && <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />}
          {label}
        </span>
        <small className="text-body-secondary font-monospace">{secondary}</small>
      </button>
      <div className="d-flex align-items-center gap-2">
        <Badge
          bg={
            requirement === "DISABLED"
              ? "secondary"
              : requirement === "CONDITIONAL"
                ? "warning"
                : "primary"
          }
        >
          {requirement}
        </Badge>
        <Button
          aria-label={copy.moveUp}
          disabled={disabled || movingNodeKey !== null}
          onClick={onMoveUp}
          size="sm"
          variant="secondary"
        >
          {movingUp ? (
            <Spinner animation="border" aria-hidden="true" size="sm" />
          ) : (
            <ActionIcon action="previousPage" className="m-0" />
          )}
        </Button>
        <Button
          aria-label={copy.moveDown}
          disabled={disabled || movingNodeKey !== null}
          onClick={onMoveDown}
          size="sm"
          variant="secondary"
        >
          {movingDown ? (
            <Spinner animation="border" aria-hidden="true" size="sm" />
          ) : (
            <ActionIcon action="nextPage" className="m-0" />
          )}
        </Button>
        {onDelete && (
          <Button
            aria-label={copy.deleteExecution}
            disabled={disabled || movingNodeKey !== null}
            onClick={onDelete}
            size="sm"
            variant="danger"
          >
            <ActionIcon action="delete" className="m-0" />
          </Button>
        )}
      </div>
    </div>
  );
}

function BindingsCard({ bindings, flows, copy, saving, onSave }: BindingsCardProps) {
  return (
    <Card className="admin-panel-card">
      <Card.Body>
        <div className="admin-detail-heading">
          <div>
            <Card.Title>{copy.bindings}</Card.Title>
            <Card.Text className="text-body-secondary mb-0">{copy.singleIssuerNote}</Card.Text>
          </div>
        </div>
        <Table responsive className="align-middle mb-0">
          <thead>
            <tr>
              <th>{copy.name}</th>
              <th>{copy.flowGraph}</th>
              <th className="text-end">{copy.saveFlow}</th>
            </tr>
          </thead>
          <tbody>
            {bindings.map((binding: Binding) => (
              <BindingRow
                key={`${binding.bindingType}-${binding.flowId ?? "none"}`}
                binding={binding}
                flows={flows}
                copy={copy}
                saving={saving}
                onSave={onSave}
              />
            ))}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
}

function BindingRow({ binding, flows, copy, saving, onSave }: BindingRowProps) {
  const [flowId, setFlowId] = useState(String(binding.flowId ?? ""));
  return (
    <tr>
      <td className="font-monospace">{binding.bindingType}</td>
      <td>
        <Form.Select
          aria-label={binding.bindingType}
          value={flowId}
          onChange={(event) => setFlowId(event.target.value)}
        >
          <option value="">{copy.emptyBinding}</option>
          {binding.flowId !== null && !flows.some((flow) => flow.id === binding.flowId) && (
            <option value={binding.flowId}>
              {binding.flowName} ({binding.flowAlias})
            </option>
          )}
          {flows.map((flow: Flow) => (
            <option key={flow.id} value={flow.id}>
              {flow.name} ({flow.alias})
            </option>
          ))}
        </Form.Select>
      </td>
      <td className="text-end">
        <Button
          disabled={saving}
          onClick={() => onSave(binding.bindingType, flowId === "" ? null : Number(flowId))}
          variant="primary"
        >
          {saving ? (
            <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
          ) : (
            <ActionIcon action="save" />
          )}
          {flowId === "" ? copy.removeBinding : copy.saveFlow}
        </Button>
      </td>
    </tr>
  );
}
