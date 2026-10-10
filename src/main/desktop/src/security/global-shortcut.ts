export interface GlobalShortcutAdapter {
  unregisterAll(): void;
  register(accelerator: string, callback: () => void): boolean;
}

export interface GlobalShortcutRegistration {
  registered: boolean;
  accelerator: string;
}

export function registerGlobalShortcutWithFallback(
  adapter: GlobalShortcutAdapter,
  accelerator: string,
  fallback: string,
  callback: () => void,
): GlobalShortcutRegistration {
  adapter.unregisterAll();
  try {
    if (adapter.register(accelerator, callback)) {
      return { registered: true, accelerator };
    }
  } catch {
    // An unavailable accelerator is handled by the fallback below.
  }

  if (accelerator !== fallback) {
    try {
      if (adapter.register(fallback, callback)) {
        return { registered: false, accelerator: fallback };
      }
    } catch {
      // The caller receives a failure and can keep the shortcut disabled.
    }
  }

  return { registered: false, accelerator };
}
