import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { actionIcons, type ActionIconName } from "@/lib/icon-loader";

export function ActionIcon({
  action,
  className = "me-2",
}: {
  action: ActionIconName;
  className?: string;
}) {
  return (
    <FontAwesomeIcon aria-hidden className={className} fixedWidth icon={actionIcons[action]} />
  );
}

export type { ActionIconName };
