/** Adapts Axios's fetch-adapter Request input to the existing fetch test mocks. */
export function installAxiosFetchMockCompatibility() {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  let currentFetch = nativeFetch;
  const normalizedFetch: typeof fetch = async (input, init) => {
    if (input instanceof Request && init === undefined) {
      const body = input.body ? await input.clone().text() : undefined;
      const signal = input.signal;
      if (signal.aborted) {
        throw Object.assign(new Error("The operation was aborted"), {
          name: "AbortError",
        });
      }
      return currentFetch(input.url, {
        body,
        headers: input.headers,
        method: input.method,
        signal,
      });
    }
    return currentFetch(input, init);
  };
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    get: () => normalizedFetch,
    set: (handler: typeof fetch) => {
      currentFetch = handler === normalizedFetch ? nativeFetch : handler;
    },
  });
}
