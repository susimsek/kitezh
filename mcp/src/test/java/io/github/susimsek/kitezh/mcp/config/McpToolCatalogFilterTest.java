package io.github.susimsek.kitezh.mcp.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
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

class McpToolCatalogFilterTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void deniesDirectCallsForToolsDisabledByServerPolicy() throws Exception {
        authenticateAdmin();
        McpToolAuthorizationFilter filter = filter("users", "");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpServletRequest request = request("tools/call", "search_clients");

        filter.doFilter(
                request,
                response,
                (ignoredRequest, ignoredResponse) -> {
                    throw new AssertionError(
                            "Globally disabled tool must not reach the MCP server");
                });

        assertThat(response.getContentAsString())
                .contains("\"code\":-32601")
                .contains("Tool not found");
    }

    @Test
    void hidesGloballyDisabledToolsFromListEvenForAdministrators() throws Exception {
        authenticateAdmin();
        McpToolAuthorizationFilter filter = filter("users", "");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(
                request("tools/list", null),
                response,
                (wrappedRequest, wrappedResponse) ->
                        wrappedResponse
                                .getWriter()
                                .write(
                                        "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"tools\":["
                                                + "{\"name\":\"search_users\"},"
                                                + "{\"name\":\"search_clients\"}]}}"));

        assertThat(response.getContentAsString()).doesNotContain("search_users", "search_clients");
    }

    private static McpToolAuthorizationFilter filter(String toolsets, String allowlist) {
        ObjectMapper objectMapper = new ObjectMapper();
        McpToolCatalogPolicy catalogPolicy = new McpToolCatalogPolicy(toolsets, "", allowlist);
        return new McpToolAuthorizationFilter(
                objectMapper,
                catalogPolicy,
                new McpOperationMetrics(new SimpleMeterRegistry(), catalogPolicy, objectMapper));
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

    private static void authenticateAdmin() {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(
                                "admin", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }
}
