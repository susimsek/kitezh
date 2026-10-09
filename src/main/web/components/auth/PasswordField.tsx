"use client";

import { type ComponentProps, useState } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";

import { ActionIcon } from "@/components/shared/ActionIcon";
import { Icon } from "@/components/shared/Icon";

type PasswordFieldProps = {
  controlId?: string;
  label: string;
  autoComplete?: string;
  placeholder: string;
  showLabel: string;
  hideLabel: string;
  error?: string;
  inputProps?: ComponentProps<typeof Form.Control>;
};

export function PasswordField({
  controlId = "password",
  label,
  autoComplete = "current-password",
  placeholder,
  showLabel,
  hideLabel,
  error,
  inputProps,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Form.Group className="mb-4" controlId={controlId}>
      <Form.Label>{label}</Form.Label>
      <InputGroup hasValidation={Boolean(error)}>
        <InputGroup.Text>
          <Icon icon="lock" />
        </InputGroup.Text>
        <Form.Control
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          {...inputProps}
        />
        <Button
          variant="link"
          className="console-input-action"
          type="button"
          aria-label={visible ? hideLabel : showLabel}
          onClick={() => setVisible((value) => !value)}
        >
          <ActionIcon action={visible ? "hide" : "show"} className="m-0" />
        </Button>
      </InputGroup>
      {error && (
        <Form.Control.Feedback className="d-block" type="invalid">
          {error}
        </Form.Control.Feedback>
      )}
    </Form.Group>
  );
}
