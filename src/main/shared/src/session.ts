/**
 * Coalesces concurrent session operations into one promise.
 *
 * The coordinator is intentionally platform-neutral. Mobile SecureStore and
 * desktop vault adapters decide what the operation does; this helper only
 * prevents refresh races and clears itself after success or failure.
 */
export type SingleFlight<T> = {
  run: (operation: () => Promise<T>) => Promise<T>;
  pending: () => boolean;
};

export function createSingleFlight<T>(): SingleFlight<T> {
  let active: Promise<T> | null = null;
  return {
    run(operation) {
      if (active) return active;
      active = operation().finally(() => {
        active = null;
      });
      return active;
    },
    pending: () => active !== null,
  };
}
