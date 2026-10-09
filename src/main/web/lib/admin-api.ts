import type { AxiosRequestConfig } from "axios";

import { createAuthenticatedApiClient, type TokenHandlers } from "./authenticated-api-client";

const adminApi = createAuthenticatedApiClient();

export function registerAdminTokenHandlers(handlers: TokenHandlers | undefined) {
  adminApi.registerTokenHandlers(handlers);
}

export function adminRequest<T>(accessToken: string, config: AxiosRequestConfig) {
  return adminApi.request<T>(accessToken, config);
}
