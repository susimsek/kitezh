/** Creates the shared Axios transport used by web and native API adapters. */
exports.createApiClient = function createApiClient(axios, options = {}) {
  let tokenHandlers;
  let refreshInProgress;
  const client = axios.create({
    adapter: options.adapter,
    baseURL: options.baseURL,
    headers: options.headers,
    timeout: options.timeout,
    validateStatus: () => true,
  });

  client.interceptors.response.use(async (response) => {
    const request = response.config;
    if (response.status === 401 && !request._kitezhRetried) {
      const refresh =
        request._kitezhRefreshAccessToken ?? tokenHandlers?.refresh;
      if (refresh) {
        if (!refreshInProgress) {
          refreshInProgress = refresh().finally(() => {
            refreshInProgress = undefined;
          });
        }
        const accessToken = await refreshInProgress;
        if (accessToken) {
          request._kitezhRetried = true;
          request.headers.set("Authorization", `Bearer ${accessToken}`);
          return client.request(request);
        }
        tokenHandlers?.unauthorized?.();
      }
    }

    if (options.transformResponse) return options.transformResponse(response);
    return response;
  });

  return {
    client,
    registerTokenHandlers(handlers) {
      tokenHandlers = handlers;
    },
    request(config, requestOptions = {}) {
      const headers = { ...config.headers };
      if (requestOptions.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }
      return client.request({
        ...config,
        headers,
        _kitezhRefreshAccessToken: requestOptions.refreshAccessToken,
      });
    },
  };
};

/** Return a safe timeout cause for native API error classification. */
exports.getApiTransportCause = function getApiTransportCause(error) {
  const value = error && typeof error === "object" ? error : undefined;
  if (
    value?.code === "ECONNABORTED" ||
    value?.code === "ETIMEDOUT" ||
    value?.name === "TimeoutError"
  ) {
    const timeout = new Error("API request timed out");
    timeout.name = "TimeoutError";
    return timeout;
  }
  if (value?.code === "ERR_CANCELED" || value?.name === "AbortError") {
    const abort = new Error("API request aborted");
    abort.name = "AbortError";
    return abort;
  }
  return new Error("API request failed");
};

/** Decode Axios response bodies returned as JSON strings. */
exports.readApiResponseData = function readApiResponseData(value) {
  if (typeof value !== "string") return value === "" ? undefined : value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};
