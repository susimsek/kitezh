"use client";

import Link from "@/routing/Link";
import { Nav } from "react-bootstrap";

export type DetailTab = { key: string; label: string; href?: string; onSelect?: () => void };

export function DetailTabs({ tabs, active }: { tabs: DetailTab[]; active: string }) {
  return (
    <div className="admin-detail-tabs-wrap">
      <Nav
        className="admin-detail-tabs flex-nowrap"
        activeKey={active}
        onSelect={(eventKey) => tabs.find((tab) => tab.key === eventKey)?.onSelect?.()}
      >
        {tabs.map((tab) => (
          <Nav.Item key={tab.key}>
            {tab.href ? (
              <Nav.Link as={Link} eventKey={tab.key} href={tab.href} onClick={tab.onSelect}>
                {tab.label}
              </Nav.Link>
            ) : (
              <Nav.Link
                as="button"
                type="button"
                eventKey={tab.key}
                onClick={() => tab.onSelect?.()}
              >
                {tab.label}
              </Nav.Link>
            )}
          </Nav.Item>
        ))}
      </Nav>
    </div>
  );
}
