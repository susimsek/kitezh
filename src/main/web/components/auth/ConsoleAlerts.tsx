"use client";
import { useDictionary } from "@/i18n/client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type AlertVariant = "success" | "danger" | "warning" | "info";
type ConsoleAlert = { id: number; message: string; variant: AlertVariant };
type ConsoleAlertsApi = {
  addAlert: (message: string, variant?: AlertVariant) => void;
  addError: (message: string) => void;
};

const noopApi: ConsoleAlertsApi = { addAlert: () => undefined, addError: () => undefined };
const ConsoleAlertsContext = createContext<ConsoleAlertsApi | null>(null);

export function ConsoleAlertsProvider({ children }: { children: React.ReactNode }) {
  const closeLabel = useDictionary().admin.common.close;
  const [alerts, setAlerts] = useState<ConsoleAlert[]>([]);
  const nextId = useRef(0);
  const addAlert = useCallback((message: string, variant: AlertVariant = "success") => {
    nextId.current += 1;
    const id = nextId.current;
    setAlerts((current) => [...current, { id, message, variant }]);
    window.setTimeout(() => {
      setAlerts((current) => current.filter((item) => item.id !== id));
    }, 4500);
  }, []);
  const addError = useCallback((message: string) => addAlert(message, "danger"), [addAlert]);
  const api = useMemo(() => ({ addAlert, addError }), [addAlert, addError]);

  return (
    <ConsoleAlertsContext.Provider value={api}>
      {children}
      <div className="console-alert-stack" aria-live="polite" aria-atomic="true">
        {alerts.map((alert) => (
          <div
            className={`alert alert-${alert.variant} console-global-alert mb-2`}
            role="status"
            key={alert.id}
          >
            <span>{alert.message}</span>
            <button
              type="button"
              className="btn-close"
              aria-label={closeLabel}
              onClick={() => setAlerts((current) => current.filter((item) => item.id !== alert.id))}
            />
          </div>
        ))}
      </div>
    </ConsoleAlertsContext.Provider>
  );
}

export function useConsoleAlerts() {
  return useContext(ConsoleAlertsContext) ?? noopApi;
}
