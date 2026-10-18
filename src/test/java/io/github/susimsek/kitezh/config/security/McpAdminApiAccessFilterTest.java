package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.ServletException;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class McpAdminApiAccessFilterTest {

    private static final String MCP_AUDIENCE = "https://kitezh-mcp.onrender.com/mcp";

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void recognizesMcpPurposeTokenWithSpaceDelimitedScopeClaim() {
        Jwt jwt =
                Jwt.withTokenValue("token")
                        .header("alg", "none")
                        .audience(List.of(MCP_AUDIENCE, "admin-api"))
                        .claim("scope", "openid mcp.read")
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(60))
                        .build();

        assertThat(McpAdminApiAccessFilter.isMcpPurposeToken(jwt, MCP_AUDIENCE)).isTrue();
    }

    @Test
    void recognizesMcpPurposeTokenWithScopeListClaim() {
        Jwt jwt =
                Jwt.withTokenValue("token")
                        .header("alg", "none")
                        .audience(List.of(MCP_AUDIENCE, "admin-api"))
                        .claim("scope", List.of("mcp.read"))
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(60))
                        .build();

        assertThat(McpAdminApiAccessFilter.isMcpPurposeToken(jwt, MCP_AUDIENCE)).isTrue();
    }

    @Test
    void requiresMcpAudienceAndScopeTogether() {
        Jwt noAudience =
                Jwt.withTokenValue("token")
                        .header("alg", "none")
                        .audience(List.of("admin-api"))
                        .claim("scope", "mcp.read")
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(60))
                        .build();
        Jwt noScope =
                Jwt.withTokenValue("token")
                        .header("alg", "none")
                        .audience(List.of(MCP_AUDIENCE, "admin-api"))
                        .claim("scope", "admin-api")
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(60))
                        .build();

        assertThat(McpAdminApiAccessFilter.isMcpPurposeToken(noAudience, MCP_AUDIENCE)).isFalse();
        assertThat(McpAdminApiAccessFilter.isMcpPurposeToken(noScope, MCP_AUDIENCE)).isFalse();
    }

    @Test
    void requiresAdminApiAudienceForMcpPurposeToken() {
        Jwt jwt =
                Jwt.withTokenValue("token")
                        .header("alg", "none")
                        .audience(List.of(MCP_AUDIENCE))
                        .claim("scope", "mcp.read")
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(60))
                        .build();

        assertThat(McpAdminApiAccessFilter.isMcpPurposeToken(jwt, MCP_AUDIENCE)).isFalse();
    }

    @Test
    void rejectsTokenWithMissingAudienceClaim() {
        Jwt jwt =
                Jwt.withTokenValue("token")
                        .header("alg", "none")
                        .claim("scope", "mcp.read")
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(60))
                        .build();

        assertThat(McpAdminApiAccessFilter.isMcpPurposeToken(jwt, MCP_AUDIENCE)).isFalse();
    }

    @Test
    void onlyAllowsGetForKnownMcpToolRoutePatterns() {
        assertThat(
                        McpAdminApiAccessFilter.isAllowedReadOnlyRequest(
                                "GET", "/api/admin/organizations/5/groups/7/members"))
                .isTrue();
        assertThat(McpAdminApiAccessFilter.isAllowedReadOnlyRequest("POST", "/api/admin/users"))
                .isFalse();
        assertThat(
                        McpAdminApiAccessFilter.isAllowedReadOnlyRequest(
                                "GET", "/api/admin/settings/login"))
                .isFalse();
    }

    @Test
    void allowsOnlyExplicitWriteRoutesForMcpWriteScope() {
        Jwt writeToken = mcpWriteToken();
        Jwt readToken = mcpPurposeToken();

        assertThat(
                        McpAdminApiAccessFilter.isAllowedMcpRequest(
                                "PUT", "/api/admin/users/12/enabled", writeToken))
                .isTrue();
        assertThat(
                        McpAdminApiAccessFilter.isAllowedMcpRequest(
                                "POST", "/api/admin/groups/3/users", writeToken))
                .isTrue();
        assertThat(
                        McpAdminApiAccessFilter.isAllowedMcpRequest(
                                "DELETE", "/api/admin/groups/3/users/12", writeToken))
                .isTrue();
        assertThat(
                        McpAdminApiAccessFilter.isAllowedMcpRequest(
                                "DELETE", "/api/admin/sessions/session-1", writeToken))
                .isTrue();
        assertThat(
                        McpAdminApiAccessFilter.isAllowedMcpRequest(
                                "DELETE", "/api/admin/users/12", writeToken))
                .isFalse();
        assertThat(
                        McpAdminApiAccessFilter.isAllowedMcpRequest(
                                "PUT", "/api/admin/users/12/enabled", readToken))
                .isFalse();
    }

    @Test
    void allowsMcpPurposeTokenOnReadOnlyPathAfterRemovingContextPath()
            throws ServletException, IOException {
        setAuthentication(jwtAuthentication(mcpPurposeToken()));
        var filter = new McpAdminApiAccessFilter(MCP_AUDIENCE);
        var request = new MockHttpServletRequest("GET", "/gateway/api/admin/users");
        request.setContextPath("/gateway");
        var response = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isSameAs(request);
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void rejectsMcpAudienceTokenWithoutMcpPurpose() throws ServletException, IOException {
        Jwt token =
                Jwt.withTokenValue("token")
                        .header("alg", "none")
                        .audience(List.of(MCP_AUDIENCE, "admin-api"))
                        .claim("scope", "admin-api")
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(60))
                        .build();
        setAuthentication(jwtAuthentication(token));
        var filter = new McpAdminApiAccessFilter(MCP_AUDIENCE);
        var request = new MockHttpServletRequest("GET", "/api/admin/users");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(403);
    }

    @Test
    void rejectsMcpPurposeTokenOnWriteRequest() throws ServletException, IOException {
        setAuthentication(jwtAuthentication(mcpPurposeToken()));
        var filter = new McpAdminApiAccessFilter(MCP_AUDIENCE);
        var request = new MockHttpServletRequest("POST", "/api/admin/users");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(403);
    }

    @Test
    void leavesRequestsWithoutMcpAudienceAuthenticationToTheNextFilter()
            throws ServletException, IOException {
        setAuthentication(
                jwtAuthentication(
                        Jwt.withTokenValue("token")
                                .header("alg", "none")
                                .audience(List.of("admin-api"))
                                .claim("scope", "mcp.read")
                                .issuedAt(Instant.now())
                                .expiresAt(Instant.now().plusSeconds(60))
                                .build()));
        var filter = new McpAdminApiAccessFilter(MCP_AUDIENCE);
        var request = new MockHttpServletRequest("POST", "/api/admin/users");
        var response = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isSameAs(request);
        assertThat(response.getStatus()).isEqualTo(200);
    }

    private static Jwt mcpPurposeToken() {
        return Jwt.withTokenValue("token")
                .header("alg", "none")
                .audience(List.of(MCP_AUDIENCE, "admin-api"))
                .claim("scope", "openid mcp.read")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
    }

    private static Jwt mcpWriteToken() {
        return Jwt.withTokenValue("token")
                .header("alg", "none")
                .audience(List.of(MCP_AUDIENCE, "admin-api"))
                .claim("scope", "mcp.write")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
    }

    private static JwtAuthenticationToken jwtAuthentication(Jwt token) {
        return new JwtAuthenticationToken(token);
    }

    private static void setAuthentication(
            org.springframework.security.core.Authentication authentication) {
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
