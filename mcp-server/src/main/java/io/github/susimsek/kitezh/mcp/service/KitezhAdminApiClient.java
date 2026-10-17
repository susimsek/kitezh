package io.github.susimsek.kitezh.mcp.service;

import io.github.susimsek.kitezh.mcp.config.ApplicationProperties;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

@Component
@RequiredArgsConstructor
public class KitezhAdminApiClient {

    private static final ParameterizedTypeReference<List<Map<String, Object>>> MAP_LIST_TYPE =
            new ParameterizedTypeReference<>() {};

    private final RestClient restClient;
    private final KitezhTokenExchangeClient tokenExchangeClient;
    private final MeterRegistry meterRegistry;
    private final ApplicationProperties properties;

    public Map<?, ?> get(String tool, String path, Map<String, ?> parameters) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String outcome = "success";
        try {
            String token = tokenExchangeClient.exchange(currentJwt());
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
            String uri = uriBuilder.build().encode().toUriString();
            return restClient
                    .get()
                    .uri(uri)
                    .headers(headers -> headers.setBearerAuth(token))
                    .retrieve()
                    .onStatus(
                            HttpStatusCode::isError,
                            (request, response) -> {
                                throw new KitezhApiException("Kitezh API request failed");
                            })
                    .body(Map.class);
        } catch (RuntimeException exception) {
            outcome = "error";
            throw exception instanceof KitezhApiException
                    ? exception
                    : new KitezhApiException("Kitezh API is unavailable", exception);
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

    public List<Map<String, Object>> getList(String tool, String path, Map<String, ?> parameters) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String outcome = "success";
        try {
            String token = tokenExchangeClient.exchange(currentJwt());
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
            String uri = uriBuilder.build().encode().toUriString();
            return restClient
                    .get()
                    .uri(uri)
                    .headers(headers -> headers.setBearerAuth(token))
                    .retrieve()
                    .onStatus(
                            HttpStatusCode::isError,
                            (request, response) -> {
                                throw new KitezhApiException("Kitezh API request failed");
                            })
                    .body(MAP_LIST_TYPE);
        } catch (RuntimeException exception) {
            outcome = "error";
            throw exception instanceof KitezhApiException
                    ? exception
                    : new KitezhApiException("Kitezh API is unavailable", exception);
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

    private static Jwt currentJwt() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            return jwt;
        }
        throw new KitezhApiException("An authenticated Kitezh user is required");
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
