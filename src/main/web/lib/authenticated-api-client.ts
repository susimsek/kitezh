import type { AxiosRequestConfig } from "axios";
import axios from "axios";
import {
  createApiClient,
  type ApiClientResponse,
  type ApiTokenHandlers,
} from "@kitezh/shared/api-client";
import { apiUrl, assertDesktopOnline } from "./desktop-api";
import { getClientMetadataHeaders } from "./client-metadata";

export type TokenHandlers = ApiTokenHandlers & { unauthorized: () => void };

type PageMetadata = {
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export function createAuthenticatedApiClient() {
  const apiClient = createApiClient(axios, {
    baseURL: apiUrl("/"),
    headers: getClientMetadataHeaders(),
    transformResponse: (response) => {
      response.data = normalizePageResponse(response.data);
      return response;
    },
  });

  return {
    registerTokenHandlers(handlers: TokenHandlers | undefined) {
      apiClient.registerTokenHandlers(handlers);
    },
    request<T>(accessToken: string, config: AxiosRequestConfig): Promise<ApiClientResponse<T>> {
      try {
        assertDesktopOnline(config.method);
      } catch (error) {
        return Promise.reject(error);
      }
      return apiClient.request<T>(config, { accessToken });
    },
  };
}

function normalizePageResponse(data: unknown) {
  if (!data || typeof data !== "object" || !("page" in data)) return data;

  const pageResponse = data as { page?: unknown } & Record<string, unknown>;
  const metadata = pageResponse.page;
  if (!isPageMetadata(metadata)) return data;

  const content = { ...pageResponse };
  delete content.page;
  return { ...content, ...metadata };
}

function isPageMetadata(value: unknown): value is PageMetadata {
  if (!value || typeof value !== "object") return false;
  const metadata = value as Partial<PageMetadata>;
  return (
    typeof metadata.number === "number" &&
    typeof metadata.size === "number" &&
    typeof metadata.totalElements === "number" &&
    typeof metadata.totalPages === "number"
  );
}
