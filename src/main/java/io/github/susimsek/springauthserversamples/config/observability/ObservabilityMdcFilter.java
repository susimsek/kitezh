package io.github.susimsek.springauthserversamples.config.observability;

import io.opentelemetry.api.trace.Span;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

/** Adds request and security context fields to logs exported through OpenTelemetry. */
public final class ObservabilityMdcFilter extends OncePerRequestFilter {

    private static final Logger ACCESS_LOG =
            LoggerFactory.getLogger("io.github.susimsek.springauthserversamples.http.access");

    private static final String CLIENT_ID = "clientId";
    private static final String USER_ID = "userId";
    private static final String SESSION_ID = "sessionId";
    private static final String IP_ADDRESS = "ipAddress";
    private static final String TRACE_ID = "traceId";
    private static final String SPAN_ID = "spanId";
    private static final String DIRECTION = "direction";
    private static final String INBOUND = "inbound";
    private static final String TYPE = "type";
    private static final String MASKED_VALUE = "***";
    private static final Set<String> ALWAYS_MASKED_HEADERS =
            Set.of("authorization", "cookie", "set-cookie", "proxy-authorization");

    private static final String[] MDC_KEYS = {
        CLIENT_ID, USER_ID, SESSION_ID, IP_ADDRESS, TRACE_ID, SPAN_ID
    };

    private final LoggingProperties.Access accessProperties;
    private final Set<String> maskedHeaders;
    private final Set<String> maskedCookies;
    private final List<Pattern> excludedPaths;

    public ObservabilityMdcFilter() {
        this(new LoggingProperties().getAccess());
    }

    public ObservabilityMdcFilter(LoggingProperties.Access accessProperties) {
        this.accessProperties = accessProperties;
        this.maskedHeaders = new HashSet<>(lowerCaseSet(accessProperties.getMaskedHeaders()));
        this.maskedHeaders.addAll(ALWAYS_MASKED_HEADERS);
        this.maskedCookies = lowerCaseSet(accessProperties.getMaskedCookies());
        this.excludedPaths =
                accessProperties.getExcludePaths().stream().map(Pattern::compile).toList();
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        final Map<String, String> previousValues = captureCurrentValues();
        final long startedAt = System.nanoTime();
        final boolean[] failed = {false};
        putIfPresent(IP_ADDRESS, request.getRemoteAddr());

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        putIfPresent(CLIENT_ID, clientId(request, authentication));
        putIfPresent(USER_ID, userId(authentication));
        putIfPresent(SESSION_ID, sessionId(request, authentication));
        putTraceContext();
        try {
            filterChain.doFilter(request, response);
        } catch (IOException | ServletException | RuntimeException exception) {
            failed[0] = true;
            throw exception;
        } finally {
            if (accessProperties.isEnabled() && !excluded(request.getRequestURI())) {
                logAccess(request, response, startedAt, failed[0] ? 500 : response.getStatus());
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
            HttpServletRequest request, HttpServletResponse response, long startedAt, int status) {
        LoggingProperties.Access access = accessProperties;
        long durationMillis = durationMillis(startedAt);
        String common =
                String.format(
                        "HTTP access direction=inbound method=%s uri=%s status=%d ipAddress=%s"
                                + " durationMs=%d",
                        request.getMethod(),
                        request.getRequestURI(),
                        status,
                        request.getRemoteAddr(),
                        durationMillis);
        String pattern = access.getPattern().toLowerCase();
        if ("combined".equals(pattern) || "long".equals(pattern)) {
            common +=
                    String.format(
                            " userAgent=%s referer=%s",
                            request.getHeader("User-Agent"), request.getHeader("Referer"));
        }
        if ("long".equals(pattern)) {
            common += " headers=" + headers(request, maskedHeaders);
            common += " cookies=" + cookies(request, maskedCookies);
            common += " responseHeaders=" + responseHeaders(response, maskedHeaders);
        }
        var log =
                ACCESS_LOG
                        .atInfo()
                        .addKeyValue(DIRECTION, INBOUND)
                        .addKeyValue(TYPE, "request")
                        .addKeyValue("origin", "remote")
                        .addKeyValue("http.method", request.getMethod())
                        .addKeyValue("http.target", request.getRequestURI())
                        .addKeyValue("http.status_code", status)
                        .addKeyValue("http.client_ip", request.getRemoteAddr())
                        .addKeyValue("http.duration_ms", durationMillis);
        if ("long".equals(pattern)) {
            log.addKeyValue("http.response_headers", responseHeaders(response, maskedHeaders));
        }
        log.log(common);
    }

    private static long durationMillis(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }

    private static Map<String, String> headers(
            HttpServletRequest request, Set<String> headersToMask) {
        Map<String, String> values = new LinkedHashMap<>();
        Enumeration<String> names = request.getHeaderNames();
        if (names != null) {
            while (names.hasMoreElements()) {
                String name = names.nextElement();
                values.put(
                        name,
                        headersToMask.contains(name.toLowerCase())
                                ? MASKED_VALUE
                                : request.getHeader(name));
            }
        }
        return values;
    }

    private static Map<String, String> responseHeaders(
            HttpServletResponse response, Set<String> headersToMask) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String name : response.getHeaderNames()) {
            values.put(
                    name,
                    headersToMask.contains(name.toLowerCase())
                            ? MASKED_VALUE
                            : String.join(", ", response.getHeaders(name)));
        }
        return values;
    }

    private static Map<String, String> cookies(
            HttpServletRequest request, Set<String> cookiesToMask) {
        if (request.getCookies() == null) {
            return Map.of();
        }
        Map<String, String> values = new LinkedHashMap<>();
        for (var cookie : request.getCookies()) {
            values.put(
                    cookie.getName(),
                    cookiesToMask.contains(cookie.getName().toLowerCase())
                            ? MASKED_VALUE
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
