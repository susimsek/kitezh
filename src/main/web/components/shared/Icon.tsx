import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { icons, type IconName } from "@/lib/icon-loader";

export function Icon({
  icon,
  className,
  size,
}: {
  icon: IconName;
  className?: string;
  size?: "2xs" | "xs" | "sm" | "lg" | "xl" | "2xl" | "1x" | "2x" | "3x" | "4x" | "5x";
}) {
  return (
    <FontAwesomeIcon
      aria-hidden="true"
      className={className}
      fixedWidth
      icon={icons[icon]}
      size={size}
    />
  );
}

export type { IconName };
