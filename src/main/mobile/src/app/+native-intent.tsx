import { resolveNativeIntentPath } from "../../../shared/src/auth.ts";

export function redirectSystemPath({ path }: { path: string }) {
  try {
    return resolveNativeIntentPath(path) ?? path;
  } catch {
    return "/";
  }
}
