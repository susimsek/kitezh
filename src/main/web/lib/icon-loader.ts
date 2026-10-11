import { library } from "@fortawesome/fontawesome-svg-core";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faAndroid,
  faApple,
  faGithub,
  faGoogle,
  faLinkedinIn,
  faLinux,
  faMicrosoft,
  faWindows,
} from "@fortawesome/free-brands-svg-icons";
import {
  faAddressCard,
  faAnglesLeft,
  faAnglesRight,
  faArrowLeft,
  faArrowRight,
  faArrowsRotate,
  faBan,
  faBars,
  faBuilding,
  faCheck,
  faCircle,
  faCircleCheck,
  faCircleInfo,
  faCircleQuestion,
  faCompass,
  faClock,
  faClockRotateLeft,
  faCopy,
  faCube,
  faDesktop,
  faDownload,
  faEllipsisVertical,
  faEnvelope,
  faEye,
  faEyeSlash,
  faFilter,
  faFloppyDisk,
  faGaugeHigh,
  faGlobe,
  faHeartPulse,
  faKey,
  faLaptop,
  faLayerGroup,
  faLock,
  faMagnifyingGlass,
  faMoon,
  faPen,
  faPlus,
  faPrint,
  faRightFromBracket,
  faRightToBracket,
  faRotate,
  faShieldHalved,
  faSliders,
  faSun,
  faTrash,
  faUnlock,
  faUser,
  faUserCheck,
  faUserMinus,
  faUserPlus,
  faUserSlash,
  faUserShield,
  faUsers,
  faUpload,
  faXmark,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

export type ActionIconName =
  | "add"
  | "assign"
  | "back"
  | "cancel"
  | "check"
  | "copy"
  | "download"
  | "delete"
  | "disable"
  | "edit"
  | "enable"
  | "filter"
  | "firstPage"
  | "lastPage"
  | "impersonate"
  | "login"
  | "logout"
  | "manage"
  | "next"
  | "nextPage"
  | "print"
  | "previousPage"
  | "regenerate"
  | "remove"
  | "revoke"
  | "rotate"
  | "save"
  | "search"
  | "send"
  | "show"
  | "submit"
  | "hide"
  | "unlock"
  | "upload"
  | "verify"
  | "view";

export type IconName =
  | "addressCard"
  | "android"
  | "apple"
  | "anglesLeft"
  | "anglesRight"
  | "bars"
  | "building"
  | "circle"
  | "circleInfo"
  | "circleQuestion"
  | "clock"
  | "clockRotateLeft"
  | "compass"
  | "cube"
  | "desktop"
  | "ellipsisVertical"
  | "globe"
  | "gaugeHigh"
  | "heartPulse"
  | "key"
  | "laptop"
  | "layerGroup"
  | "linux"
  | "lock"
  | "moon"
  | "shieldHalved"
  | "sliders"
  | "sun"
  | "user"
  | "userShield"
  | "users"
  | "windows"
  | "xmark"
  | "github"
  | "google"
  | "linkedin"
  | "microsoft";

export const actionIcons: Record<ActionIconName, IconDefinition> = {
  add: faPlus,
  assign: faUserPlus,
  back: faArrowLeft,
  cancel: faXmark,
  check: faCheck,
  copy: faCopy,
  download: faDownload,
  delete: faTrash,
  disable: faUserSlash,
  edit: faPen,
  enable: faUserCheck,
  filter: faFilter,
  firstPage: faAnglesLeft,
  impersonate: faUser,
  login: faRightToBracket,
  logout: faRightFromBracket,
  manage: faKey,
  next: faArrowRight,
  nextPage: faChevronRight,
  lastPage: faAnglesRight,
  print: faPrint,
  previousPage: faChevronLeft,
  regenerate: faArrowsRotate,
  remove: faUserMinus,
  revoke: faBan,
  rotate: faRotate,
  save: faFloppyDisk,
  search: faMagnifyingGlass,
  send: faEnvelope,
  show: faEye,
  submit: faArrowRight,
  hide: faEyeSlash,
  unlock: faUnlock,
  upload: faUpload,
  verify: faCircleCheck,
  view: faEye,
};

export const icons: Record<IconName, IconDefinition> = {
  addressCard: faAddressCard,
  android: faAndroid,
  apple: faApple,
  anglesLeft: faAnglesLeft,
  anglesRight: faAnglesRight,
  bars: faBars,
  building: faBuilding,
  circle: faCircle,
  circleInfo: faCircleInfo,
  circleQuestion: faCircleQuestion,
  clock: faClock,
  clockRotateLeft: faClockRotateLeft,
  compass: faCompass,
  cube: faCube,
  desktop: faDesktop,
  ellipsisVertical: faEllipsisVertical,
  globe: faGlobe,
  gaugeHigh: faGaugeHigh,
  heartPulse: faHeartPulse,
  key: faKey,
  laptop: faLaptop,
  layerGroup: faLayerGroup,
  linux: faLinux,
  lock: faLock,
  moon: faMoon,
  shieldHalved: faShieldHalved,
  sliders: faSliders,
  sun: faSun,
  user: faUser,
  userShield: faUserShield,
  users: faUsers,
  windows: faWindows,
  xmark: faXmark,
  github: faGithub,
  google: faGoogle,
  linkedin: faLinkedinIn,
  microsoft: faMicrosoft,
};

let loaded = false;

export const loadIcons = () => {
  if (loaded) return;

  library.add(
    faAndroid,
    faApple,
    faAnglesLeft,
    faAnglesRight,
    faAddressCard,
    faArrowLeft,
    faArrowRight,
    faArrowsRotate,
    faBan,
    faBars,
    faBuilding,
    faCheck,
    faCircle,
    faCircleCheck,
    faCircleInfo,
    faCircleQuestion,
    faCompass,
    faChevronLeft,
    faChevronRight,
    faClock,
    faClockRotateLeft,
    faCopy,
    faCube,
    faDesktop,
    faDownload,
    faEllipsisVertical,
    faEnvelope,
    faEye,
    faEyeSlash,
    faFilter,
    faFloppyDisk,
    faGaugeHigh,
    faGithub,
    faGlobe,
    faGoogle,
    faHeartPulse,
    faKey,
    faLaptop,
    faLayerGroup,
    faLinkedinIn,
    faLinux,
    faLock,
    faMagnifyingGlass,
    faMoon,
    faPen,
    faPlus,
    faPrint,
    faRightFromBracket,
    faRightToBracket,
    faRotate,
    faShieldHalved,
    faSliders,
    faSun,
    faTrash,
    faUnlock,
    faUser,
    faUserCheck,
    faUserMinus,
    faUserPlus,
    faUserSlash,
    faUserShield,
    faUsers,
    faWindows,
    faUpload,
    faXmark,
  );
  loaded = true;
};
