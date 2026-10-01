package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import io.github.susimsek.kitezh.domain.EventListenerDeliveryEntity;
import io.github.susimsek.kitezh.domain.EventListenerDeliveryStatus;
import io.github.susimsek.kitezh.domain.EventListenerEventType;
import io.github.susimsek.kitezh.domain.EventListenerProviderEntity;
import io.github.susimsek.kitezh.domain.EventListenerProviderType;
import io.github.susimsek.kitezh.repository.EventListenerDeliveryRepository;
import io.github.susimsek.kitezh.repository.EventListenerProviderRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

class EventListenerDeliveryServiceTest {

    private final EventListenerProviderRepository providerRepository =
            mock(EventListenerProviderRepository.class);
    private final EventListenerDeliveryRepository deliveryRepository =
            mock(EventListenerDeliveryRepository.class);
    private final ObjectMapper objectMapper = mock(ObjectMapper.class);

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
    void redactsNestedSensitivePayloadFieldsAndPreservesBlankValues() {
        String payload =
                "{\"nested\":{\"apiSecret\":\"secret-value\"},"
                        + "\"items\":[{\"refreshToken\":\"token-value\"}]}";

        assertThat(EventListenerDeliveryService.sanitizePayload(payload))
                .contains("\"apiSecret\":\"[REDACTED]\"")
                .contains("\"refreshToken\":\"[REDACTED]\"")
                .doesNotContain("secret-value", "token-value");
        assertThat(EventListenerDeliveryService.sanitizePayload(null)).isNull();
        assertThat(EventListenerDeliveryService.sanitizePayload(" ")).isEqualTo(" ");
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
        assertThat(EventListenerDeliveryService.isAllowedEndpoint("https://example.com/events"))
                .isTrue();
        assertThat(EventListenerDeliveryService.isAllowedEndpoint("https://example.com/events?x=1"))
                .isFalse();
        assertThat(EventListenerDeliveryService.isAllowedEndpoint("https://user@example.com"))
                .isFalse();
        assertThat(EventListenerDeliveryService.isAllowedEndpoint("not a uri")).isFalse();
    }

    @Test
    void dispatchesOnlyMatchingEnabledProvidersAndQueuesSafePayload() throws Exception {
        EventListenerProviderEntity enabled = provider("provider-1", true);
        EventListenerProviderEntity disabled = provider("provider-2", false);
        when(providerRepository.findAll()).thenReturn(List.of(enabled, disabled));
        when(objectMapper.writeValueAsString(anyMap()))
                .thenReturn("{\"username\":\"alice\",\"token\":\"secret\"}");

        EventListenerDeliveryService service = service(RestClient.builder().build());
        service.dispatch(EventListenerEventType.USER_EVENT, "event-1", Map.of("username", "alice"));

        verify(deliveryRepository)
                .save(
                        org.mockito.ArgumentMatchers.argThat(
                                delivery ->
                                        delivery.getProviderId().equals("provider-1")
                                                && delivery.getEventId().equals("event-1")
                                                && delivery.getStatus()
                                                        == EventListenerDeliveryStatus.PENDING
                                                && delivery.getPayload().contains("[REDACTED]")));
    }

    @Test
    void usesFallbackPayloadWhenSerializationFails() throws Exception {
        when(providerRepository.findAll()).thenReturn(List.of(provider("provider-1", true)));
        when(objectMapper.writeValueAsString(anyMap())).thenThrow(new IllegalStateException("bad"));

        service(RestClient.builder().build())
                .dispatch(EventListenerEventType.USER_EVENT, "event-1", Map.of("key", "value"));

        verify(deliveryRepository)
                .save(
                        org.mockito.ArgumentMatchers.argThat(
                                delivery ->
                                        delivery.getPayload()
                                                .equals("{\"eventType\":\"unknown\"}")));
    }

    @Test
    void processesSuccessfulDeliveryAndRetriesThenFails() {
        RestClient.Builder builder = RestClient.builder();
        EventListenerProviderEntity provider = provider("provider-1", true);
        provider.setMaxAttempts(2);
        EventListenerDeliveryEntity delivery = delivery("provider-1");
        when(providerRepository.findById("provider-1")).thenReturn(Optional.of(provider));
        when(deliveryRepository
                        .findTop100ByStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
                                any(), any()))
                .thenReturn(List.of(delivery));

        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://example.com/events"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().json("{\"event\":\"value\"}"))
                .andRespond(withSuccess());
        EventListenerDeliveryService service = service(builder.build());
        service.processDueDeliveries();
        assertThat(delivery.getStatus()).isEqualTo(EventListenerDeliveryStatus.SUCCEEDED);
        assertThat(delivery.getAttempts()).isEqualTo(1);
        assertThat(delivery.getCompletedAt()).isNotNull();
        server.verify();

        EventListenerDeliveryEntity failed = delivery("provider-1");
        when(deliveryRepository
                        .findTop100ByStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
                                any(), any()))
                .thenReturn(List.of(failed));
        server.reset();
        server.expect(requestTo("https://example.com/events")).andRespond(withServerError());
        server.expect(requestTo("https://example.com/events")).andRespond(withServerError());
        service.processDueDeliveries();
        assertThat(failed.getStatus()).isEqualTo(EventListenerDeliveryStatus.PENDING);
        service.processDueDeliveries();
        assertThat(failed.getStatus()).isEqualTo(EventListenerDeliveryStatus.FAILED);
        assertThat(failed.getAttempts()).isEqualTo(2);
        server.verify();
    }

    @Test
    void marksMissingDisabledAndUnsafeProvidersAsFailed() {
        EventListenerDeliveryEntity missing = delivery("missing");
        when(deliveryRepository
                        .findTop100ByStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
                                any(), any()))
                .thenReturn(List.of(missing));
        when(providerRepository.findById("missing")).thenReturn(Optional.empty());
        EventListenerDeliveryService service = service(RestClient.builder().build());
        service.processDueDeliveries();
        assertThat(missing.getStatus()).isEqualTo(EventListenerDeliveryStatus.FAILED);

        EventListenerDeliveryEntity disabled = delivery("disabled");
        EventListenerProviderEntity disabledProvider = provider("disabled", false);
        when(deliveryRepository
                        .findTop100ByStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
                                any(), any()))
                .thenReturn(List.of(disabled));
        when(providerRepository.findById("disabled")).thenReturn(Optional.of(disabledProvider));
        service.processDueDeliveries();
        assertThat(disabled.getStatus()).isEqualTo(EventListenerDeliveryStatus.FAILED);

        EventListenerDeliveryEntity unsafe = delivery("unsafe");
        EventListenerProviderEntity unsafeProvider = provider("unsafe", true);
        unsafeProvider.setEndpointUrl("http://127.0.0.1");
        when(deliveryRepository
                        .findTop100ByStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
                                any(), any()))
                .thenReturn(List.of(unsafe));
        when(providerRepository.findById("unsafe")).thenReturn(Optional.of(unsafeProvider));
        service.processDueDeliveries();
        assertThat(unsafe.getStatus()).isEqualTo(EventListenerDeliveryStatus.FAILED);
    }

    @Test
    void retriesPendingDeliveriesButLeavesSuccessfulOnesUntouched() {
        EventListenerDeliveryEntity pending = delivery("provider-1");
        EventListenerDeliveryEntity succeeded = delivery("provider-1");
        succeeded.setStatus(EventListenerDeliveryStatus.SUCCEEDED);
        when(deliveryRepository.findById("pending")).thenReturn(Optional.of(pending));
        when(deliveryRepository.findById("succeeded")).thenReturn(Optional.of(succeeded));
        pending.setId("pending");
        succeeded.setId("succeeded");

        EventListenerDeliveryService service = service(RestClient.builder().build());
        service.retry("pending");
        service.retry("succeeded");
        service.retry("missing");

        assertThat(pending.getStatus()).isEqualTo(EventListenerDeliveryStatus.PENDING);
        assertThat(pending.getNextAttemptAt()).isNotNull();
        verify(deliveryRepository).save(pending);
        verifyNoInteractions(objectMapper);
    }

    private EventListenerDeliveryService service(RestClient restClient) {
        return new EventListenerDeliveryService(
                providerRepository, deliveryRepository, objectMapper, restClient);
    }

    private static EventListenerProviderEntity provider(String id, boolean enabled) {
        EventListenerProviderEntity provider = new EventListenerProviderEntity();
        provider.setId(id);
        provider.setName(id);
        provider.setProviderType(EventListenerProviderType.WEBHOOK);
        provider.setEndpointUrl("https://example.com/events");
        provider.setEnabled(enabled);
        provider.setMaxAttempts(3);
        provider.setBackoffSeconds(1);
        provider.setEventTypes(java.util.Set.of(EventListenerEventType.USER_EVENT));
        return provider;
    }

    private static EventListenerDeliveryEntity delivery(String providerId) {
        EventListenerDeliveryEntity delivery = new EventListenerDeliveryEntity();
        delivery.setId(UUID.randomUUID().toString());
        delivery.setProviderId(providerId);
        delivery.setEventId("event-1");
        delivery.setEventType(EventListenerEventType.USER_EVENT);
        delivery.setPayload("{\"event\":\"value\"}");
        delivery.setStatus(EventListenerDeliveryStatus.PENDING);
        delivery.setNextAttemptAt(Instant.now());
        delivery.setCreatedAt(Instant.now());
        return delivery;
    }
}
