package io.github.susimsek.kitezh.mcp.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.servlet.ServletInputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class McpRequestBoundaryFilterTest {

    @Test
    void acceptsConfiguredHostAndReplaysBoundedBody() throws Exception {
        McpRequestBoundaryFilter filter =
                new McpRequestBoundaryFilter(
                        "https://kitezh-mcp.test/mcp", "https://inspector.test");
        MockHttpServletRequest request = request("POST", "/mcp", "kitezh-mcp.test");
        request.setContent("{}".getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(
                request,
                response,
                (wrappedRequest, ignoredResponse) -> {
                    assertThat(wrappedRequest.getReader().readLine()).isEqualTo("{}");
                    ServletInputStream input = wrappedRequest.getInputStream();
                    assertThat(input.isReady()).isTrue();
                    while (input.read() != -1) {
                        // Consume the replayed body.
                    }
                    assertThat(input.isFinished()).isTrue();
                    assertThatThrownBy(() -> input.setReadListener(null))
                            .isInstanceOf(UnsupportedOperationException.class);
                });

        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void bypassesBodyBufferingForGetAndNonMcpRequests() throws Exception {
        McpRequestBoundaryFilter filter =
                new McpRequestBoundaryFilter("https://kitezh-mcp.test/mcp", "");
        MockHttpServletRequest getRequest = request("GET", "/mcp", "kitezh-mcp.test");
        filter.doFilter(
                getRequest,
                new MockHttpServletResponse(),
                (actualRequest, ignoredResponse) -> assertThat(actualRequest).isSameAs(getRequest));

        MockHttpServletRequest healthRequest =
                request("POST", "/actuator/health/readiness", "kitezh-mcp.test");
        filter.doFilter(
                healthRequest,
                new MockHttpServletResponse(),
                (actualRequest, ignoredResponse) ->
                        assertThat(actualRequest).isSameAs(healthRequest));
    }

    @Test
    void allowsLocalHostsOnlyWhenTheirOriginsAreConfiguredAndRejectsInvalidPublicUrls()
            throws Exception {
        McpRequestBoundaryFilter localFilter =
                new McpRequestBoundaryFilter(
                        "https://kitezh-mcp.test/mcp", "http://localhost:6274");
        MockHttpServletRequest localRequest = request("GET", "/mcp", "localhost");
        localFilter.doFilter(
                localRequest,
                new MockHttpServletResponse(),
                (actualRequest, ignoredResponse) ->
                        assertThat(actualRequest).isSameAs(localRequest));

        assertThatThrownBy(() -> new McpRequestBoundaryFilter("ftp://kitezh-mcp.test/mcp", ""))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("MCP public URL must be an absolute HTTP URL");
        assertThatThrownBy(() -> new McpRequestBoundaryFilter("/mcp", ""))
                .isInstanceOf(IllegalArgumentException.class);

        McpRequestBoundaryFilter restrictedFilter =
                new McpRequestBoundaryFilter(
                        "https://kitezh-mcp.test/mcp", "https://inspector.test");
        MockHttpServletRequest unlistedLocalRequest = request("GET", "/mcp", "localhost");
        MockHttpServletResponse response = new MockHttpServletResponse();
        restrictedFilter.doFilter(
                unlistedLocalRequest,
                response,
                (actualRequest, ignoredResponse) ->
                        assertThat(actualRequest).isSameAs(unlistedLocalRequest));
        assertThat(response.getStatus()).isEqualTo(400);
    }

    private static MockHttpServletRequest request(String method, String path, String host) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setServerName(host);
        return request;
    }
}
