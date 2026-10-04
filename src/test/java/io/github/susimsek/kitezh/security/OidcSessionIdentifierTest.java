package io.github.susimsek.kitezh.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class OidcSessionIdentifierTest {

    @Test
    void derivesStableOpaqueIdentifiersAndMatchesTheirSourceSession() {
        String identifier = OidcSessionIdentifier.fromSessionId("browser-session-1");

        assertThat(identifier)
                .isEqualTo(OidcSessionIdentifier.fromSessionId("browser-session-1"))
                .doesNotContain("browser-session-1");
        assertThat(OidcSessionIdentifier.matches(identifier, "browser-session-1")).isTrue();
        assertThat(OidcSessionIdentifier.matches(identifier, "browser-session-2")).isFalse();
        assertThat(OidcSessionIdentifier.matches(null, "browser-session-1")).isFalse();
    }
}
