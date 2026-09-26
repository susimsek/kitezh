import { useEffect, useRef, useState } from "react";

export type RegistrationCaptchaSettings = {
  enabled: boolean;
  provider: "recaptcha" | "enterprise" | "";
  siteKey: string;
  action: string;
  recaptchaV3: boolean;
  useRecaptchaNet: boolean;
};

type CaptchaApi = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
  render?: (
    container: HTMLElement,
    options: {
      sitekey: string;
      size: "compact";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => number;
  reset?: (widgetId?: number) => void;
};

declare global {
  interface Window {
    grecaptcha?: CaptchaApi & { enterprise?: CaptchaApi };
  }
}

const scriptPromises = new Map<string, Promise<void>>();

function loadScript(url: string) {
  const existing = scriptPromises.get(url);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("CAPTCHA script could not be loaded"));
    document.head.appendChild(script);
  });
  scriptPromises.set(url, promise);
  return promise;
}

function getApi(settings: RegistrationCaptchaSettings) {
  const grecaptcha = window.grecaptcha;
  return settings.provider === "enterprise" ? grecaptcha?.enterprise : grecaptcha;
}

function scriptUrl(settings: RegistrationCaptchaSettings, locale: string) {
  const host = settings.useRecaptchaNet ? "recaptcha.net" : "google.com";
  const script = settings.provider === "enterprise" ? "enterprise.js" : "api.js";
  const render = settings.recaptchaV3 ? `&render=${encodeURIComponent(settings.siteKey)}` : "";
  return `https://www.${host}/recaptcha/${script}?hl=${encodeURIComponent(locale)}${render}`;
}

export function RegistrationCaptcha({
  settings,
  locale,
  label,
  onTokenChange,
  onReady,
  onError,
}: {
  settings: RegistrationCaptchaSettings;
  locale: string;
  label: string;
  onTokenChange: (token: string | null) => void;
  onReady: (getToken: (() => Promise<string | null>) | null) => void;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<string | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    if (!settings.enabled) return;
    let cancelled = false;
    tokenRef.current = null;
    widgetIdRef.current = null;
    onTokenChange(null);
    onReady(null);
    void loadScript(scriptUrl(settings, locale))
      .then(() => {
        if (cancelled) return;
        const api = getApi(settings);
        if (!api) {
          onError();
          return;
        }
        const getToken = () => {
          if (!settings.recaptchaV3) return Promise.resolve(tokenRef.current);
          return new Promise<string | null>((resolve) => {
            api.ready(() => {
              api
                .execute(settings.siteKey, { action: settings.action })
                .then((token) => {
                  tokenRef.current = token;
                  onTokenChange(token);
                  resolve(token);
                })
                .catch(() => {
                  onError();
                  resolve(null);
                });
            });
          });
        };
        onReady(getToken);
        if (!settings.recaptchaV3) {
          api.ready(() => {
            if (cancelled || !api.render || !containerRef.current) {
              if (!cancelled) onError();
              return;
            }
            try {
              widgetIdRef.current = api.render(containerRef.current, {
                sitekey: settings.siteKey,
                size: "compact",
                callback: (token) => {
                  tokenRef.current = token;
                  setSolved(true);
                  onTokenChange(token);
                },
                "expired-callback": () => {
                  tokenRef.current = null;
                  setSolved(false);
                  onTokenChange(null);
                },
                "error-callback": () => {
                  tokenRef.current = null;
                  setSolved(false);
                  onTokenChange(null);
                  onError();
                },
              });
            } catch {
              onError();
            }
          });
        }
      })
      .catch(() => {
        if (!cancelled) onError();
      });
    return () => {
      cancelled = true;
      onReady(null);
      const api = getApi(settings);
      if (widgetIdRef.current !== null) api?.reset?.(widgetIdRef.current);
    };
  }, [locale, onError, onReady, onTokenChange, settings]);

  if (!settings.enabled) return null;
  return <div ref={containerRef} aria-label={label} className={solved ? "d-none" : undefined} />;
}
