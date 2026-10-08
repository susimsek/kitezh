"use client";

import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { Icon } from "@/components/shared/Icon";

export function HelpItem({ label, help }: { label: string; help: string }) {
  return (
    <span className="d-inline-flex align-items-center gap-1">
      <span>{label}</span>
      <OverlayTrigger placement="top" overlay={<Tooltip>{help}</Tooltip>}>
        <button className="console-help-button" type="button" aria-label={`${label} help`}>
          <Icon icon="circleQuestion" />
        </button>
      </OverlayTrigger>
    </span>
  );
}
