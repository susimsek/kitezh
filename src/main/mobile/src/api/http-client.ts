import axios from "axios";
import {
  createApiClient,
  getApiTransportCause,
  readApiResponseData,
} from "@kitezh/shared/api-client";
import { createClientMetadataHeaders } from "@kitezh/shared/client-metadata";
import { authorizationServerIssuer } from "../config.ts";

const clientHeaders = createClientMetadataHeaders({
  appVersion: process.env.EXPO_PUBLIC_APP_VERSION ?? "0.1.0",
  clientPlatform: process.env.EXPO_OS === "ios" ? "ios" : "android",
  os: process.env.EXPO_OS === "ios" ? "ios" : "android",
});

export function createMobileApiClient(timeout: number) {
  return createApiClient(axios, {
    adapter: ["xhr", "fetch"],
    baseURL: authorizationServerIssuer.replace(/\/$/, ""),
    headers: { Accept: "application/json", ...clientHeaders },
    timeout,
  });
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

export function getMobileTransportCause(error: unknown, timedOut: boolean) {
  return timedOut
    ? Object.assign(new Error("Native API request timed out"), {
        name: "TimeoutError",
      })
    : getApiTransportCause(error);
}
