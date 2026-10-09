import { Button, Modal, Spinner, type ButtonProps } from "react-bootstrap";

import { ActionIcon, type ActionIconName } from "@/components/shared/ActionIcon";

export function ConfirmModal({
  show,
  message,
  cancelLabel,
  confirmLabel,
  confirmAction = "check",
  confirmVariant = "danger",
  busy = false,
  onCancel,
  onConfirm,
}: {
  show: boolean;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmAction?: ActionIconName;
  confirmVariant?: ButtonProps["variant"];
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal centered onHide={onCancel} show={show}>
      <Modal.Body>{message}</Modal.Body>
      <Modal.Footer>
        <Button disabled={busy} onClick={onCancel} type="button" variant="secondary">
          <ActionIcon action="cancel" />
          {cancelLabel}
        </Button>
        <Button disabled={busy} onClick={onConfirm} type="button" variant={confirmVariant}>
          {busy ? (
            <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
          ) : (
            <ActionIcon action={confirmAction} />
          )}
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
