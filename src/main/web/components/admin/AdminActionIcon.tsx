import { ActionIcon, type ActionIconName } from "@/components/shared/ActionIcon";

export type AdminAction = ActionIconName;

export function AdminActionIcon({ action }: { action: AdminAction }) {
  return <ActionIcon action={action} />;
}
