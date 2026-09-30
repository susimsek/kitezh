package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class EventListenerDeliveryServiceTest {

    @Test
    void redactsSensitivePayloadFieldsAndBoundsPayloadSize() {
        String payload = "{\"password\":\"pw\",\"accessToken\":\"token\"}";

        String sanitized = EventListenerDeliveryService.sanitizePayload(payload);

        assertThat(sanitized)
                .contains("\"password\":\"[REDACTED]\"")
                .contains("\"accessToken\":\"[REDACTED]\"")
                .doesNotContain("pw", "token");
        assertThat(EventListenerDeliveryService.sanitizePayload("x".repeat(10001))).hasSize(10000);
    }

    @Test
    void rejectsNonHttpsAndPrivateEndpointsEvenWhenHttpIsEnabled() {
        assertThat(EventListenerDeliveryService.isAllowedEndpoint("http://example.com", false))
                .isFalse();
        assertThat(EventListenerDeliveryService.isAllowedEndpoint("http://127.0.0.1", true))
                .isFalse();
        assertThat(EventListenerDeliveryService.isAllowedEndpoint("https://localhost", true))
                .isFalse();
        assertThat(EventListenerDeliveryService.isAllowedEndpoint("https://169.254.169.254", true))
                .isFalse();
    }
}
