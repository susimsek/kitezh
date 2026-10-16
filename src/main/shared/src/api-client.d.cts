export type ApiClientResponse<T = unknown> = {
  data: T;
  status: number;
  statusText: string;
  headers: object;
  config: object;
  request?: unknown;
};

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
  headers?: object;
  timeout?: number;
  adapter?: object;
  transformResponse?: (
    response: ApiClientResponse<unknown>,
  ) => ApiClientResponse<unknown>;
};

export type RetriableAxiosRequest = Record<string, unknown> & {
  _kitezhRetried?: boolean;
  _kitezhRefreshAccessToken?: () => Promise<string | null>;
};

export function createApiClient(
  axios: object,
  options?: ApiClientOptions,
): {
  client: object;
  registerTokenHandlers(handlers: ApiTokenHandlers | undefined): void;
  request<T = unknown>(
    config: object,
    requestOptions?: ApiClientRequestOptions,
  ): Promise<ApiClientResponse<T>>;
};

export function getApiTransportCause(error: unknown): Error;
export function readApiResponseData(value: unknown): unknown;
