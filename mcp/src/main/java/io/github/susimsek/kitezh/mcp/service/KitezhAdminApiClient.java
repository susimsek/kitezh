package io.github.susimsek.kitezh.mcp.service;

import io.github.susimsek.kitezh.mcp.config.ApplicationProperties;
import io.github.susimsek.kitezh.mcp.service.client.KitezhAdminApiHttpClient;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

@Component
@RequiredArgsConstructor
public class KitezhAdminApiClient {

    private final KitezhAdminApiHttpClient httpClient;
    private final MeterRegistry meterRegistry;
    private final ApplicationProperties properties;

    public Map<?, ?> get(String tool, String path, Map<String, ?> parameters) {
        return execute(tool, () -> httpClient.get(buildUri(path, parameters)));
    }

    public List<Map<String, Object>> getList(String tool, String path, Map<String, ?> parameters) {
        return execute(tool, () -> httpClient.getList(buildUri(path, parameters)));
    }

    private <T> T execute(String tool, Supplier<T> operation) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String outcome = "success";
        try {
            return operation.get();
        } catch (RuntimeException exception) {
            outcome = "error";
            if (exception instanceof KitezhApiException kitezhApiException) {
                throw kitezhApiException;
            }
            if (exception instanceof RestClientResponseException) {
                throw new KitezhApiException("Kitezh API request failed");
            }
            throw new KitezhApiException("Kitezh API is unavailable", exception);
        } finally {
            meterRegistry
                    .counter(
                            "kitezh_mcp_kitezh_api_requests_total",
                            "tool",
                            tool,
                            "outcome",
                            outcome)
                    .increment();
            sample.stop(
                    Timer.builder("kitezh_mcp_kitezh_api_request_duration_seconds")
                            .tag("tool", tool)
                            .register(meterRegistry));
        }
    }

    private URI buildUri(String path, Map<String, ?> parameters) {
        UriComponentsBuilder uriBuilder =
                UriComponentsBuilder.fromUriString(properties.api().baseUrl()).path(path);
        parameters.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(
                        entry -> {
                            String name = entry.getKey();
                            Object value = entry.getValue();
                            if (value != null) {
                                uriBuilder.queryParam(name, value);
                            }
                        });
        return uriBuilder.build().encode().toUri();
    }

    public static class KitezhApiException extends RuntimeException {

        public KitezhApiException(String message) {
            super(message);
        }

        public KitezhApiException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
