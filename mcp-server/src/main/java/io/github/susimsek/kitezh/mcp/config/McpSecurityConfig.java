package io.github.susimsek.kitezh.mcp.config;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import tools.jackson.databind.ObjectMapper;

@Configuration(proxyBeanMethods = false)
public class McpSecurityConfig {

    @Bean
    SecurityFilterChain mcpSecurityFilterChain(
            HttpSecurity http,
            ObjectMapper objectMapper,
            McpToolCatalogPolicy mcpToolCatalogPolicy,
            @Value("${kitezh.security.issuer-uri}") String issuer,
            @Value("${kitezh.security.audience}") String audience,
            @Value("${kitezh.mcp.public-url}") String publicUrl)
            throws Exception {
        http.authorizeHttpRequests(
                        authorize ->
                                authorize
                                        .requestMatchers(
                                                "/.well-known/oauth-protected-resource",
                                                "/actuator/health/**")
                                        .permitAll()
                                        .anyRequest()
                                        .hasAuthority("SCOPE_mcp.read"))
                .oauth2ResourceServer(
                        resourceServer ->
                                resourceServer
                                        .protectedResourceMetadata(
                                                metadata ->
                                                        metadata
                                                                .protectedResourceMetadataCustomizer(
                                                                        builder ->
                                                                                builder.resource(
                                                                                                audience)
                                                                                        .authorizationServer(
                                                                                                issuer)
                                                                                        .scope(
                                                                                                "mcp.read")
                                                                                        .bearerMethod(
                                                                                                "header")
                                                                                        .tlsClientCertificateBoundAccessTokens(
                                                                                                false)))
                                        .jwt(
                                                jwt ->
                                                        jwt.jwtAuthenticationConverter(
                                                                jwtAuthenticationConverter()))
                                        .authenticationEntryPoint(metadataEntryPoint(publicUrl)))
                .sessionManagement(
                        session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.disable());
        http.addFilterAfter(
                new McpToolAuthorizationFilter(objectMapper, mcpToolCatalogPolicy),
                BearerTokenAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    McpToolCatalogPolicy mcpToolCatalogPolicy(
            @Value("${kitezh.mcp.tools.toolsets:all}") String toolsets,
            @Value("${kitezh.mcp.tools.allowlist:*}") String allowlist) {
        return new McpToolCatalogPolicy(toolsets, allowlist);
    }

    private static AuthenticationEntryPoint metadataEntryPoint(String publicUrl) {
        String metadataUrl =
                URI.create(publicUrl).resolve("/").toString()
                        + ".well-known/oauth-protected-resource";
        return (request, response, exception) -> {
            new BearerTokenAuthenticationEntryPoint().commence(request, response, exception);
            response.setHeader(
                    "WWW-Authenticate",
                    "Bearer resource_metadata=\"" + metadataUrl + "\", scope=\"mcp.read\"");
        };
    }

    @Bean
    JwtDecoder jwtDecoder(
            @Value("${kitezh.security.issuer-uri}") String issuer,
            @Value("${kitezh.security.jwk-set-uri}") String jwkSetUri,
            @Value("${kitezh.security.audience}") String audience) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        decoder.setJwtValidator(
                new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(
                        JwtValidators.createDefaultWithIssuer(issuer),
                        audienceValidator(audience)));
        return decoder;
    }

    static OAuth2TokenValidator<Jwt> audienceValidator(String audience) {
        return jwt ->
                jwt.getAudience().contains(audience)
                        ? OAuth2TokenValidatorResult.success()
                        : OAuth2TokenValidatorResult.failure(
                                new OAuth2Error("invalid_token", "Invalid token audience", null));
    }

    @Bean
    Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter scopes = new JwtGrantedAuthoritiesConverter();
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(
                jwt -> {
                    java.util.Set<org.springframework.security.core.GrantedAuthority> authorities =
                            new java.util.LinkedHashSet<>(scopes.convert(jwt));
                    Object roles = jwt.getClaims().get("roles");
                    if (roles instanceof java.util.Collection<?> roleNames) {
                        roleNames.stream()
                                .filter(String.class::isInstance)
                                .map(String.class::cast)
                                .filter(McpSecurityConfig::isKitezhRole)
                                .map(
                                        org.springframework.security.core.authority
                                                        .SimpleGrantedAuthority
                                                ::new)
                                .forEach(authorities::add);
                    }
                    return authorities;
                });
        return converter;
    }

    private static boolean isKitezhRole(String role) {
        return role.startsWith("ROLE_") && role.length() > "ROLE_".length();
    }
}
