import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faArrowRight,
  faGear,
  faGlobe,
  faHouse,
  faMoon,
  faShieldHalved,
  faSun,
} from "@fortawesome/free-solid-svg-icons";
import type { IconProp } from "@fortawesome/fontawesome-svg-core";
import type { ComponentProps } from "react";

import type { AppIconName } from "@kitezh/shared/icons";

const icons = {
  arrowRight: faArrowRight,
  gear: faGear,
  globe: faGlobe,
  home: faHouse,
  moon: faMoon,
  shield: faShieldHalved,
  sun: faSun,
} satisfies Record<string, IconProp>;

type AppIconProps = Omit<ComponentProps<typeof FontAwesomeIcon>, "icon"> & {
  name: AppIconName;
};

export function AppIcon({ name, ...props }: AppIconProps) {
  return <FontAwesomeIcon icon={icons[name]} {...props} />;
}
