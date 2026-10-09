"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useRouter } from "@/routing/navigation";
import { Button, Card, Form, Spinner } from "react-bootstrap";
import { useForm } from "@/lib/form";
import { z } from "zod";

import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { applyProblemToForm } from "@/lib/problem-detail";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";

type Group = { id: number; name: string; path: string };

export function GroupCreateForm({ dictionary }: { dictionary: Dictionary; locale: Locale }) {
  const { access, accessToken } = useAdminAuth();
  const canManageUsers = Boolean(access?.manageUsers);
  const alerts = useConsoleAlerts();
  const router = useRouter();
  const copy = dictionary.admin.groups;
  const [groups, setGroups] = useState<Group[]>([]);
  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(1, dictionary.admin.common.validation.required)
      .max(100, dictionary.admin.common.validation.max100),
    parentId: z.string(),
    attributesJson: z.string().refine((value) => {
      if (!value.trim()) return true;
      try {
        const parsed: unknown = JSON.parse(value);
        return (
          typeof parsed === "object" &&
          parsed !== null &&
          Object.values(parsed).every(
            (values) => Array.isArray(values) && values.every((item) => typeof item === "string"),
          )
        );
      } catch {
        return false;
      }
    }, copy.attributeFormat),
    defaultGroup: z.boolean(),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { name: "", parentId: "", attributesJson: "", defaultGroup: false },
  });

  useEffect(() => {
    if (!accessToken || !canManageUsers) return;
    adminRequest<PageResponse<Group>>(accessToken, { url: "/api/admin/groups?page=0&size=100" })
      .then((response) => setGroups(response.status < 300 ? response.data.content : []))
      .catch(() => setGroups([]));
  }, [accessToken, canManageUsers]);

  const submit = async ({
    name,
    parentId,
    attributesJson,
    defaultGroup,
  }: z.infer<typeof schema>) => {
    if (!accessToken || !canManageUsers) return;
    try {
      const response = await adminRequest<Group>(accessToken, {
        url: "/api/admin/groups",
        method: "POST",
        data: {
          name,
          parentId: parentId ? Number(parentId) : null,
          attributes: attributesJson.trim() ? JSON.parse(attributesJson) : {},
          defaultGroup,
        },
      });
      if (response.status >= 300) {
        const result = applyProblemToForm(response.data, setError, {
          fields: ["name"],
          fallbackMessage: (_, problem) =>
            problem.errorCode === "group_duplicate_name"
              ? dictionary.admin.common.validation.groupDuplicate
              : dictionary.admin.common.validation.required,
        });
        if (result.firstField) {
          return;
        }
        throw new Error();
      }
      router.push(`/admin/groups/${response.data.id}/details`);
    } catch {
      alerts.addError(copy.operationError);
    }
  };

  return (
    <Card className="admin-panel-card admin-create-card">
      <Card.Body>
        <Form className="admin-create-form" noValidate onSubmit={handleSubmit(submit)}>
          <Form.Group className="mb-3" controlId="group-name">
            <Form.Label>{copy.name}</Form.Label>
            <Form.Control
              autoComplete="off"
              autoFocus
              isInvalid={Boolean(errors.name)}
              maxLength={100}
              placeholder="finance-operators"
              disabled={!canManageUsers}
              {...register("name")}
            />
            <Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback>
            <Form.Text>{copy.help}</Form.Text>
          </Form.Group>
          <Form.Group className="mb-3" controlId="group-attributes">
            <Form.Label>{copy.attributes}</Form.Label>
            <Form.Control
              as="textarea"
              isInvalid={Boolean(errors.attributesJson)}
              rows={4}
              placeholder='{"department":["finance"]}'
              {...register("attributesJson")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.attributesJson?.message}
            </Form.Control.Feedback>
            <Form.Text>{copy.attributesHelp}</Form.Text>
          </Form.Group>
          <Form.Check
            className="mb-3"
            id="group-default"
            label={copy.defaultGroup}
            {...register("defaultGroup")}
          />
          <Form.Group className="mb-3" controlId="group-parent">
            <Form.Label>{copy.parent}</Form.Label>
            <Form.Select disabled={!canManageUsers} {...register("parentId")}>
              <option value="">{copy.rootGroup}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.path}
                </option>
              ))}
            </Form.Select>
            <Form.Text>{copy.parentHelp}</Form.Text>
          </Form.Group>
          <div className="admin-create-actions">
            <Button variant="secondary" onClick={() => router.push(`/admin/groups`)}>
              <AdminActionIcon action="cancel" />
              {dictionary.admin.common.cancel}
            </Button>
            <Button disabled={!canManageUsers || isSubmitting} type="submit">
              {isSubmitting ? (
                <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
              ) : (
                <AdminActionIcon action="add" />
              )}
              {copy.create}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}
