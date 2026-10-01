package io.github.susimsek.springauthserversamples.config.observability;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
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
    private static final String AUTHORIZATION = "authorization";
    private static final String RESPONSE = "response";
    private static final String ORIGIN = "origin";
    private static final String HTTP_METHOD = "http.method";
    private static final String HTTP_TARGET = "http.target";
    private static final Logger LOGGER =
            LoggerFactory.getLogger("io.github.susimsek.springauthserversamples.http.client");
    private static final Set<String> ALWAYS_MASKED_HEADERS =
            Set.of(
                    AUTHORIZATION,
                    "cookie",
                    "set-cookie",
                    "proxy-authorization",
                    "dpop",
                    "x-api-key");
    private static final Set<String> ALWAYS_MASKED_BODY_FIELDS =
            Set.of(
                    "access_token",
                    "refresh_token",
                    "id_token",
                    "client_secret",
                    "password",
                    AUTHORIZATION,
                    "cookie",
                    "token",
                    "secret",
                    "api_key",
                    "assertion",
                    "saml_response",
                    "private_key",
                    "code",
                    "code_verifier",
                    "captchatoken",
                    RESPONSE,
                    "sitekey",
                    "apikey",
                    "auth_req_id",
                    "client_notification_token",
                    "id_token_hint",
                    "login_hint_token",
                    "user_code",
                    "dpop",
                    "dpop_proof",
                    "jwk");
    private static final Set<String> ALWAYS_MASKED_PARAMETERS =
            Set.of(
                    "access_token",
                    "refresh_token",
                    "id_token",
                    "client_secret",
                    "client_assertion",
                    "password",
                    AUTHORIZATION,
                    "token",
                    "secret",
                    "api_key",
                    "assertion",
                    "code",
                    "code_verifier",
                    "state",
                    "nonce",
                    "request",
                    "request_uri",
                    "id_token_hint",
                    "auth_req_id",
                    "client_notification_token",
                    "login_hint_token",
                    "user_code",
                    "captchatoken",
                    RESPONSE,
                    "key");

    private final HttpLoggingLevel level;
    private final int maxBodyBytes;
    private final Set<String> excludePaths;
    private final Set<String> maskedHeaders;
    private final Set<String> maskedBodyFields;
    private final Set<String> maskedParameters;
    private final String replacement;

    public OutgoingHttpLoggingInterceptor(LoggingProperties.HttpClient properties) {
        this(properties, new LoggingProperties.Obfuscate());
    }

    public OutgoingHttpLoggingInterceptor(
            LoggingProperties.HttpClient properties, LoggingProperties.Obfuscate obfuscate) {
        this(properties, obfuscate, 8192);
    }

    public OutgoingHttpLoggingInterceptor(
            LoggingProperties.HttpClient properties,
            LoggingProperties.Obfuscate obfuscate,
            int maxBodyBytes) {
        this.level = properties.getLevel();
        this.maxBodyBytes = Math.max(0, maxBodyBytes);
        this.replacement = obfuscate.getReplacement();
        this.excludePaths =
                properties.getExcludePaths().stream()
                        .map(String::trim)
                        .filter(path -> !path.isEmpty())
                        .collect(Collectors.toUnmodifiableSet());
        this.maskedHeaders =
                Stream.concat(ALWAYS_MASKED_HEADERS.stream(), obfuscate.getHeaders().stream())
                        .map(header -> header.toLowerCase(Locale.ROOT))
                        .collect(Collectors.toUnmodifiableSet());
        this.maskedBodyFields =
                Stream.concat(
                                ALWAYS_MASKED_BODY_FIELDS.stream(),
                                obfuscate.getBodyFields().stream())
                        .map(field -> field.toLowerCase(Locale.ROOT))
                        .collect(Collectors.toUnmodifiableSet());
        this.maskedParameters =
                Stream.concat(ALWAYS_MASKED_PARAMETERS.stream(), obfuscate.getParameters().stream())
                        .map(parameter -> parameter.toLowerCase(Locale.ROOT))
                        .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    public ClientHttpResponse intercept(
            HttpRequest request, byte[] body, ClientHttpRequestExecution execution)
            throws IOException {
        long startedAt = System.nanoTime();
        String target = safeTarget(request.getURI());
        if (isExcluded(request)) {
            return execution.execute(request, body);
        }
        logRequest(request, target, body);
        try {
            ClientHttpResponse response = execution.execute(request, body);
            int status = response.getStatusCode().value();
            long durationMillis = elapsedMillis(startedAt);
            ResponseBody responseBody = responseBody(response);
            logResponse(
                    request,
                    target,
                    responseBody.body(),
                    status,
                    durationMillis,
                    response.getHeaders());
            return responseBody.response();
        } catch (IOException | RuntimeException exception) {
            long durationMillis = elapsedMillis(startedAt);
            LOGGER.atWarn()
                    .addKeyValue(DIRECTION, OUTBOUND)
                    .addKeyValue(TYPE, RESPONSE)
                    .addKeyValue(ORIGIN, "remote")
                    .addKeyValue("outcome", "failure")
                    .addKeyValue(HTTP_METHOD, request.getMethod())
                    .addKeyValue(HTTP_TARGET, target)
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
            String body,
            int status,
            long durationMillis,
            HttpHeaders responseHeaders) {
        boolean includeHeaders =
                level == HttpLoggingLevel.HEADERS || level == HttpLoggingLevel.FULL;
        boolean includeBody = level == HttpLoggingLevel.FULL;
        var log =
                LOGGER.atInfo()
                        .addKeyValue(DIRECTION, OUTBOUND)
                        .addKeyValue(TYPE, RESPONSE)
                        .addKeyValue(ORIGIN, "remote")
                        .addKeyValue(HTTP_METHOD, request.getMethod())
                        .addKeyValue(HTTP_TARGET, target)
                        .addKeyValue("http.status_code", status)
                        .addKeyValue("http.duration_ms", durationMillis);
        String headers = null;
        if (includeHeaders) {
            headers = maskedHeaders(responseHeaders);
            log.addKeyValue("http.response_headers", headers);
        }
        if (includeBody) {
            log.addKeyValue("http.response_body", body);
        }
        if (includeHeaders && includeBody) {
            log.log(
                    "HTTP client response method={} uri={} status={} durationMs={} headers={}"
                            + " body={}",
                    request.getMethod(),
                    target,
                    status,
                    durationMillis,
                    headers,
                    body);
        } else if (includeHeaders) {
            log.log(
                    "HTTP client response method={} uri={} status={} durationMs={} headers={}",
                    request.getMethod(),
                    target,
                    status,
                    durationMillis,
                    headers);
        } else if (includeBody) {
            log.log(
                    "HTTP client response method={} uri={} status={} durationMs={} body={}",
                    request.getMethod(),
                    target,
                    status,
                    durationMillis,
                    body);
        } else {
            log.log(
                    "HTTP client response method={} uri={} status={} durationMs={}",
                    request.getMethod(),
                    target,
                    status,
                    durationMillis);
        }
    }

    private void logRequest(HttpRequest request, String target, byte[] requestBody) {
        boolean includeHeaders =
                level == HttpLoggingLevel.HEADERS || level == HttpLoggingLevel.FULL;
        boolean includeBody = level == HttpLoggingLevel.FULL;
        String headers = includeHeaders ? maskedHeaders(request.getHeaders()) : null;
        String body = includeBody ? safeBody(requestBody, request.getHeaders()) : null;
        var log =
                LOGGER.atInfo()
                        .addKeyValue(DIRECTION, OUTBOUND)
                        .addKeyValue(TYPE, "request")
                        .addKeyValue(ORIGIN, "local")
                        .addKeyValue(HTTP_METHOD, request.getMethod())
                        .addKeyValue(HTTP_TARGET, target);
        if (includeHeaders) {
            log.addKeyValue("http.headers", headers);
        }
        if (includeBody) {
            log.addKeyValue("http.request_body", body);
        }
        if (includeHeaders && includeBody) {
            log.log(
                    "HTTP client request method={} uri={} headers={} body={}",
                    request.getMethod(),
                    target,
                    headers,
                    body);
        } else if (includeHeaders) {
            log.log(
                    "HTTP client request method={} uri={} headers={}",
                    request.getMethod(),
                    target,
                    headers);
        } else if (includeBody) {
            log.log(
                    "HTTP client request method={} uri={} body={}",
                    request.getMethod(),
                    target,
                    body);
        } else {
            log.log("HTTP client request method={} uri={}", request.getMethod(), target);
        }
    }

    private ResponseBody responseBody(ClientHttpResponse response) throws IOException {
        if (level != HttpLoggingLevel.FULL) {
            return new ResponseBody(response, null);
        }
        HttpHeaders headers = response.getHeaders();
        if (!HttpLogBodySanitizer.isTextLike(headers)) {
            return new ResponseBody(response, HttpLogBodySanitizer.BODY_OMITTED);
        }
        long contentLength = headers.getContentLength();
        if (maxBodyBytes == 0 || contentLength < 0) {
            return new ResponseBody(
                    response,
                    contentLength < 0
                            ? HttpLogBodySanitizer.BODY_UNKNOWN_SIZE
                            : HttpLogBodySanitizer.BODY_OMITTED);
        }
        if (contentLength > maxBodyBytes) {
            return new ResponseBody(response, HttpLogBodySanitizer.BODY_TOO_LARGE);
        }
        byte[] bytes = response.getBody().readAllBytes();
        String body = safeBody(bytes, headers);
        return new ResponseBody(new BufferedClientHttpResponse(response, bytes), body);
    }

    private String safeBody(byte[] body, HttpHeaders headers) {
        return HttpLogBodySanitizer.sanitize(
                body, headers, maxBodyBytes, replacement, maskedBodyFields);
    }

    private String maskedHeaders(HttpHeaders headers) {
        return headers.headerSet().stream()
                .map(
                        entry -> {
                            String value =
                                    maskedHeaders.contains(entry.getKey().toLowerCase(Locale.ROOT))
                                            ? replacement
                                            : entry.getValue().toString();
                            return entry.getKey() + "=" + value;
                        })
                .collect(Collectors.joining(", ", "{", "}"));
    }

    private boolean isExcluded(HttpRequest request) {
        String path = request.getURI().getPath();
        return excludePaths.stream().anyMatch(path::startsWith);
    }

    private String safeTarget(URI uri) {
        String path = uri.getRawPath();
        if (path == null || path.isBlank()) {
            path = "/";
        }
        String query = maskQuery(uri.getRawQuery());
        return uri.getScheme()
                + "://"
                + uri.getRawAuthority()
                + path
                + (query.isBlank() ? "" : "?" + query);
    }

    private String maskQuery(String query) {
        if (query == null || query.isBlank()) {
            return "";
        }
        return Arrays.stream(query.split("&", -1))
                .map(
                        parameter -> {
                            int separator = parameter.indexOf('=');
                            if (separator < 0) {
                                return parameter;
                            }
                            String name = parameter.substring(0, separator);
                            return maskedParameters.contains(decode(name).toLowerCase(Locale.ROOT))
                                    ? name + "=" + replacement
                                    : parameter;
                        })
                .collect(Collectors.joining("&"));
    }

    private static String decode(String value) {
        try {
            return URLDecoder.decode(value, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException _) {
            return value;
        }
    }

    private static long elapsedMillis(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }

    private record ResponseBody(ClientHttpResponse response, String body) {}

    private static final class BufferedClientHttpResponse implements ClientHttpResponse {

        private final ClientHttpResponse delegate;
        private final byte[] body;

        private BufferedClientHttpResponse(ClientHttpResponse delegate, byte[] body) {
            this.delegate = delegate;
            this.body = body;
        }

        @Override
        public org.springframework.http.HttpStatusCode getStatusCode() throws IOException {
            return delegate.getStatusCode();
        }

        @Override
        public String getStatusText() throws IOException {
            return delegate.getStatusText();
        }

        @Override
        public HttpHeaders getHeaders() {
            return delegate.getHeaders();
        }

        @Override
        public InputStream getBody() {
            return new ByteArrayInputStream(body);
        }

        @Override
        public void close() {
            delegate.close();
        }
    }
}
