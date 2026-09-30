package io.github.susimsek.springauthserversamples.service.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

class OAuth2ObservabilityMetricsTest {

    @Test
    void recordsBoundedOAuthEventTags() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        OAuth2ObservabilityMetrics metrics = new OAuth2ObservabilityMetrics(registry);

        metrics.recordToken(
                "refresh_token", "success", null, "refresh_token", "refresh_token", "demo-client");

        assertThat(registry.get("spring.authorization.server.events").counter().count())
                .isEqualTo(1);
        assertThat(
                        registry.get("spring.authorization.server.events")
                                .tag("event", "refresh_token")
                                .tag("grant_type", "refresh_token")
                                .tag("token_type", "refresh_token")
                                .tag("client_id", "demo-client")
                                .counter()
                                .count())
                .isEqualTo(1);
    }

    @Test
    void doesNotFailWhenNoRegistryIsAvailable() {
        assertThatCode(
                        () ->
                                OAuth2ObservabilityMetrics.noop()
                                        .recordOAuthError("client_credentials", "invalid_client"))
                .doesNotThrowAnyException();
    }
}
