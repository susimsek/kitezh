package io.github.susimsek.kitezh.mcp.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

class McpSecurityConfigTest {

    private final McpSecurityConfig config = new McpSecurityConfig();

    @Test
    void mapsMcpScopeAndKitezhRolesFromJwtClaims() {
        Jwt jwt =
                Jwt.withTokenValue("token")
                        .header("alg", "none")
                        .claim("scope", "mcp.read")
                        .claim("roles", List.of("ROLE_USER_VIEWER", "ROLE_", "OTHER_ROLE", 42))
                        .build();

        Set<String> authorities =
                config.jwtAuthenticationConverter().convert(jwt).getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .collect(Collectors.toSet());

        assertThat(authorities).contains("SCOPE_mcp.read", "ROLE_USER_VIEWER");
        assertThat(authorities).doesNotContain("ROLE_", "OTHER_ROLE", "42");
    }

    @Test
    void mapsMcpWriteScopeFromJwtClaims() {
        Jwt jwt =
                Jwt.withTokenValue("token")
                        .header("alg", "none")
                        .claim("scope", "mcp.write")
                        .build();

        Set<String> authorities =
                config.jwtAuthenticationConverter().convert(jwt).getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .collect(Collectors.toSet());

        assertThat(authorities).contains("SCOPE_mcp.write");
    }

    @Test
    void validatesMcpAudience() {
        Jwt matchingAudience =
                Jwt.withTokenValue("token")
                        .header("alg", "none")
                        .audience(List.of("https://kitezh-mcp.test/mcp"))
                        .build();
        Jwt wrongAudience =
                Jwt.withTokenValue("token")
                        .header("alg", "none")
                        .audience(List.of("https://other.test/mcp"))
                        .build();

        OAuth2TokenValidatorResult accepted =
                McpSecurityConfig.audienceValidator("https://kitezh-mcp.test/mcp")
                        .validate(matchingAudience);
        OAuth2TokenValidatorResult rejected =
                McpSecurityConfig.audienceValidator("https://kitezh-mcp.test/mcp")
                        .validate(wrongAudience);

        assertThat(accepted.hasErrors()).isFalse();
        assertThat(rejected.hasErrors()).isTrue();
        assertThat(rejected.getErrors())
                .anySatisfy(error -> assertThat(error.getErrorCode()).isEqualTo("invalid_token"));
    }
}
