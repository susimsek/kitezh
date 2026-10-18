package io.github.susimsek.kitezh.mcp.config.observability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.util.ReflectionTestUtils.invokeMethod;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanContext;
import io.opentelemetry.api.trace.TraceFlags;
import io.opentelemetry.api.trace.TraceState;
import jakarta.servlet.FilterChain;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class ObservabilityMdcFilterTest {

    private final ObservabilityMdcFilter filter = new ObservabilityMdcFilter();
    private final Logger accessLogger =
            (Logger) LoggerFactory.getLogger("io.github.susimsek.kitezh.http.access");
    private final ListAppender<ILoggingEvent> accessAppender = new ListAppender<>();

    @BeforeEach
    void captureAccessLogs() {
        accessAppender.start();
        accessLogger.addAppender(accessAppender);
    }

    @AfterEach
    void clearContext() {
        accessLogger.detachAppender(accessAppender);
        accessAppender.stop();
        SecurityContextHolder.clearContext();
        MDC.clear();
    }

    @Test
    void logsMcpOperationAndSanitizedRequestAndResponseBodies() throws Exception {
        LoggingProperties.Server access = new LoggingProperties.Server();
        access.setLevel(HttpLoggingLevel.FULL);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/mcp");
        request.setContentType(MediaType.APPLICATION_JSON_VALUE);
        request.setQueryString("token=secret-query&page=2");
        request.setContent(
                "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"search_users\",\"arguments\":{\"email\":\"private@example.test\",\"password\":\"secret-request-password\"}}}"
                        .getBytes());
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        new ObservabilityMdcFilter(access)
                .doFilterInternal(
                        request,
                        response,
                        (req, res) -> {
                            req.getInputStream().readAllBytes();
                            res.getOutputStream()
                                    .write(
                                            "{\"result\":{\"content\":[{\"type\":\"text\",\"text\":\"{\\\"email\\\":\\\"person@example.test\\\",\\\"access_token\\\":\\\"secret-response-token\\\"}\"}]}}"
                                                    .getBytes());
                        });

        assertThat(accessAppender.list)
                .singleElement()
                .satisfies(
                        event -> {
                            assertThat(event.getFormattedMessage())
                                    .contains(
                                            "requestBody={\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"search_users\",\"arguments\":{\"email\":\"private@example.test\",\"password\":\"***\"}}}",
                                            "responseBody=",
                                            "uri=/mcp?token=***&page=2",
                                            "person@example.test",
                                            "access_token\\\":\\\"***")
                                    .doesNotContain(
                                            "secret-query",
                                            "secret-request-password",
                                            "secret-response-token");
                            assertThat(event.getKeyValuePairs())
                                    .extracting(pair -> pair.key + "=" + pair.value)
                                    .contains(
                                            "mcp.method=tools/call", "mcp.tool.name=search_users");
                        });
    }

    @Test
    void usesOnlyJwtIdentityAndRemoteAddress() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/mcp");
        request.setRemoteAddr("192.0.2.10");
        request.setParameter("client_id", "admin-console");
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new JwtAuthenticationToken(
                                Jwt.withTokenValue("token")
                                        .header("alg", "none")
                                        .subject("admin")
                                        .claim("client_id", "codex-mcp-client")
                                        .build(),
                                List.of()));

        AtomicReference<Map<String, String>> observed = new AtomicReference<>();
        filter.doFilterInternal(
                request,
                new MockHttpServletResponse(),
                (servletRequest, servletResponse) -> observed.set(MDC.getCopyOfContextMap()));

        assertThat(observed.get())
                .containsEntry("oauthClientId", "codex-mcp-client")
                .containsEntry("principalId", "admin")
                .containsEntry("remoteAddress", "192.0.2.10")
                .doesNotContainKeys("sessionId", "clientId", "userId");
        assertThat(MDC.get("oauthClientId")).isNull();
        assertThat(MDC.get("principalId")).isNull();
    }

    @Test
    void usesJwtClientAndSubjectClaimsWithoutSessionContext() throws Exception {
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
                .containsEntry("oauthClientId", "account-console")
                .containsEntry("principalId", "user-42")
                .containsEntry("remoteAddress", "198.51.100.20")
                .doesNotContainKey("sessionId");
    }

    @Test
    void doesNotTrustRequestParameterAsOauthClientIdentity() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/oauth2/token");
        request.setParameter("client_id", "demo-client");

        AtomicReference<Map<String, String>> observed = new AtomicReference<>();
        filter.doFilterInternal(
                request,
                new MockHttpServletResponse(),
                (servletRequest, servletResponse) -> observed.set(MDC.getCopyOfContextMap()));

        assertThat(observed.get()).doesNotContainKeys("oauthClientId", "principalId");
    }

    @Test
    void logsFailedRequestsAndPropagatesTheFailure() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/failure");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain failingChain =
                (servletRequest, servletResponse) -> {
                    throw new IllegalStateException("failure");
                };

        assertThatThrownBy(() -> filter.doFilterInternal(request, response, failingChain))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("failure");
    }

    @Test
    void omitsInboundQueryParametersAndDoesNotUseRequestClientId() throws Exception {
        LoggingProperties.Server access = new LoggingProperties.Server();
        access.setLevel(HttpLoggingLevel.HEADERS);
        final ObservabilityMdcFilter combinedFilter = new ObservabilityMdcFilter(access);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/combined");
        request.setRemoteAddr("203.0.113.10");
        request.setParameter("clientId", "legacy-client");
        request.setQueryString("code=secret&view=summary");
        request.addHeader("User-Agent", "test-agent");
        request.addHeader("Referer", "https://example.test");

        combinedFilter.doFilterInternal(request, new MockHttpServletResponse(), (req, res) -> {});

        assertThat(MDC.get("oauthClientId")).isNull();
        assertThat(accessAppender.list)
                .singleElement()
                .satisfies(
                        event ->
                                assertThat(event.getFormattedMessage())
                                        .contains("uri=/combined?code=***&view=summary")
                                        .doesNotContain("code=secret")
                                        .doesNotContain("userAgent=")
                                        .doesNotContain("referer="));
    }

    @Test
    void marksAccessLogsAsInboundStructuredEvents() throws Exception {
        LoggingProperties.Server access = new LoggingProperties.Server();
        access.setLevel(HttpLoggingLevel.HEADERS);
        ObservabilityMdcFilter longFilter = new ObservabilityMdcFilter(access);
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setHeader("X-Response", "visible");
        response.addHeader("Set-Cookie", "SESSION=secret-cookie");
        longFilter.doFilterInternal(
                new MockHttpServletRequest("GET", "/inbound"), response, (req, res) -> {});

        assertThat(accessAppender.list)
                .singleElement()
                .satisfies(
                        event -> {
                            assertThat(event.getFormattedMessage()).contains("direction=inbound");
                            assertThat(event.getFormattedMessage())
                                    .contains("X-Response=visible")
                                    .contains("Set-Cookie=***");
                            assertThat(event.getKeyValuePairs())
                                    .anySatisfy(
                                            pair -> {
                                                assertThat(pair.key).isEqualTo("type");
                                                assertThat(pair.value).isEqualTo("request");
                                            });
                            assertThat(event.getKeyValuePairs())
                                    .anySatisfy(
                                            pair -> {
                                                assertThat(pair.key)
                                                        .isEqualTo("http.response_headers");
                                                assertThat(pair.value.toString())
                                                        .contains("X-Response=visible")
                                                        .contains("Set-Cookie=***");
                                            });
                        });
    }

    @Test
    void logsLongRequestDetailsWithMaskedHeaders() throws Exception {
        LoggingProperties.Server access = new LoggingProperties.Server();
        access.setLevel(HttpLoggingLevel.HEADERS);
        LoggingProperties.Obfuscate obfuscate = new LoggingProperties.Obfuscate();
        obfuscate.setHeaders(List.of("X-Secret", "Cookie"));
        final ObservabilityMdcFilter longFilter = new ObservabilityMdcFilter(access, obfuscate);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/long");
        request.addHeader("X-Secret", "hidden");
        request.addHeader("X-Public", "visible");
        request.setCookies(new jakarta.servlet.http.Cookie("SESSION", "hidden-cookie"));

        longFilter.doFilterInternal(request, new MockHttpServletResponse(), (req, res) -> {});

        assertThat(accessAppender.list)
                .singleElement()
                .satisfies(
                        event ->
                                assertThat(event.getFormattedMessage())
                                        .contains("X-Secret=***")
                                        .contains("Cookie=***")
                                        .doesNotContain("hidden-cookie"));
        assertThat(MDC.getCopyOfContextMap()).isNullOrEmpty();
    }

    @Test
    void logsMaskedRequestAndResponseBodiesOnlyAtFullLevel() throws Exception {
        LoggingProperties properties = new LoggingProperties();
        properties.getServer().setLevel(HttpLoggingLevel.FULL);
        properties.setMaxBodyBytes(1024);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/body");
        request.setContentType(MediaType.APPLICATION_JSON_VALUE);
        request.setContent("{\"password\":\"secret\",\"name\":\"visible\"}".getBytes());
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ObservabilityMdcFilter fullFilter = new ObservabilityMdcFilter(properties);

        fullFilter.doFilterInternal(
                request,
                response,
                (servletRequest, servletResponse) -> {
                    servletRequest.getInputStream().readAllBytes();
                    servletResponse.getWriter().write("{\"access_token\":\"token\",\"ok\":true}");
                });

        assertThat(response.getContentAsString())
                .isEqualTo("{\"access_token\":\"token\",\"ok\":true}");
        assertThat(accessAppender.list)
                .singleElement()
                .satisfies(
                        event ->
                                assertThat(event.getFormattedMessage())
                                        .contains(
                                                "requestBody={\"password\":\"***\",\"name\":\"visible\"}")
                                        .contains(
                                                "responseBody={\"access_token\":\"***\",\"ok\":true}"));
    }

    @Test
    void usesJwtAuthorizedPartyWithoutHttpSessionFallback() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api");
        request.getSession(true);
        Jwt jwt =
                Jwt.withTokenValue("token")
                        .header("alg", "none")
                        .subject("user-7")
                        .claim("azp", "azp-client")
                        .build();
        SecurityContextHolder.getContext()
                .setAuthentication(new JwtAuthenticationToken(jwt, List.of()));

        AtomicReference<Map<String, String>> observed = new AtomicReference<>();
        filter.doFilterInternal(
                request,
                new MockHttpServletResponse(),
                (servletRequest, servletResponse) -> observed.set(MDC.getCopyOfContextMap()));

        assertThat(observed.get())
                .containsEntry("oauthClientId", "azp-client")
                .doesNotContainKey("sessionId");
    }

    @Test
    void skipsExcludedAndDisabledAccessLogs() throws Exception {
        LoggingProperties.Server excluded = new LoggingProperties.Server();
        excluded.setExcludePaths(List.of("/health"));
        ObservabilityMdcFilter excludedFilter = new ObservabilityMdcFilter(excluded);
        excludedFilter.doFilterInternal(
                new MockHttpServletRequest("GET", "/health"),
                new MockHttpServletResponse(),
                (req, res) -> {});

        LoggingProperties.Server disabled = new LoggingProperties.Server();
        disabled.setEnabled(false);
        ObservabilityMdcFilter disabledFilter = new ObservabilityMdcFilter(disabled);
        disabledFilter.doFilterInternal(
                new MockHttpServletRequest("GET", "/disabled"),
                new MockHttpServletResponse(),
                (req, res) -> {});

        assertThat(MDC.getCopyOfContextMap()).isNullOrEmpty();
    }

    @Test
    void addsValidTraceContextToAccessLogMdc() throws Exception {
        SpanContext spanContext =
                SpanContext.create(
                        "4bf92f3577b34da6a3ce929d0e0e4736",
                        "00f067aa0ba902b7",
                        TraceFlags.getSampled(),
                        TraceState.getDefault());
        AtomicReference<Map<String, String>> observed = new AtomicReference<>();

        var scope = Span.wrap(spanContext).makeCurrent();
        try {
            filter.doFilterInternal(
                    new MockHttpServletRequest("GET", "/trace"),
                    new MockHttpServletResponse(),
                    (servletRequest, servletResponse) -> observed.set(MDC.getCopyOfContextMap()));
        } finally {
            scope.close();
        }

        assertThat(observed.get())
                .containsEntry("traceId", spanContext.getTraceId())
                .containsEntry("spanId", spanContext.getSpanId());
    }

    @Test
    void restoresExistingMdcValuesAndHandlesRequestsWithoutCookies() throws Exception {
        MDC.put("clientId", "before");
        invokeMethod(filter, "restore", Map.of("clientId", "restored"));
        assertThat(MDC.get("clientId")).isEqualTo("restored");

        LoggingProperties.Server access = new LoggingProperties.Server();
        access.setLevel(HttpLoggingLevel.HEADERS);
        new ObservabilityMdcFilter(access)
                .doFilterInternal(
                        new MockHttpServletRequest("GET", "/without-cookies"),
                        new MockHttpServletResponse(),
                        (servletRequest, servletResponse) -> {});

        assertThat(MDC.get("clientId")).isEqualTo("restored");
    }

    @Test
    void ignoresBlankRequestIdentifiersAndAnonymousAuthentication() throws Exception {
        LoggingProperties.Obfuscate obfuscate = new LoggingProperties.Obfuscate();
        obfuscate.setHeaders(java.util.Arrays.asList(null, " ", "X-Secret"));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/anonymous");
        request.setParameter("client_id", " ");
        request.setParameter("clientId", "");
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new AnonymousAuthenticationToken(
                                "key",
                                "anonymous",
                                List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));

        AtomicReference<Map<String, String>> observed = new AtomicReference<>();
        LoggingProperties.Server server = new LoggingProperties.Server();
        ObservabilityMdcFilter configuredFilter = new ObservabilityMdcFilter(server, obfuscate);
        configuredFilter.doFilterInternal(
                request,
                new MockHttpServletResponse(),
                (servletRequest, servletResponse) -> observed.set(MDC.getCopyOfContextMap()));

        assertThat(observed.get()).doesNotContainKeys("oauthClientId", "principalId", "sessionId");
    }
}
