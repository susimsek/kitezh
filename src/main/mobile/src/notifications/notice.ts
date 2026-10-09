export type NoticeKind = "error" | "info" | "success";

export const DEFAULT_NOTICE_DURATION_MS = 4_000;

export function normalizeNoticeDuration(durationMs?: number): number {
  if (!Number.isFinite(durationMs)) return DEFAULT_NOTICE_DURATION_MS;
  return Math.min(Math.max(Math.round(durationMs ?? 0), 1_000), 10_000);
}
