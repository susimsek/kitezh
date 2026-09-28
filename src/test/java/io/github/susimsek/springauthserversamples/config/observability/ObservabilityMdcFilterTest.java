package io.github.susimsek.springauthserversamples.config.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class ObservabilityMdcFilterTest {

    private final ObservabilityMdcFilter filter = new ObservabilityMdcFilter();

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
        MDC.clear();
    }

    @Test
    void addsBrowserRequestContextAndRestoresMdcAfterRequest() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/admin");
        request.setRemoteAddr("192.0.2.10");
        request.setParameter("client_id", "admin-console");
        String sessionId = request.getSession(true).getId();
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken("admin", "password", List.of()));

        AtomicReference<Map<String, String>> observed = new AtomicReference<>();
        filter.doFilterInternal(
                request,
                new MockHttpServletResponse(),
                (servletRequest, servletResponse) -> observed.set(MDC.getCopyOfContextMap()));

        assertThat(observed.get())
                .containsEntry("clientId", "admin-console")
                .containsEntry("userId", "admin")
                .containsEntry("sessionId", sessionId)
                .containsEntry("ipAddress", "192.0.2.10");
        assertThat(MDC.get("clientId")).isNull();
        assertThat(MDC.get("userId")).isNull();
    }

    @Test
    void usesJwtClientAndSessionClaims() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/account");
        request.setRemoteAddr("198.51.100.20");
        Jwt jwt =
                Jwt.withTokenValue("token")
                        .header("alg", "none")
                        .subject("user-42")
                        .claim("client_id", "account-console")
                        .claim("sid", "sid-42")
                        .build();
        SecurityContextHolder.getContext()
                .setAuthentication(new JwtAuthenticationToken(jwt, List.of()));

        AtomicReference<Map<String, String>> observed = new AtomicReference<>();
        filter.doFilterInternal(
                request,
                new MockHttpServletResponse(),
                (servletRequest, servletResponse) -> observed.set(MDC.getCopyOfContextMap()));

        assertThat(observed.get())
                .containsEntry("clientId", "account-console")
                .containsEntry("userId", "user-42")
                .containsEntry("sessionId", "sid-42")
                .containsEntry("ipAddress", "198.51.100.20");
    }

    @Test
    void usesAuthenticatedClientAsClientIdWithoutUserId() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/oauth2/token");
        OAuth2ClientAuthenticationToken clientAuthentication =
                new OAuth2ClientAuthenticationToken(
                        "demo-client",
                        ClientAuthenticationMethod.CLIENT_SECRET_BASIC,
                        null,
                        Map.of());
        clientAuthentication.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(clientAuthentication);

        AtomicReference<Map<String, String>> observed = new AtomicReference<>();
        filter.doFilterInternal(
                request,
                new MockHttpServletResponse(),
                (servletRequest, servletResponse) -> observed.set(MDC.getCopyOfContextMap()));

        assertThat(observed.get()).containsEntry("clientId", "demo-client");
        assertThat(observed.get()).doesNotContainKey("userId");
    }
}
