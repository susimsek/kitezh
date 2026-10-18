package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class McpAdminApiAccessFilterTest {

    private static final String MCP_AUDIENCE = "https://kitezh-mcp.onrender.com/mcp";

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
}
