import type { IconName } from "@/components/shared/Icon";

const PROVIDER_ICON_MAP: Record<string, IconName> = {
  generic: "globe",
  globe: "globe",
  google: "google",
  github: "github",
  linkedin: "linkedin",
  microsoft: "microsoft",
  building: "building",
  key: "key",
  shield: "shieldHalved",
};

export function providerIcon(iconKey: string | undefined): IconName {
  return (iconKey && PROVIDER_ICON_MAP[iconKey]) || "globe";
}
