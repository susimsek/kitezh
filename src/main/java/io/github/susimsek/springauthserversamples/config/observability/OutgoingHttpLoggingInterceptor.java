package io.github.susimsek.springauthserversamples.config.observability;

import java.io.IOException;
import java.net.URI;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;

/** Logs outgoing HTTP request metadata when explicitly enabled for diagnostics. */
public final class OutgoingHttpLoggingInterceptor implements ClientHttpRequestInterceptor {

    private static final String DIRECTION = "direction";
    private static final String OUTBOUND = "outbound";
    private static final String TYPE = "type";
    private static final Logger LOGGER =
            LoggerFactory.getLogger("io.github.susimsek.springauthserversamples.http.client");
    private static final String MASKED_VALUE = "***";
    private static final Set<String> ALWAYS_MASKED_HEADERS =
            Set.of("authorization", "cookie", "set-cookie", "proxy-authorization");

    private final boolean includeHeaders;
    private final Set<String> maskedHeaders;

    public OutgoingHttpLoggingInterceptor(LoggingProperties.HttpClient properties) {
        this.includeHeaders = properties.isIncludeHeaders();
        this.maskedHeaders =
                Stream.concat(
                                ALWAYS_MASKED_HEADERS.stream(),
                                properties.getMaskedHeaders().stream())
                        .map(header -> header.toLowerCase(Locale.ROOT))
                        .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    public ClientHttpResponse intercept(
            HttpRequest request, byte[] body, ClientHttpRequestExecution execution)
            throws IOException {
        long startedAt = System.nanoTime();
        String target = safeTarget(request.getURI());
        logRequest(request, target);
        try {
            ClientHttpResponse response = execution.execute(request, body);
            int status = response.getStatusCode().value();
            long durationMillis = elapsedMillis(startedAt);
            logResponse(request, target, response, status, durationMillis);
            return response;
        } catch (IOException | RuntimeException exception) {
            long durationMillis = elapsedMillis(startedAt);
            LOGGER.atWarn()
                    .addKeyValue(DIRECTION, OUTBOUND)
                    .addKeyValue(TYPE, "response")
                    .addKeyValue("origin", "remote")
                    .addKeyValue("outcome", "failure")
                    .addKeyValue("http.method", request.getMethod())
                    .addKeyValue("http.target", target)
                    .addKeyValue("http.duration_ms", durationMillis)
                    .addKeyValue("exception.type", exception.getClass().getSimpleName())
                    .log(
                            "HTTP client failure method={} uri={} durationMs={} exception={}",
                            request.getMethod(),
                            target,
                            durationMillis,
                            exception.getClass().getSimpleName());
            throw exception;
        }
    }

    private void logResponse(
            HttpRequest request,
            String target,
            ClientHttpResponse response,
            int status,
            long durationMillis)
            throws IOException {
        var log =
                LOGGER.atInfo()
                        .addKeyValue(DIRECTION, OUTBOUND)
                        .addKeyValue(TYPE, "response")
                        .addKeyValue("origin", "remote")
                        .addKeyValue("http.method", request.getMethod())
                        .addKeyValue("http.target", target)
                        .addKeyValue("http.status_code", status)
                        .addKeyValue("http.duration_ms", durationMillis);
        if (includeHeaders) {
            String headers = maskedHeaders(response.getHeaders());
            log.addKeyValue("http.response_headers", headers)
                    .log(
                            "HTTP client response method={} uri={} status={} durationMs={}"
                                    + " headers={}",
                            request.getMethod(),
                            target,
                            status,
                            durationMillis,
                            headers);
        } else {
            log.log(
                    "HTTP client response method={} uri={} status={} durationMs={}",
                    request.getMethod(),
                    target,
                    status,
                    durationMillis);
        }
    }

    private void logRequest(HttpRequest request, String target) {
        if (includeHeaders) {
            String headers = maskedHeaders(request.getHeaders());
            LOGGER.atInfo()
                    .addKeyValue(DIRECTION, OUTBOUND)
                    .addKeyValue(TYPE, "request")
                    .addKeyValue("origin", "local")
                    .addKeyValue("http.method", request.getMethod())
                    .addKeyValue("http.target", target)
                    .addKeyValue("http.headers", headers)
                    .log(
                            "HTTP client request method={} uri={} headers={}",
                            request.getMethod(),
                            target,
                            headers);
        } else {
            LOGGER.atInfo()
                    .addKeyValue(DIRECTION, OUTBOUND)
                    .addKeyValue(TYPE, "request")
                    .addKeyValue("origin", "local")
                    .addKeyValue("http.method", request.getMethod())
                    .addKeyValue("http.target", target)
                    .log("HTTP client request method={} uri={}", request.getMethod(), target);
        }
    }

    private String maskedHeaders(HttpHeaders headers) {
        return headers.headerSet().stream()
                .map(
                        entry -> {
                            String value =
                                    maskedHeaders.contains(entry.getKey().toLowerCase(Locale.ROOT))
                                            ? MASKED_VALUE
                                            : entry.getValue().toString();
                            return entry.getKey() + "=" + value;
                        })
                .collect(Collectors.joining(", ", "{", "}"));
    }

    private static String safeTarget(URI uri) {
        String path = uri.getRawPath();
        if (path == null || path.isBlank()) {
            path = "/";
        }
        return uri.getScheme() + "://" + uri.getRawAuthority() + path;
    }

    private static long elapsedMillis(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }
}
