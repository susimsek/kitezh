import type {
  AxiosAdapter,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

export type ApiTokenHandlers = {
  refresh: () => Promise<string | null>;
  unauthorized?: () => void;
};

export type ApiClientRequestOptions = {
  accessToken?: string | null;
  refreshAccessToken?: () => Promise<string | null>;
};

export type ApiClientOptions = {
  baseURL?: string;
  headers?: AxiosRequestConfig["headers"];
  timeout?: number;
  adapter?: AxiosAdapter | AxiosRequestConfig["adapter"];
  transformResponse?: (response: AxiosResponse) => AxiosResponse;
};

export type RetriableAxiosRequest = InternalAxiosRequestConfig & {
  _kitezhRetried?: boolean;
  _kitezhRefreshAccessToken?: () => Promise<string | null>;
};

export function createApiClient(
  axios: object,
  options?: ApiClientOptions,
): {
  client: import("axios").AxiosInstance;
  registerTokenHandlers(handlers: ApiTokenHandlers | undefined): void;
  request<T = unknown>(
    config: AxiosRequestConfig,
    requestOptions?: ApiClientRequestOptions,
  ): Promise<AxiosResponse<T>>;
};

export function getApiTransportCause(error: unknown): Error;
export function readApiResponseData(value: unknown): unknown;
