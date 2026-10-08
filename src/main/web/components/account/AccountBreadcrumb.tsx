import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";

export function AccountBreadcrumb({ homeLabel, current }: { homeLabel: string; current: string }) {
  return <AdminBreadcrumb items={[{ label: homeLabel }, { label: current }]} />;
}
