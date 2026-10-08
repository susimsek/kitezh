import { Button, Modal } from "react-bootstrap";

import { ActionIcon } from "@/components/shared/ActionIcon";

export function ResultModal({
  show,
  title,
  message,
  value,
  closeLabel,
  onClose,
}: {
  show: boolean;
  title: string;
  message: string;
  value?: string | null;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <Modal centered onHide={onClose} show={show}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-body-secondary mb-0">{message}</p>
        {value && (
          <div className="font-monospace border rounded p-3 text-break bg-body-tertiary mt-3">
            {value}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onClose}>
          <ActionIcon action="cancel" />
          {closeLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
