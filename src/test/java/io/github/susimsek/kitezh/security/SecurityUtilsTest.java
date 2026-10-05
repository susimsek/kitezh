package io.github.susimsek.kitezh.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.oauth2.jwt.Jwt;

class SecurityUtilsTest {

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void returnsEmptyWhenAuthenticationIsMissing() {
        assertThat(SecurityUtils.getCurrentUserLogin()).isEmpty();
    }

    @Test
    void returnsEmptyForAnonymousAuthentication() {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new AnonymousAuthenticationToken(
                                "key",
                                "anonymousUser",
                                List.of(
                                        new SimpleGrantedAuthority(
                                                AuthoritiesConstants.ANONYMOUS))));

        assertThat(SecurityUtils.getCurrentUserLogin()).isEmpty();
    }

    @Test
    void extractsUserDetailsPrincipal() {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        UsernamePasswordAuthenticationToken.authenticated(
                                User.withUsername("admin")
                                        .password("password")
                                        .authorities(AuthoritiesConstants.ADMIN)
                                        .build(),
                                null,
                                List.of(new SimpleGrantedAuthority(AuthoritiesConstants.ADMIN))));

        assertThat(SecurityUtils.getCurrentUserLogin()).contains("admin");
    }

    @Test
    void extractsJwtPrincipal() {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new TestingAuthenticationToken(
                                new Jwt(
                                        "token",
                                        Instant.EPOCH,
                                        Instant.EPOCH.plusSeconds(3600),
                                        Map.of("alg", "HS256"),
                                        Map.of("sub", "jwt-user")),
                                null));

        assertThat(SecurityUtils.getCurrentUserLogin()).contains("jwt-user");
    }

    @Test
    void extractsStringPrincipal() {
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken("system", null));

        assertThat(SecurityUtils.getCurrentUserLogin()).contains("system");
    }

    @Test
    void returnsEmptyForUnsupportedPrincipal() {
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken(new Object(), null));

        assertThat(SecurityUtils.getCurrentUserLogin()).isEmpty();
    }
}
