import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import {
  createApiClient,
  getApiTransportCause,
  readApiResponseData,
} from "@kitezh/shared/api-client";
import type { ApiClientRequestOptions } from "@kitezh/shared/api-client";
import { createClientMetadataHeaders } from "@kitezh/shared/client-metadata";
import { getMobileApiLocale } from "../i18n/api-locale.ts";
import { authorizationServerIssuer } from "../config.ts";

const clientHeaders = createClientMetadataHeaders({
  appVersion: process.env.EXPO_PUBLIC_APP_VERSION ?? "0.1.0",
  clientPlatform: process.env.EXPO_OS === "ios" ? "ios" : "android",
  os: process.env.EXPO_OS === "ios" ? "ios" : "android",
});

export function createMobileApiClient(timeout: number) {
  const client = createApiClient(axios, {
    adapter: ["xhr", "fetch"],
    baseURL: authorizationServerIssuer.replace(/\/$/, ""),
    headers: { Accept: "application/json", ...clientHeaders },
    timeout,
  });
  return {
    ...client,
    request<T = unknown>(
      config: AxiosRequestConfig,
      options?: ApiClientRequestOptions,
    ): Promise<AxiosResponse<T>> {
      return client.request<T>(
        {
          ...config,
          headers: {
            "Accept-Language": getMobileApiLocale(),
            ...config.headers,
          },
        },
        options,
      );
    },
  };
}

export function toHeaderRecord(headers?: HeadersInit) {
  const values: Record<string, string> = {};
  new Headers(headers).forEach((value, name) => {
    values[name] = value;
  });
  return values;
}

export function readMobileResponseData(value: unknown) {
  return readApiResponseData(value);
}

export function getMobileTransportCause(error: unknown) {
  if (error instanceof Error && error.name === "TimeoutError") return error;
  if (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT")
  ) {
    return Object.assign(new Error("Native API request timed out"), {
      name: "TimeoutError",
    });
  }
  return getApiTransportCause(error);
}
