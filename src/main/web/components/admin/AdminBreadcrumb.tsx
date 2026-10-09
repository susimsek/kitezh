"use client";
import { useDictionary } from "@/i18n/client";

import Link from "@/routing/Link";

export type AdminBreadcrumbItem = {
  label: string;
  href?: string;
};

export function AdminBreadcrumb({ items }: { items: AdminBreadcrumbItem[] }) {
  const breadcrumbLabel = useDictionary().admin.common.breadcrumb;
  if (items.length === 0) return null;
  return (
    <nav className="admin-breadcrumb" aria-label={breadcrumbLabel}>
      <ol className="breadcrumb mb-0">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li
              className={`breadcrumb-item${current ? " active" : ""}`}
              aria-current={current ? "page" : undefined}
              key={`${item.label}-${index}`}
            >
              {!current && item.href ? (
                <Link href={item.href} className="text-decoration-none">
                  {item.label}
                </Link>
              ) : (
                item.label
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
