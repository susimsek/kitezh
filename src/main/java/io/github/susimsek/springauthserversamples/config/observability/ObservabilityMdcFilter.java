package io.github.susimsek.springauthserversamples.config.observability;

import io.opentelemetry.api.trace.Span;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.MDC;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

/** Adds request and security context fields to logs exported through OpenTelemetry. */
public final class ObservabilityMdcFilter extends OncePerRequestFilter {

    private static final String CLIENT_ID = "clientId";
    private static final String USER_ID = "userId";
    private static final String SESSION_ID = "sessionId";
    private static final String IP_ADDRESS = "ipAddress";
    private static final String TRACE_ID = "traceId";
    private static final String SPAN_ID = "spanId";

    private static final String[] MDC_KEYS = {
        CLIENT_ID, USER_ID, SESSION_ID, IP_ADDRESS, TRACE_ID, SPAN_ID
    };

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        Map<String, String> previousValues = captureCurrentValues();
        putIfPresent(IP_ADDRESS, request.getRemoteAddr());

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        putIfPresent(CLIENT_ID, clientId(request, authentication));
        putIfPresent(USER_ID, userId(authentication));
        putIfPresent(SESSION_ID, sessionId(request, authentication));
        putTraceContext();
        try {
            filterChain.doFilter(request, response);
        } finally {
            restore(previousValues);
        }
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
                firstNonBlank(request.getParameter("client_id"), request.getParameter("clientId"));
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
}
