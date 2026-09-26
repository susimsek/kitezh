package io.github.susimsek.springauthserversamples.config.security;

import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.repository.AuthorizationRepository;
import io.github.susimsek.springauthserversamples.security.AuthoritiesConstants;
import java.util.ArrayList;
import java.util.Collection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration(proxyBeanMethods = false)
@SuppressWarnings("java:S112")
public class AdminApiSecurityConfig {

    private static final String USERS_API_PATH = "/api/admin/users/**";

    @Bean
    @Order(1)
    SecurityFilterChain adminApiSecurityFilterChain(
            HttpSecurity http,
            JwtDecoder adminApiJwtDecoder,
            ApplicationProperties applicationProperties) {
        return adminApiSecurityFilterChain(
                http, adminApiJwtDecoder, new DpopNonceService(applicationProperties.dpop()));
    }

    SecurityFilterChain adminApiSecurityFilterChain(
            HttpSecurity http, JwtDecoder adminApiJwtDecoder) {
        return adminApiSecurityFilterChain(
                http, adminApiJwtDecoder, new DpopNonceService(new ApplicationProperties().dpop()));
    }

    private SecurityFilterChain adminApiSecurityFilterChain(
            HttpSecurity http, JwtDecoder adminApiJwtDecoder, DpopNonceService nonceService) {
        ConsoleApiSecurity.stateless(http);
        http.securityMatcher("/api/admin/**")
                .authorizeHttpRequests(
                        authorize ->
                                authorize
                                        .requestMatchers(HttpMethod.GET, "/api/admin/dashboard")
                                        .hasAuthority(AuthoritiesConstants.ADMIN)
                                        .requestMatchers("/api/admin/settings/**")
                                        .hasAuthority(AuthoritiesConstants.ADMIN)
                                        .requestMatchers("/api/admin/whoami")
                                        .hasAuthority("SCOPE_admin-api")
                                        .requestMatchers(
                                                HttpMethod.GET, "/api/admin/profile-attributes")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_VIEWER,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers(
                                                HttpMethod.GET,
                                                "/api/admin/users/*/events",
                                                "/api/admin/clients/*/events",
                                                "/api/admin/events",
                                                "/api/admin/events/config")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.EVENT_VIEWER,
                                                AuthoritiesConstants.EVENT_MANAGER)
                                        .requestMatchers(HttpMethod.DELETE, "/api/admin/events")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.EVENT_MANAGER)
                                        .requestMatchers(HttpMethod.PUT, "/api/admin/events/config")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.EVENT_MANAGER)
                                        .requestMatchers(
                                                HttpMethod.GET, "/api/admin/client-scopes/**")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.CLIENT_VIEWER,
                                                AuthoritiesConstants.CLIENT_MANAGER)
                                        .requestMatchers("/api/admin/client-scopes/**")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.CLIENT_MANAGER)
                                        .requestMatchers(HttpMethod.GET, "/api/admin/clients/**")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.CLIENT_VIEWER,
                                                AuthoritiesConstants.CLIENT_MANAGER)
                                        .requestMatchers("/api/admin/clients/**")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.CLIENT_MANAGER)
                                        .requestMatchers(HttpMethod.GET, USERS_API_PATH)
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_VIEWER,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers(
                                                HttpMethod.PUT,
                                                "/api/admin/users/*/webauthn/credentials/**")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers(
                                                HttpMethod.DELETE,
                                                "/api/admin/users/*/webauthn/credentials/**")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers(HttpMethod.GET, "/api/admin/groups/**")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_VIEWER,
                                                AuthoritiesConstants.USER_MANAGER,
                                                AuthoritiesConstants.GROUP_VIEWER,
                                                AuthoritiesConstants.GROUP_MANAGER)
                                        .requestMatchers(
                                                HttpMethod.PUT, "/api/admin/groups/*/roles")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_MANAGER,
                                                AuthoritiesConstants.GROUP_MANAGER)
                                        .requestMatchers(
                                                HttpMethod.GET, "/api/admin/groups/*/permissions")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_VIEWER,
                                                AuthoritiesConstants.USER_MANAGER,
                                                AuthoritiesConstants.GROUP_VIEWER,
                                                AuthoritiesConstants.GROUP_MANAGER)
                                        .requestMatchers(
                                                HttpMethod.PUT, "/api/admin/groups/*/permissions")
                                        .hasAuthority(AuthoritiesConstants.ADMIN)
                                        .requestMatchers("/api/admin/groups/**")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_MANAGER,
                                                AuthoritiesConstants.GROUP_MANAGER)
                                        .requestMatchers(
                                                HttpMethod.GET, "/api/admin/required-actions/**")
                                        .hasAuthority(AuthoritiesConstants.ADMIN)
                                        .requestMatchers(
                                                HttpMethod.PUT, "/api/admin/required-actions/**")
                                        .hasAuthority(AuthoritiesConstants.ADMIN)
                                        .requestMatchers(
                                                HttpMethod.POST,
                                                "/api/admin/required-actions/users/**")
                                        .hasAuthority(AuthoritiesConstants.ADMIN)
                                        .requestMatchers(
                                                HttpMethod.DELETE,
                                                "/api/admin/required-actions/users/**")
                                        .hasAuthority(AuthoritiesConstants.ADMIN)
                                        .requestMatchers(
                                                HttpMethod.POST, "/api/admin/users/*/impersonation")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_IMPERSONATOR)
                                        .requestMatchers(HttpMethod.PUT, USERS_API_PATH)
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers(HttpMethod.POST, "/api/admin/users")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers(HttpMethod.POST, "/api/admin/users/bulk")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers(
                                                HttpMethod.POST, "/api/admin/users/*/unlock")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers(HttpMethod.DELETE, USERS_API_PATH)
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers(HttpMethod.GET, "/api/admin/roles")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_VIEWER,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers(HttpMethod.GET, "/api/admin/roles/**")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers(HttpMethod.GET, "/api/admin/sessions/**")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_VIEWER,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers(
                                                HttpMethod.DELETE, "/api/admin/sessions/**")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers(HttpMethod.GET, "/api/admin/consents")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_VIEWER,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers(HttpMethod.GET, "/api/admin/consents/**")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_VIEWER,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers(
                                                HttpMethod.DELETE, "/api/admin/consents/**")
                                        .hasAnyAuthority(
                                                AuthoritiesConstants.ADMIN,
                                                AuthoritiesConstants.USER_MANAGER)
                                        .requestMatchers("/api/admin/**")
                                        .hasAuthority(AuthoritiesConstants.ADMIN))
                .oauth2ResourceServer(
                        resourceServer ->
                                resourceServer
                                        .jwt(
                                                jwt ->
                                                        jwt.decoder(adminApiJwtDecoder)
                                                                .jwtAuthenticationConverter(
                                                                        jwtAuthenticationConverter()))
                                        .dPoP(
                                                dpop ->
                                                        dpop.authenticationConverter(
                                                                        new DpopNonceAuthenticationConverter(
                                                                                nonceService))
                                                                .authenticationFailureHandler(
                                                                        new DpopNonceAuthenticationFailureHandler(
                                                                                nonceService))));

        return http.build();
    }

    @Bean
    JwtDecoder adminApiJwtDecoder(
            JWKSource<SecurityContext> jwkSource,
            ApplicationProperties applicationProperties,
            AuthorizationRepository authorizationRepository) {
        return ConsoleJwtDecoderFactory.create(
                jwkSource,
                applicationProperties.authorizationServer().issuer(),
                ConsoleClients.ADMIN,
                authorizationRepository);
    }

    private static JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter scopeAuthorities = new JwtGrantedAuthoritiesConverter();
        JwtGrantedAuthoritiesConverter roleAuthorities = new JwtGrantedAuthoritiesConverter();
        roleAuthorities.setAuthoritiesClaimName("roles");
        roleAuthorities.setAuthorityPrefix("");

        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(
                jwt -> mergeAuthorities(jwt, scopeAuthorities, roleAuthorities));
        return converter;
    }

    private static Collection<GrantedAuthority> mergeAuthorities(
            Jwt jwt,
            JwtGrantedAuthoritiesConverter scopeAuthorities,
            JwtGrantedAuthoritiesConverter roleAuthorities) {
        Collection<GrantedAuthority> authorities = new ArrayList<>(scopeAuthorities.convert(jwt));
        authorities.addAll(roleAuthorities.convert(jwt));
        return authorities;
    }
}
