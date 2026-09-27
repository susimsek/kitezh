package io.github.susimsek.springauthserversamples.config.security;

import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.repository.AuthorizationRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration(proxyBeanMethods = false)
@SuppressWarnings("java:S112")
public class AccountApiSecurityConfig {

    @Bean
    @Order(2)
    SecurityFilterChain accountApiSecurityFilterChain(
            HttpSecurity http,
            JwtDecoder accountApiJwtDecoder,
            ApplicationProperties applicationProperties) {
        return accountApiSecurityFilterChain(
                http, accountApiJwtDecoder, new DpopNonceService(applicationProperties.dpop()));
    }

    SecurityFilterChain accountApiSecurityFilterChain(
            HttpSecurity http, JwtDecoder accountApiJwtDecoder) {
        return accountApiSecurityFilterChain(
                http,
                accountApiJwtDecoder,
                new DpopNonceService(new ApplicationProperties().dpop()));
    }

    private SecurityFilterChain accountApiSecurityFilterChain(
            HttpSecurity http, JwtDecoder accountApiJwtDecoder, DpopNonceService nonceService) {
        ConsoleApiSecurity.stateless(http);
        http.securityMatcher("/api/account/**", "/api/auth/localization/me", "/api/ciba/**")
                .authorizeHttpRequests(
                        authorize -> authorize.anyRequest().hasAuthority("SCOPE_account-api"))
                .oauth2ResourceServer(
                        resourceServer ->
                                resourceServer
                                        .jwt(jwt -> jwt.decoder(accountApiJwtDecoder))
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
    JwtDecoder accountApiJwtDecoder(
            JWKSource<SecurityContext> jwkSource,
            ApplicationProperties applicationProperties,
            AuthorizationRepository authorizationRepository) {
        return ConsoleJwtDecoderFactory.create(
                jwkSource,
                applicationProperties.authorizationServer().issuer(),
                ConsoleClients.ACCOUNT,
                authorizationRepository);
    }
}
