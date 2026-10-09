"use client";
import { useDictionary } from "@/i18n/client";

import type { ReactNode } from "react";
import { Dropdown } from "react-bootstrap";
import { Icon } from "@/components/shared/Icon";

export function RowActions({ label, children }: { label?: string; children: ReactNode }) {
  const defaultLabel = useDictionary().admin.common.actions;
  return (
    <Dropdown align="end">
      <Dropdown.Toggle
        aria-label={label ?? defaultLabel}
        className="admin-row-actions-toggle"
        size="sm"
        variant="link"
      >
        <Icon icon="ellipsisVertical" />
      </Dropdown.Toggle>
      <Dropdown.Menu>{children}</Dropdown.Menu>
    </Dropdown>
  );
}
