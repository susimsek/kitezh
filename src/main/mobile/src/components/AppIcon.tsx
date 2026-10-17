import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faArrowLeft,
  faArrowRight,
  faBell,
  faBan,
  faCheck,
  faCircleCheck,
  faFloppyDisk,
  faGear,
  faGlobe,
  faHouse,
  faLayerGroup,
  faMinus,
  faMoon,
  faPenToSquare,
  faPaperPlane,
  faPlus,
  faRightFromBracket,
  faRotate,
  faShieldHalved,
  faSun,
  faTrashCan,
  faUpload,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import type { IconProp } from "@fortawesome/fontawesome-svg-core";
import type { ComponentProps } from "react";

import type { AppIconName } from "@kitezh/shared/icons";

const icons = {
  add: faPlus,
  bell: faBell,
  arrowLeft: faArrowLeft,
  arrowRight: faArrowRight,
  check: faCheck,
  delete: faTrashCan,
  disable: faBan,
  edit: faPenToSquare,
  enable: faCircleCheck,
  logout: faRightFromBracket,
  remove: faMinus,
  reset: faRotate,
  save: faFloppyDisk,
  gear: faGear,
  globe: faGlobe,
  home: faHouse,
  layers: faLayerGroup,
  moon: faMoon,
  shield: faShieldHalved,
  send: faPaperPlane,
  sun: faSun,
  trash: faTrashCan,
  upload: faUpload,
  user: faUser,
} satisfies Record<AppIconName, IconProp>;

type AppIconProps = Omit<ComponentProps<typeof FontAwesomeIcon>, "icon"> & {
  name: AppIconName;
};

export function AppIcon({ name, ...props }: AppIconProps) {
  return <FontAwesomeIcon icon={icons[name]} {...props} />;
}
