package io.github.susimsek.kitezh.config.observability;

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
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

/** Adds request and security context fields to logs exported through OpenTelemetry. */
public final class ObservabilityMdcFilter extends OncePerRequestFilter {

    private static final Logger ACCESS_LOG =
            LoggerFactory.getLogger("io.github.susimsek.kitezh.http.access");

    private static final String CLIENT_ID = "clientId";
    private static final String USER_ID = "userId";
    private static final String SESSION_ID = "sessionId";
    private static final String IP_ADDRESS = "ipAddress";
    private static final String TRACE_ID = "traceId";
    private static final String SPAN_ID = "spanId";
    private static final String DIRECTION = "direction";
    private static final String INBOUND = "inbound";
    private static final String TYPE = "type";
    private static final String AUTHORIZATION = "authorization";
    private static final Set<String> ALWAYS_MASKED_HEADERS =
            Set.of(AUTHORIZATION, "cookie", "set-cookie", "proxy-authorization");
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
                    "samlresponse",
                    "samlrequest",
                    "relaystate",
                    "private_key",
                    "code",
                    "code_verifier",
                    "captchatoken",
                    "response",
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
                    "samlresponse",
                    "samlrequest",
                    "relaystate",
                    "code",
                    "state",
                    "nonce",
                    "request",
                    "request_uri",
                    "login_hint_token",
                    "user_code");

    private static final String[] MDC_KEYS = {
        CLIENT_ID, USER_ID, SESSION_ID, IP_ADDRESS, TRACE_ID, SPAN_ID
    };

    private final LoggingProperties.Server serverProperties;
    private final String replacement;
    private final Set<String> maskedHeaders;
    private final Set<String> maskedBodyFields;
    private final Set<String> maskedParameters;
    private final Set<String> maskedCookies;
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
        this.maskedHeaders.addAll(ALWAYS_MASKED_HEADERS);
        this.maskedBodyFields = new HashSet<>(lowerCaseSet(obfuscate.getBodyFields()));
        this.maskedBodyFields.addAll(ALWAYS_MASKED_BODY_FIELDS);
        this.maskedParameters = new HashSet<>(lowerCaseSet(obfuscate.getParameters()));
        this.maskedParameters.addAll(ALWAYS_MASKED_PARAMETERS);
        this.maskedCookies = lowerCaseSet(obfuscate.getCookies());
        this.excludedPaths =
                serverProperties.getExcludePaths().stream().map(Pattern::compile).toList();
        this.maxBodyBytes = Math.max(0, maxBodyBytes);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        boolean shouldLog = serverProperties.isEnabled() && !excluded(request.getRequestURI());
        boolean includeBody = shouldLog && serverProperties.getLevel() == HttpLoggingLevel.FULL;
        ContentCachingRequestWrapper requestWrapper =
                includeBody ? new ContentCachingRequestWrapper(request, cacheLimit()) : null;
        ContentCachingResponseWrapper responseWrapper =
                includeBody ? new ContentCachingResponseWrapper(response) : null;
        HttpServletRequest requestToFilter = requestWrapper == null ? request : requestWrapper;
        final HttpServletResponse responseToFilter =
                responseWrapper == null ? response : responseWrapper;
        final Map<String, String> previousValues = captureCurrentValues();
        final long startedAt = System.nanoTime();
        final boolean[] failed = {false};
        putIfPresent(IP_ADDRESS, requestToFilter.getRemoteAddr());

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        putIfPresent(CLIENT_ID, clientId(requestToFilter, authentication));
        putIfPresent(USER_ID, userId(authentication));
        putIfPresent(SESSION_ID, sessionId(requestToFilter, authentication));
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

    private static void putTraceContext() {
        var spanContext = Span.current().getSpanContext();
        if (spanContext.isValid()) {
            MDC.put(TRACE_ID, spanContext.getTraceId());
            MDC.put(SPAN_ID, spanContext.getSpanId());
        }
    }

    private static String clientId(HttpServletRequest request, Authentication authentication) {
        String requestClientId =
                firstNonBlank(request.getParameter("client_id"), request.getParameter(CLIENT_ID));
        if (requestClientId != null) {
            return requestClientId;
        }
        if (authentication instanceof OAuth2ClientAuthenticationToken) {
            return authentication.getName();
        }
        if (authentication instanceof JwtAuthenticationToken jwtAuthentication) {
            return firstNonBlank(
                    jwtAuthentication.getToken().getClaimAsString("client_id"),
                    jwtAuthentication.getToken().getClaimAsString("azp"));
        }
        return null;
    }

    private static String userId(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || authentication instanceof OAuth2ClientAuthenticationToken) {
            return null;
        }
        if (authentication instanceof JwtAuthenticationToken jwtAuthentication) {
            return jwtAuthentication.getToken().getSubject();
        }
        return authentication.getName();
    }

    private static String sessionId(HttpServletRequest request, Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwtAuthentication) {
            String tokenSessionId = jwtAuthentication.getToken().getClaimAsString("sid");
            if (tokenSessionId != null && !tokenSessionId.isBlank()) {
                return tokenSessionId;
            }
        }
        var session = request.getSession(false);
        return session == null ? null : session.getId();
    }

    private static String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second == null || second.isBlank() ? null : second;
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
            common += " cookies=" + cookies(request, maskedCookies);
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

    private Map<String, String> cookies(HttpServletRequest request, Set<String> cookiesToMask) {
        if (request.getCookies() == null) {
            return Map.of();
        }
        Map<String, String> values = new LinkedHashMap<>();
        for (var cookie : request.getCookies()) {
            values.put(
                    cookie.getName(),
                    cookiesToMask.contains(cookie.getName().toLowerCase())
                            ? replacement
                            : cookie.getValue());
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
