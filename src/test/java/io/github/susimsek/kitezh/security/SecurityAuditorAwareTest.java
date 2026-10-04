package io.github.susimsek.kitezh.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class SecurityAuditorAwareTest {

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void returnsCurrentUserWhenAuthenticated() {
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken("admin", null));

        assertThat(new SecurityAuditorAware().getCurrentAuditor()).contains("admin");
    }

    @Test
    void fallsBackToSystemWhenNoUserIsAvailable() {
        assertThat(new SecurityAuditorAware().getCurrentAuditor()).contains("system");
    }
}
