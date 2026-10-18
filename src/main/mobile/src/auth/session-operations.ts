import { createSingleFlight, type SingleFlight } from "../../../shared/src/session.ts";
import type { MobileSession } from "./storage";
import type { MobileSessionNamespace } from "./session-keys";

const refreshByNamespace = new Map<
  MobileSessionNamespace,
  SingleFlight<MobileSession | null>
>();
const generationByNamespace = new Map<MobileSessionNamespace, number>();
const mutationByNamespace = new Map<MobileSessionNamespace, Promise<void>>();

export function sessionRefreshCoordinator(
  namespace: MobileSessionNamespace,
): SingleFlight<MobileSession | null> {
  let coordinator = refreshByNamespace.get(namespace);
  if (!coordinator) {
    coordinator = createSingleFlight<MobileSession | null>();
    refreshByNamespace.set(namespace, coordinator);
  }
  return coordinator;
}

export function sessionOperationGeneration(
  namespace: MobileSessionNamespace,
): number {
  return generationByNamespace.get(namespace) ?? 0;
}

export function invalidateSessionOperations(
  namespace: MobileSessionNamespace,
): number {
  const next = sessionOperationGeneration(namespace) + 1;
  generationByNamespace.set(namespace, next);
  return next;
}

export function isSessionOperationCurrent(
  namespace: MobileSessionNamespace,
  generation: number,
): boolean {
  return sessionOperationGeneration(namespace) === generation;
}

export function runSessionStorageMutation<T>(
  namespace: MobileSessionNamespace,
  operation: () => Promise<T>,
  generation?: number,
): Promise<T | undefined> {
  const previous = mutationByNamespace.get(namespace) ?? Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(async () => {
      if (
        generation !== undefined &&
        !isSessionOperationCurrent(namespace, generation)
      ) {
        return undefined;
      }
      return operation();
    });
  mutationByNamespace.set(
    namespace,
    current.then(
      () => undefined,
      () => undefined,
    ),
  );
  return current;
}
