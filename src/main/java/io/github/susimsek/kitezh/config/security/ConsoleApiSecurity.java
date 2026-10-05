package io.github.susimsek.kitezh.config.security;

import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.authentication.session.NullAuthenticatedSessionStrategy;
import org.springframework.security.web.context.NullSecurityContextRepository;

@SuppressWarnings("java:S112")
final class ConsoleApiSecurity {

    private ConsoleApiSecurity() {}

    static void stateless(HttpSecurity http) {
        http.csrf(
                        AbstractHttpConfigurer
                                ::disable) // NOSONAR - this chain is stateless and authenticates
                // with bearer tokens.
                .securityContext(
                        securityContext ->
                                securityContext.securityContextRepository(
                                        new NullSecurityContextRepository()))
                .sessionManagement(
                        session ->
                                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                                        .sessionAuthenticationStrategy(
                                                new NullAuthenticatedSessionStrategy()))
                .requestCache(AbstractHttpConfigurer::disable);
    }
}
