package io.github.susimsek.kitezh.mcp.config.observability;

import io.opentelemetry.api.trace.Span;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Adds request and security context fields to logs exported through OpenTelemetry. */
public final class ObservabilityMdcFilter extends OncePerRequestFilter {

    private static final Logger ACCESS_LOG =
            LoggerFactory.getLogger("io.github.susimsek.kitezh.http.access");

    private static final String CLIENT_ID = "oauthClientId";
    private static final String PRINCIPAL_ID = "principalId";
    private static final String REMOTE_ADDRESS = "remoteAddress";
    private static final String TRACE_ID = "traceId";
    private static final String SPAN_ID = "spanId";
    private static final String MCP_METHOD = "mcp.method";
    private static final String MCP_TOOL_NAME = "mcp.tool.name";
    private static final JsonMapper JSON_MAPPER = JsonMapper.builder().build();
    private static final String DIRECTION = "direction";
    private static final String INBOUND = "inbound";
    private static final String TYPE = "type";
    private static final String[] MDC_KEYS = {
        CLIENT_ID, PRINCIPAL_ID, REMOTE_ADDRESS, TRACE_ID, SPAN_ID, MCP_METHOD, MCP_TOOL_NAME
    };

    private final LoggingProperties.Server serverProperties;
    private final String replacement;
    private final Set<String> maskedHeaders;
    private final Set<String> maskedBodyFields;
    private final Set<String> maskedParameters;
    private final List<Pattern> excludedPaths;
    private final int maxBodyBytes;

    public ObservabilityMdcFilter() {
        this(new LoggingProperties());
    }

    public ObservabilityMdcFilter(LoggingProperties.Server serverProperties) {
        this(serverProperties, new LoggingProperties.Obfuscate());
    }

    public ObservabilityMdcFilter(LoggingProperties properties) {
        this(properties.getServer(), properties.getObfuscate(), properties.getMaxBodyBytes());
    }

    public ObservabilityMdcFilter(
            LoggingProperties.Server serverProperties, LoggingProperties.Obfuscate obfuscate) {
        this(serverProperties, obfuscate, 8192);
    }

    public ObservabilityMdcFilter(
            LoggingProperties.Server serverProperties,
            LoggingProperties.Obfuscate obfuscate,
            int maxBodyBytes) {
        this.serverProperties = serverProperties;
        this.replacement = obfuscate.getReplacement();
        this.maskedHeaders = new HashSet<>(lowerCaseSet(obfuscate.getHeaders()));
        this.maskedBodyFields = new HashSet<>(lowerCaseSet(obfuscate.getBodyFields()));
        this.maskedParameters = new HashSet<>(lowerCaseSet(obfuscate.getParameters()));
        this.excludedPaths =
                serverProperties.getExcludePaths().stream().map(Pattern::compile).toList();
        this.maxBodyBytes = Math.max(0, maxBodyBytes);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        boolean shouldLog = serverProperties.isEnabled() && !excluded(request.getRequestURI());
        boolean mcpRequest = isMcpRequest(request);
        boolean includeBody = shouldLog && serverProperties.getLevel() == HttpLoggingLevel.FULL;
        boolean captureMcpMethod = shouldLog && mcpRequest;
        ContentCachingRequestWrapper requestWrapper =
                includeBody || captureMcpMethod
                        ? new ContentCachingRequestWrapper(request, cacheLimit())
                        : null;
        ContentCachingResponseWrapper responseWrapper =
                includeBody ? new ContentCachingResponseWrapper(response) : null;
        HttpServletRequest requestToFilter = requestWrapper == null ? request : requestWrapper;
        final HttpServletResponse responseToFilter =
                responseWrapper == null ? response : responseWrapper;
        final Map<String, String> previousValues = captureCurrentValues();
        final long startedAt = System.nanoTime();
        final boolean[] failed = {false};
        putIfPresent(REMOTE_ADDRESS, requestToFilter.getRemoteAddr());

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        putIfPresent(CLIENT_ID, clientId(authentication));
        putIfPresent(PRINCIPAL_ID, principalId(authentication));
        putTraceContext();
        try {
            filterChain.doFilter(requestToFilter, responseToFilter);
        } catch (IOException | ServletException | RuntimeException exception) {
            failed[0] = true;
            throw exception;
        } finally {
            if (shouldLog) {
                logAccess(
                        requestToFilter,
                        responseToFilter,
                        requestWrapper,
                        responseWrapper,
                        startedAt,
                        mcpRequest,
                        failed[0] ? 500 : responseToFilter.getStatus());
            }
            if (responseWrapper != null) {
                responseWrapper.copyBodyToResponse();
            }
            restore(previousValues);
        }
    }

    private boolean excluded(String requestUri) {
        return excludedPaths.stream().anyMatch(pattern -> pattern.matcher(requestUri).matches());
    }

    private static Map<String, String> captureCurrentValues() {
        Map<String, String> values = new LinkedHashMap<>();
        for (String key : MDC_KEYS) {
            values.put(key, MDC.get(key));
        }
        return values;
    }

    private static boolean isMcpRequest(HttpServletRequest request) {
        return "/mcp".equals(request.getRequestURI().substring(request.getContextPath().length()));
    }

    private static void putTraceContext() {
        var spanContext = Span.current().getSpanContext();
        if (spanContext.isValid()) {
            MDC.put(TRACE_ID, spanContext.getTraceId());
            MDC.put(SPAN_ID, spanContext.getSpanId());
        }
    }

    private static String clientId(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwtAuthentication) {
            return firstNonBlank(
                    jwtAuthentication.getToken().getClaimAsString("client_id"),
                    jwtAuthentication.getToken().getClaimAsString("azp"));
        }
        return null;
    }

    private static String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second == null || second.isBlank() ? null : second;
    }

    private static String principalId(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwtAuthentication) {
            return jwtAuthentication.getToken().getSubject();
        }
        return null;
    }

    private static void putIfPresent(String key, String value) {
        if (value != null && !value.isBlank()) {
            MDC.put(key, value);
        }
    }

    private static void restore(Map<String, String> previousValues) {
        previousValues.forEach(
                (key, value) -> {
                    if (value == null) {
                        MDC.remove(key);
                    } else {
                        MDC.put(key, value);
                    }
                });
    }

    private void logAccess(
            HttpServletRequest request,
            HttpServletResponse response,
            ContentCachingRequestWrapper requestWrapper,
            ContentCachingResponseWrapper responseWrapper,
            long startedAt,
            boolean mcpRequest,
            int status) {
        LoggingProperties.Server server = serverProperties;
        long durationMillis = durationMillis(startedAt);
        String target = requestTarget(request);
        String common =
                String.format(
                        "HTTP access direction=inbound method=%s uri=%s status=%d ipAddress=%s"
                                + " durationMs=%d",
                        request.getMethod(),
                        target,
                        status,
                        request.getRemoteAddr(),
                        durationMillis);
        boolean includeHeaders =
                server.getLevel() == HttpLoggingLevel.HEADERS
                        || server.getLevel() == HttpLoggingLevel.FULL;
        boolean includeBody = server.getLevel() == HttpLoggingLevel.FULL;
        if (includeHeaders) {
            common += " headers=" + headers(request, maskedHeaders);
            common += " responseHeaders=" + responseHeaders(response, maskedHeaders);
        }
        String requestBody =
                includeBody(requestWrapper)
                        ? body(requestWrapper.getContentAsByteArray(), request)
                        : null;
        String responseBody =
                includeBody(responseWrapper)
                        ? body(responseWrapper.getContentAsByteArray(), response)
                        : null;
        if (mcpRequest) {
            putMcpContext(requestWrapper);
        }
        if (includeBody) {
            common += " requestBody=" + requestBody + " responseBody=" + responseBody;
        }
        var log =
                ACCESS_LOG
                        .atInfo()
                        .addKeyValue(DIRECTION, INBOUND)
                        .addKeyValue(TYPE, "request")
                        .addKeyValue("origin", "remote")
                        .addKeyValue("http.method", request.getMethod())
                        .addKeyValue("http.target", target)
                        .addKeyValue("http.status_code", status)
                        .addKeyValue("http.client_ip", request.getRemoteAddr())
                        .addKeyValue("http.duration_ms", durationMillis);
        if (mcpRequest) {
            addIfPresent(log, MCP_METHOD, MDC.get(MCP_METHOD));
            addIfPresent(log, MCP_TOOL_NAME, MDC.get(MCP_TOOL_NAME));
        }
        if (includeHeaders) {
            log.addKeyValue("http.response_headers", responseHeaders(response, maskedHeaders));
        }
        if (includeBody) {
            log.addKeyValue("http.request_body", requestBody);
            log.addKeyValue("http.response_body", responseBody);
        }
        log.log(common);
    }

    private boolean includeBody(ContentCachingRequestWrapper wrapper) {
        return wrapper != null && serverProperties.getLevel() == HttpLoggingLevel.FULL;
    }

    private boolean includeBody(ContentCachingResponseWrapper wrapper) {
        return wrapper != null && serverProperties.getLevel() == HttpLoggingLevel.FULL;
    }

    private String body(byte[] bytes, HttpServletRequest request) {
        return HttpLogBodySanitizer.sanitize(
                bytes,
                contentHeaders(request.getContentType()),
                maxBodyBytes,
                replacement,
                maskedBodyFields);
    }

    private String body(byte[] bytes, HttpServletResponse response) {
        return HttpLogBodySanitizer.sanitize(
                bytes,
                contentHeaders(response.getContentType()),
                maxBodyBytes,
                replacement,
                maskedBodyFields);
    }

    private static HttpHeaders contentHeaders(String contentType) {
        HttpHeaders headers = new HttpHeaders();
        if (contentType != null && !contentType.isBlank()) {
            try {
                headers.setContentType(MediaType.parseMediaType(contentType));
            } catch (IllegalArgumentException _) {
                // An invalid content type cannot be safely classified as text.
                return headers;
            }
        }
        return headers;
    }

    private int cacheLimit() {
        return maxBodyBytes == Integer.MAX_VALUE ? Integer.MAX_VALUE : maxBodyBytes + 1;
    }

    private String requestTarget(HttpServletRequest request) {
        String query = maskQuery(request.getQueryString());
        return request.getRequestURI() + (query.isBlank() ? "" : "?" + query);
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

    private void putMcpContext(ContentCachingRequestWrapper request) {
        if (request == null || request.getContentAsByteArray().length == 0) {
            return;
        }
        try {
            JsonNode json = JSON_MAPPER.readTree(request.getContentAsByteArray());
            putIfMatching(
                    MCP_METHOD, json.path("method").asText(null), "[A-Za-z][A-Za-z0-9_./:-]{0,63}");
            if ("tools/call".equals(MDC.get(MCP_METHOD))) {
                putIfMatching(
                        MCP_TOOL_NAME,
                        json.path("params").path("name").asText(null),
                        "[A-Za-z0-9][A-Za-z0-9_.-]{0,99}");
            }
        } catch (RuntimeException _) {
            MDC.remove(MCP_METHOD);
            MDC.remove(MCP_TOOL_NAME);
        }
    }

    private static void putIfMatching(String key, String value, String expression) {
        if (value != null && value.matches(expression)) {
            MDC.put(key, value);
        }
    }

    private static void addIfPresent(
            org.slf4j.spi.LoggingEventBuilder log, String key, String value) {
        if (value != null && !value.isBlank()) {
            log.addKeyValue(key, value);
        }
    }

    private static long durationMillis(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }

    private Map<String, String> headers(HttpServletRequest request, Set<String> headersToMask) {
        Map<String, String> values = new LinkedHashMap<>();
        Enumeration<String> names = request.getHeaderNames();
        if (names != null) {
            while (names.hasMoreElements()) {
                String name = names.nextElement();
                values.put(
                        name,
                        headersToMask.contains(name.toLowerCase())
                                ? replacement
                                : request.getHeader(name));
            }
        }
        return values;
    }

    private Map<String, String> responseHeaders(
            HttpServletResponse response, Set<String> headersToMask) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String name : response.getHeaderNames()) {
            values.put(
                    name,
                    headersToMask.contains(name.toLowerCase())
                            ? replacement
                            : String.join(", ", response.getHeaders(name)));
        }
        return values;
    }

    private static Set<String> lowerCaseSet(List<String> values) {
        return values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(value -> value.trim().toLowerCase())
                .collect(Collectors.toSet());
    }
}
