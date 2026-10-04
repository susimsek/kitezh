package io.github.susimsek.kitezh.config.http;

import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

/** Builds HTTP Service Client proxies for MockRestServiceServer tests. */
public final class HttpServiceClientFactory {

    private HttpServiceClientFactory() {}

    public static <T> T create(Class<T> clientType, RestClient restClient) {
        return HttpServiceProxyFactory.builderFor(RestClientAdapter.create(restClient))
                .build()
                .createClient(clientType);
    }
}
