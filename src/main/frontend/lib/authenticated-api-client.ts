import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { apiUrl, assertDesktopOnline } from "./desktop-api";

export type TokenHandlers = {
  refresh: () => Promise<string | null>;
  unauthorized: () => void;
};

type RetriableRequest = InternalAxiosRequestConfig & { _consoleRetried?: boolean };

type PageMetadata = {
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export function createAuthenticatedApiClient() {
  let tokenHandlers: TokenHandlers | undefined;
  const client = axios.create({ baseURL: apiUrl("/"), validateStatus: () => true });

  client.interceptors.response.use(async (response) => {
    response.data = normalizePageResponse(response.data);
    const request = response.config as RetriableRequest;
    if (response.status !== 401 || request._consoleRetried || !tokenHandlers) {
      return response;
    }

    const accessToken = await tokenHandlers.refresh();
    if (!accessToken) {
      tokenHandlers.unauthorized();
      return response;
    }

    request._consoleRetried = true;
    request.headers.set("Authorization", `Bearer ${accessToken}`);
    return client.request(request);
  });

  return {
    registerTokenHandlers(handlers: TokenHandlers | undefined) {
      tokenHandlers = handlers;
    },
    request<T>(accessToken: string, config: AxiosRequestConfig) {
      try {
        assertDesktopOnline(config.method);
      } catch (error) {
        return Promise.reject(error);
      }
      return client.request<T>({
        ...config,
        headers: {
          ...config.headers,
          Authorization: `Bearer ${accessToken}`,
        },
        validateStatus: () => true,
      });
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
