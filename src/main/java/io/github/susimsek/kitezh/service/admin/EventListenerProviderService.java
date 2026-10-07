package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.EventListenerDeliveryEntity;
import io.github.susimsek.kitezh.domain.EventListenerProviderEntity;
import io.github.susimsek.kitezh.dto.admin.EventListenerDeliveryDTO;
import io.github.susimsek.kitezh.dto.admin.EventListenerProviderDTO;
import io.github.susimsek.kitezh.dto.admin.EventListenerProviderRequestDTO;
import io.github.susimsek.kitezh.repository.EventListenerDeliveryRepository;
import io.github.susimsek.kitezh.repository.EventListenerProviderRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EventListenerProviderService {
    private static final String EVENT_LISTENER = "event-listener";

    private final EventListenerProviderRepository repository;
    private final EventListenerDeliveryRepository deliveryRepository;
    private final AdminAuditEventService auditEventService;

    @Value("${app.events.listener.allow-http:false}")
    private boolean allowHttp;

    @Transactional(readOnly = true)
    public Page<EventListenerProviderDTO> list(Pageable pageable) {
        return repository.findAll(pageable).map(EventListenerProviderService::toDTO);
    }

    @Transactional(readOnly = true)
    public EventListenerProviderDTO get(String id) {
        return toDTO(entity(id));
    }

    @Transactional
    public EventListenerProviderDTO create(EventListenerProviderRequestDTO request) {
        ensureUniqueName(request.name(), null);
        ensureEndpoint(request.endpointUrl());
        EventListenerProviderEntity entity = new EventListenerProviderEntity();
        entity.setId(UUID.randomUUID().toString());
        apply(entity, request);
        Instant now = Instant.now();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
        auditEventService.record("event-listener.created", EVENT_LISTENER, entity.getId());
        return toDTO(entity);
    }

    @Transactional
    public EventListenerProviderDTO update(String id, EventListenerProviderRequestDTO request) {
        EventListenerProviderEntity entity = entity(id);
        ensureUniqueName(request.name(), id);
        ensureEndpoint(request.endpointUrl());
        apply(entity, request);
        entity.setUpdatedAt(Instant.now());
        repository.save(entity);
        auditEventService.record("event-listener.updated", EVENT_LISTENER, id);
        return toDTO(entity);
    }

    @Transactional
    public void delete(String id) {
        entity(id);
        repository.deleteById(id);
        auditEventService.record("event-listener.deleted", EVENT_LISTENER, id);
    }

    @Transactional(readOnly = true)
    public Page<EventListenerDeliveryDTO> deliveries(String providerId, Pageable pageable) {
        if (providerId != null) {
            entity(providerId);
        }
        return (providerId == null
                        ? deliveryRepository.findAll(pageable)
                        : deliveryRepository.findByProviderId(providerId, pageable))
                .map(EventListenerProviderService::toDTO);
    }

    private EventListenerProviderEntity entity(String id) {
        return repository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("Event listener provider not found"));
    }

    private void ensureUniqueName(String name, String id) {
        repository
                .findByNameIgnoreCase(name)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(
                        existing -> {
                            throw ApiException.conflict(
                                    ApiErrorCode.CONFLICT,
                                    "Event listener provider name already exists");
                        });
    }

    private void ensureEndpoint(String endpointUrl) {
        if (!EventListenerDeliveryService.isAllowedEndpoint(endpointUrl, allowHttp)) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "endpointUrl must be a public HTTPS URL");
        }
    }

    private static void apply(
            EventListenerProviderEntity entity, EventListenerProviderRequestDTO request) {
        entity.setName(request.name().trim());
        entity.setProviderType(request.providerType());
        entity.setEndpointUrl(request.endpointUrl().trim());
        entity.setEnabled(request.enabled());
        entity.setMaxAttempts(request.maxAttempts());
        entity.setBackoffSeconds(request.backoffSeconds());
        entity.setEventTypes(new HashSet<>(request.eventTypes()));
    }

    private static EventListenerProviderDTO toDTO(EventListenerProviderEntity entity) {
        return new EventListenerProviderDTO(
                entity.getId(),
                entity.getName(),
                entity.getProviderType(),
                entity.getEndpointUrl(),
                entity.isEnabled(),
                entity.getMaxAttempts(),
                entity.getBackoffSeconds(),
                Set.copyOf(entity.getEventTypes()),
                entity.getCreatedAt(),
                entity.getUpdatedAt());
    }

    private static EventListenerDeliveryDTO toDTO(EventListenerDeliveryEntity entity) {
        return new EventListenerDeliveryDTO(
                entity.getId(),
                entity.getProviderId(),
                entity.getEventId(),
                entity.getEventType(),
                entity.getStatus(),
                entity.getAttempts(),
                entity.getNextAttemptAt(),
                entity.getLastError(),
                entity.getCreatedAt(),
                entity.getCompletedAt());
    }
}
