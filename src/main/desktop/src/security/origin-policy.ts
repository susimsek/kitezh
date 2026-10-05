import { RENDERER_HOST, RENDERER_PROTOCOL } from "../config";

export function isTrustedRendererUrl(value: string) {
  return value.startsWith(`${RENDERER_PROTOCOL}://${RENDERER_HOST}/`);
}

export function isTrustedRendererFrame(value: string | undefined) {
  return Boolean(value && isTrustedRendererUrl(value));
}
