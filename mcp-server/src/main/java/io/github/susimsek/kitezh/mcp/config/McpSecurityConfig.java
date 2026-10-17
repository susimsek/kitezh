package io.github.susimsek.kitezh.mcp.config;

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
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;

@Configuration(proxyBeanMethods = false)
public class McpSecurityConfig {

    @Bean
    SecurityFilterChain mcpSecurityFilterChain(
            HttpSecurity http,
            @Value("${kitezh.security.issuer-uri}") String issuer,
            @Value("${kitezh.security.audience}") String audience)
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
                                        .authenticationEntryPoint(metadataEntryPoint()))
                .sessionManagement(
                        session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.disable());
        return http.build();
    }

    private static AuthenticationEntryPoint metadataEntryPoint() {
        return (request, response, exception) -> {
            new BearerTokenAuthenticationEntryPoint().commence(request, response, exception);
            response.setHeader(
                    "WWW-Authenticate",
                    "Bearer resource_metadata=\""
                            + request.getScheme()
                            + "://"
                            + request.getServerName()
                            + "/.well-known/oauth-protected-resource\", scope=\"mcp.read\"");
        };
    }

    @Bean
    JwtDecoder jwtDecoder(
            @Value("${kitezh.security.issuer-uri}") String issuer,
            @Value("${kitezh.security.audience}") String audience) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(issuer + "/oauth2/jwks").build();
        OAuth2TokenValidator<Jwt> audienceValidator =
                jwt ->
                        jwt.getAudience().contains(audience)
                                ? OAuth2TokenValidatorResult.success()
                                : OAuth2TokenValidatorResult.failure(
                                        new OAuth2Error(
                                                "invalid_token", "Invalid token audience", null));
        decoder.setJwtValidator(
                new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(
                        JwtValidators.createDefaultWithIssuer(issuer), audienceValidator));
        return decoder;
    }

    @Bean
    Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter scopes = new JwtGrantedAuthoritiesConverter();
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> scopes.convert(jwt));
        return converter;
    }
}
