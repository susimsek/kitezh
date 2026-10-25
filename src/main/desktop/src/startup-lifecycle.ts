import type { App, Event } from "electron";

export interface DesktopLifecycleHandlers {
  onSecondInstance(event: Event, commandLine: string[]): void;
  onOpenUrl(event: Event, url: string): void;
  onUncaughtException(error: Error): void;
  onUnhandledRejection(reason: unknown): void;
  onBeforeQuit(): void;
  onWindowAllClosed(): void;
  onReady(): Promise<void>;
  onStartupFailure(error: unknown): void;
}

export function registerDesktopLifecycle(
  app: App,
  process: NodeJS.Process,
  handlers: DesktopLifecycleHandlers,
): boolean {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }

  app.on("second-instance", handlers.onSecondInstance);
  app.on("open-url", handlers.onOpenUrl);
  void app.whenReady().then(handlers.onReady).catch(handlers.onStartupFailure);
  process.on("uncaughtExceptionMonitor", handlers.onUncaughtException);
  process.on("unhandledRejection", handlers.onUnhandledRejection);
  app.on("before-quit", handlers.onBeforeQuit);
  app.on("window-all-closed", handlers.onWindowAllClosed);
  return true;
}
