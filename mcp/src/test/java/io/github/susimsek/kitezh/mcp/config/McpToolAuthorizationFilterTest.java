package io.github.susimsek.kitezh.mcp.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import jakarta.servlet.ServletInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import tools.jackson.databind.ObjectMapper;

class McpToolAuthorizationFilterTest {

    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final McpToolCatalogPolicy catalogPolicy = new McpToolCatalogPolicy("all", "", "*");
    private final McpToolAuthorizationFilter filter =
            new McpToolAuthorizationFilter(
                    objectMapper,
                    catalogPolicy,
                    new McpOperationMetrics(meterRegistry, catalogPolicy, objectMapper));

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void filtersToolListAndMakesRequestBodyReplayable() throws Exception {
        authenticate("ROLE_USER_VIEWER");
        MockHttpServletRequest request = request("tools/list");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(
                request,
                response,
                (wrappedRequest, wrappedResponse) -> {
                    assertReadableReplay(wrappedRequest);
                    wrappedResponse
                            .getWriter()
                            .write(
                                    "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"tools\":["
                                            + "{\"name\":\"search_users\"},"
                                            + "{\"name\":\"search_clients\"},"
                                            + "{\"name\":\"preview_set_user_enabled\"}]}}");
                });

        assertThat(response.getContentAsString())
                .contains("search_users")
                .doesNotContain("search_clients", "preview_set_user_enabled");
        assertThat(meterRegistry.find("mcp_server_operation_duration_seconds").timer().count())
                .isEqualTo(1);
        assertThat(
                        meterRegistry
                                .find("mcp_server_operation_duration_seconds")
                                .tag("method", "tools/list")
                                .tag("error_type", "none")
                                .timer())
                .isNotNull();
    }

    @Test
    void deniesUnlistedToolsAndInvalidBatchRequests() throws Exception {
        authenticate("ROLE_USER_VIEWER");
        MockHttpServletResponse deniedResponse = new MockHttpServletResponse();
        filter.doFilter(
                request("tools/call", "search_clients"),
                deniedResponse,
                (ignoredRequest, ignoredResponse) -> {
                    throw new AssertionError("Denied tool must not reach the MCP server");
                });
        assertThat(deniedResponse.getContentAsString()).contains("\"code\":-32601");
        assertThat(
                        meterRegistry
                                .find("mcp_server_operation_duration_seconds")
                                .tag("method", "tools/call")
                                .tag("tool_name", "search_clients")
                                .tag("error_type", "authorization")
                                .timer())
                .isNotNull();

        MockHttpServletRequest batchRequest = new MockHttpServletRequest("POST", "/mcp");
        batchRequest.setContent("[{}]".getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse batchResponse = new MockHttpServletResponse();
        filter.doFilter(
                batchRequest,
                batchResponse,
                (ignoredRequest, ignoredResponse) -> {
                    throw new AssertionError("Batch request must be rejected");
                });
        assertThat(batchResponse.getContentAsString()).contains("\"code\":-32600");
    }

    @Test
    void exposesWriteToolsOnlyWithWriteScopeAndManagerRole() throws Exception {
        McpToolCatalogPolicy writePolicy = new McpToolCatalogPolicy("users_write", "", "*");
        McpToolAuthorizationFilter writeFilter =
                new McpToolAuthorizationFilter(
                        objectMapper,
                        writePolicy,
                        new McpOperationMetrics(meterRegistry, writePolicy, objectMapper));
        authenticate("ROLE_USER_MANAGER", "SCOPE_mcp.write");
        MockHttpServletResponse writeResponse = new MockHttpServletResponse();
        writeFilter.doFilter(
                request("tools/call", "preview_set_user_enabled"),
                writeResponse,
                (wrappedRequest, wrappedResponse) ->
                        wrappedResponse.getWriter().write("{\"jsonrpc\":\"2.0\",\"id\":1}"));

        assertThat(writeResponse.getContentAsString()).doesNotContain("-32601");

        authenticate("ROLE_USER_MANAGER", "SCOPE_mcp.read");
        MockHttpServletResponse readResponse = new MockHttpServletResponse();
        writeFilter.doFilter(
                request("tools/call", "preview_set_user_enabled"),
                readResponse,
                (ignoredRequest, ignoredResponse) -> {
                    throw new AssertionError("Write tool must not reach a read-only caller");
                });

        assertThat(readResponse.getContentAsString()).contains("\"code\":-32601");
    }

    @Test
    void deniesResourceIdCompletionWhenSearchToolIsNotEnabled() throws Exception {
        authenticate("ROLE_USER_VIEWER");
        McpToolCatalogPolicy readOnlyPolicy = new McpToolCatalogPolicy("all", "", "get_user");
        McpToolAuthorizationFilter readOnlyFilter =
                new McpToolAuthorizationFilter(
                        objectMapper,
                        readOnlyPolicy,
                        new McpOperationMetrics(meterRegistry, readOnlyPolicy, objectMapper));
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/mcp");
        request.setContent(
                ("{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"completion/complete\","
                                + "\"params\":{\"ref\":{\"type\":\"ref/resource\","
                                + "\"uri\":\"kitezh://users/{userId}\"},"
                                + "\"argument\":{\"name\":\"userId\",\"value\":\"4\"}}}")
                        .getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();

        readOnlyFilter.doFilter(
                request,
                response,
                (ignoredRequest, ignoredResponse) -> {
                    throw new AssertionError(
                            "Completion must not call search when search is disabled");
                });

        assertThat(response.getContentAsString()).contains("\"code\":-32601");
        assertThat(response.getContentAsString()).doesNotContain("42");
    }

    @Test
    void handlesMalformedJsonAndListsNoToolsWithoutAuthentication() throws Exception {
        MockHttpServletRequest malformed = new MockHttpServletRequest("POST", "/mcp");
        malformed.setContent("{".getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse malformedResponse = new MockHttpServletResponse();
        filter.doFilter(
                malformed,
                malformedResponse,
                (wrappedRequest, wrappedResponse) -> {
                    assertReadableReplay(wrappedRequest);
                    wrappedResponse.getWriter().write("{}");
                });
        assertThat(malformedResponse.getContentAsString()).isEqualTo("{}");

        MockHttpServletResponse listResponse = new MockHttpServletResponse();
        filter.doFilter(
                request("tools/list"),
                listResponse,
                (wrappedRequest, wrappedResponse) ->
                        wrappedResponse
                                .getWriter()
                                .write(
                                        "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"tools\":["
                                                + "{\"name\":\"search_users\"}]}}"));
        assertThat(listResponse.getContentAsString()).contains("\"tools\":[]");
    }

    private static MockHttpServletRequest request(String method) {
        return request(method, null);
    }

    private static MockHttpServletRequest request(String method, String toolName) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/mcp");
        String body =
                toolName == null
                        ? "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\""
                                + method
                                + "\",\"params\":{}}"
                        : "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\""
                                + method
                                + "\",\"params\":{\"name\":\""
                                + toolName
                                + "\"}}";
        request.setContent(body.getBytes(StandardCharsets.UTF_8));
        return request;
    }

    private static void authenticate(String role) {
        authenticate(role, "SCOPE_mcp.read");
    }

    private static void authenticate(String role, String scope) {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(
                                "user",
                                "n/a",
                                List.of(
                                        new SimpleGrantedAuthority(role),
                                        new SimpleGrantedAuthority(scope))));
    }

    private static void assertReadableReplay(jakarta.servlet.ServletRequest request)
            throws IOException {
        var reader = request.getReader();
        assertThat(reader.readLine()).isNotNull();
        ServletInputStream input = request.getInputStream();
        assertThat(input.isReady()).isTrue();
        while (input.read() != -1) {
            // Consume the replayed stream to check its completion state.
        }
        assertThat(input.isFinished()).isTrue();
        assertThatThrownBy(() -> input.setReadListener(null))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
