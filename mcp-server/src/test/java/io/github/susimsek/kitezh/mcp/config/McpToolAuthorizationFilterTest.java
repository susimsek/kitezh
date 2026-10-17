package io.github.susimsek.kitezh.mcp.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

    private final McpToolAuthorizationFilter filter =
            new McpToolAuthorizationFilter(
                    new ObjectMapper(), new McpToolCatalogPolicy("all", "*"));

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
                                            + "{\"name\":\"kitezh_search_users\"},"
                                            + "{\"name\":\"kitezh_search_clients\"}]}}");
                });

        assertThat(response.getContentAsString())
                .contains("kitezh_search_users")
                .doesNotContain("kitezh_search_clients");
    }

    @Test
    void deniesUnlistedToolsAndInvalidBatchRequests() throws Exception {
        authenticate("ROLE_USER_VIEWER");
        MockHttpServletResponse deniedResponse = new MockHttpServletResponse();
        filter.doFilter(
                request("tools/call", "kitezh_search_clients"),
                deniedResponse,
                (ignoredRequest, ignoredResponse) -> {
                    throw new AssertionError("Denied tool must not reach the MCP server");
                });
        assertThat(deniedResponse.getContentAsString()).contains("\"code\":-32601");

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
                                                + "{\"name\":\"kitezh_search_users\"}]}}"));
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
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(
                                "user", "n/a", List.of(new SimpleGrantedAuthority(role))));
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
