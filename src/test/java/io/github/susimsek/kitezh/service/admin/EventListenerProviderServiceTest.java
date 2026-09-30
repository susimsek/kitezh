package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.EventListenerDeliveryEntity;
import io.github.susimsek.springauthserversamples.domain.EventListenerDeliveryStatus;
import io.github.susimsek.springauthserversamples.domain.EventListenerEventType;
import io.github.susimsek.springauthserversamples.domain.EventListenerProviderEntity;
import io.github.susimsek.springauthserversamples.domain.EventListenerProviderType;
import io.github.susimsek.springauthserversamples.dto.admin.EventListenerProviderRequestDTO;
import io.github.susimsek.springauthserversamples.repository.EventListenerDeliveryRepository;
import io.github.susimsek.springauthserversamples.repository.EventListenerProviderRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

class EventListenerProviderServiceTest {

    private final EventListenerProviderRepository repository =
            mock(EventListenerProviderRepository.class);
    private final EventListenerDeliveryRepository deliveryRepository =
            mock(EventListenerDeliveryRepository.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private final EventListenerProviderService service =
            new EventListenerProviderService(repository, deliveryRepository, auditEventService);

    @Test
    void managesProvidersAndDeliveryHistory() {
        EventListenerProviderRequestDTO request = request("security-hook", true);
        when(repository.findByNameIgnoreCase("security-hook")).thenReturn(Optional.empty());

        var created = service.create(request);
        assertThat(created.name()).isEqualTo("security-hook");
        assertThat(created.endpointUrl()).isEqualTo("https://example.com/events");
        verify(repository).save(any(EventListenerProviderEntity.class));
        verify(auditEventService).record("event-listener.created", "event-listener", created.id());

        EventListenerProviderEntity entity = entity(created.id(), "security-hook");
        when(repository.findById(created.id())).thenReturn(Optional.of(entity));
        assertThat(service.get(created.id()).name()).isEqualTo("security-hook");

        PageRequest pageable = PageRequest.of(0, 20);
        when(repository.findAll(pageable)).thenReturn(new PageImpl<>(List.of(entity)));
        assertThat(service.list(pageable).getContent()).hasSize(1);

        EventListenerProviderRequestDTO update = request("security-hook-updated", false);
        when(repository.findByNameIgnoreCase("security-hook-updated")).thenReturn(Optional.empty());
        assertThat(service.update(created.id(), update).name()).isEqualTo("security-hook-updated");
        verify(auditEventService).record("event-listener.updated", "event-listener", created.id());

        EventListenerDeliveryEntity delivery = delivery(created.id());
        when(deliveryRepository.findByProviderId(created.id(), pageable))
                .thenReturn(new PageImpl<>(List.of(delivery)));
        assertThat(service.deliveries(created.id(), pageable).getContent()).hasSize(1);
        when(deliveryRepository.findAll(pageable)).thenReturn(new PageImpl<>(List.of(delivery)));
        assertThat(service.deliveries(null, pageable).getContent()).hasSize(1);

        service.delete(created.id());
        verify(repository).deleteById(created.id());
        verify(auditEventService).record("event-listener.deleted", "event-listener", created.id());
    }

    @Test
    void rejectsDuplicateMissingAndUnsafeProviderConfigurations() {
        EventListenerProviderEntity existing = entity("existing", "duplicate");
        when(repository.findByNameIgnoreCase("duplicate")).thenReturn(Optional.of(existing));
        assertThatThrownBy(() -> service.create(request("duplicate", true)))
                .isInstanceOf(ApiException.class);

        assertThatThrownBy(() -> service.create(request("unsafe", true, "http://127.0.0.1")))
                .isInstanceOf(ApiException.class);

        when(repository.findById("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.get("missing")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.update("missing", request("missing", true)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.delete("missing")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.deliveries("missing", PageRequest.of(0, 20)))
                .isInstanceOf(ApiException.class);
    }

    private static EventListenerProviderRequestDTO request(String name, boolean enabled) {
        return request(name, enabled, "https://example.com/events");
    }

    private static EventListenerProviderRequestDTO request(
            String name, boolean enabled, String endpoint) {
        return new EventListenerProviderRequestDTO(
                name,
                EventListenerProviderType.WEBHOOK,
                endpoint,
                enabled,
                3,
                1,
                Set.of(EventListenerEventType.USER_EVENT));
    }

    private static EventListenerProviderEntity entity(String id, String name) {
        EventListenerProviderEntity entity = new EventListenerProviderEntity();
        entity.setId(id);
        entity.setName(name);
        entity.setProviderType(EventListenerProviderType.WEBHOOK);
        entity.setEndpointUrl("https://example.com/events");
        entity.setEnabled(true);
        entity.setMaxAttempts(3);
        entity.setBackoffSeconds(1);
        entity.setEventTypes(Set.of(EventListenerEventType.USER_EVENT));
        entity.setCreatedAt(Instant.EPOCH);
        entity.setUpdatedAt(Instant.EPOCH);
        return entity;
    }

    private static EventListenerDeliveryEntity delivery(String providerId) {
        EventListenerDeliveryEntity entity = new EventListenerDeliveryEntity();
        entity.setId("delivery-1");
        entity.setProviderId(providerId);
        entity.setEventId("event-1");
        entity.setEventType(EventListenerEventType.USER_EVENT);
        entity.setStatus(EventListenerDeliveryStatus.SUCCEEDED);
        entity.setAttempts(1);
        entity.setCreatedAt(Instant.EPOCH);
        return entity;
    }
}
