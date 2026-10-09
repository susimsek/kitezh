import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faArrowLeft,
  faArrowRight,
  faCheck,
  faGear,
  faGlobe,
  faHouse,
  faLayerGroup,
  faMoon,
  faRightFromBracket,
  faRotate,
  faShieldHalved,
  faSun,
} from "@fortawesome/free-solid-svg-icons";
import type { IconProp } from "@fortawesome/fontawesome-svg-core";
import type { ComponentProps } from "react";

import type { AppIconName } from "@kitezh/shared/icons";

const icons = {
  arrowLeft: faArrowLeft,
  arrowRight: faArrowRight,
  check: faCheck,
  logout: faRightFromBracket,
  reset: faRotate,
  gear: faGear,
  globe: faGlobe,
  home: faHouse,
  layers: faLayerGroup,
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
