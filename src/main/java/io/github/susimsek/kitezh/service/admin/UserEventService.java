package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.UserEventEntity;
import io.github.susimsek.kitezh.domain.UserEventSettingsEntity;
import io.github.susimsek.kitezh.domain.UserEventType;
import io.github.susimsek.kitezh.dto.admin.UserEventDTO;
import io.github.susimsek.kitezh.mapper.UserEventMapper;
import io.github.susimsek.kitezh.repository.UserEventRepository;
import io.github.susimsek.kitezh.repository.UserEventSettingsRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserEventService {

    private final UserEventRepository repository;
    private final UserEventSettingsRepository settingsRepository;
    private final UserRepository userRepository;
    private final UserEventMapper mapper;
    private final AdminAuditEventService auditEventService;
    private EventListenerDeliveryService eventListenerDeliveryService;

    @Autowired(required = false)
    void setEventListenerDeliveryService(EventListenerDeliveryService service) {
        this.eventListenerDeliveryService = service;
    }

    @Transactional
    public void record(UserEventType type, String username, String ipAddress) {
        record(type, username, null, ipAddress);
    }

    @Transactional
    public void record(UserEventType type, String username, String clientId, String ipAddress) {
        var settings = settings();
        if (!settings.isEventsEnabled() || !settings.getEventTypes().contains(type)) {
            return;
        }
        if (settings.getEventsExpirationDays() > 0) {
            repository.deleteByOccurredAtBefore(
                    Instant.now().minus(settings.getEventsExpirationDays(), ChronoUnit.DAYS));
        }
        String eventId = UUID.randomUUID().toString();
        repository.save(
                mapper.toEntity(
                        eventId,
                        userRepository.findIdByUsername(username).orElse(null),
                        username,
                        type,
                        clientId,
                        ipAddress,
                        Instant.now()));
        if (eventListenerDeliveryService != null) {
            eventListenerDeliveryService.dispatch(
                    io.github.susimsek.kitezh.domain.EventListenerEventType
                            .USER_EVENT,
                    eventId,
                    Map.of(
                            "eventType",
                            type.name(),
                            "username",
                            username,
                            "clientId",
                            clientId == null ? "" : clientId,
                            "ipAddress",
                            ipAddress == null ? "" : ipAddress));
        }
    }

    @Transactional(readOnly = true)
    public Page<UserEventDTO> events(
            String query,
            UserEventType type,
            String username,
            String clientId,
            String ipAddress,
            Instant from,
            Instant to,
            Pageable pageable) {
        return repository
                .findAll(
                        eventSpecification(
                                AdminSearch.normalize(query),
                                type,
                                username,
                                clientId,
                                ipAddress,
                                from,
                                to),
                        pageable)
                .map(mapper::toDTO);
    }

    @Transactional(readOnly = true)
    public UserEventDTO event(String id) {
        return repository
                .findById(id)
                .map(mapper::toDTO)
                .orElseThrow(() -> ApiException.notFound("User event not found"));
    }

    @Transactional(readOnly = true)
    public Page<UserEventDTO> userEvents(Long userId, Pageable pageable) {
        return repository
                .findAll((root, _, cb) -> cb.equal(root.get("userId"), userId), pageable)
                .map(mapper::toDTO);
    }

    @Transactional
    public void deleteAll() {
        repository.deleteAllInBatch();
        auditEventService.record("user-events.cleared", "user-event", "all");
    }

    private UserEventSettingsEntity settings() {
        return settingsRepository
                .findById(UserEventSettingsService.SETTINGS_ID)
                .orElseThrow(
                        () -> new IllegalStateException("User event settings are not initialized"));
    }

    private static Specification<UserEventEntity> eventSpecification(
            String query,
            UserEventType type,
            String username,
            String clientId,
            String ipAddress,
            Instant from,
            Instant to) {
        return (root, _, cb) -> {
            var predicate = cb.conjunction();
            if (!query.isBlank()) {
                String like = "%" + query.toLowerCase() + "%";
                predicate =
                        cb.and(
                                predicate,
                                cb.or(
                                        cb.like(cb.lower(root.get("username")), like),
                                        cb.like(cb.lower(root.get("type").as(String.class)), like),
                                        cb.like(cb.lower(root.get("clientId")), like),
                                        cb.like(cb.lower(root.get("ipAddress")), like)));
            }
            if (type != null) {
                predicate = cb.and(predicate, cb.equal(root.get("type"), type));
            }
            if (username != null && !username.isBlank()) {
                predicate = cb.and(predicate, cb.equal(root.get("username"), username));
            }
            if (clientId != null && !clientId.isBlank()) {
                predicate = cb.and(predicate, cb.equal(root.get("clientId"), clientId));
            }
            if (ipAddress != null && !ipAddress.isBlank()) {
                predicate = cb.and(predicate, cb.equal(root.get("ipAddress"), ipAddress));
            }
            if (from != null) {
                predicate =
                        cb.and(predicate, cb.greaterThanOrEqualTo(root.get("occurredAt"), from));
            }
            if (to != null) {
                predicate = cb.and(predicate, cb.lessThanOrEqualTo(root.get("occurredAt"), to));
            }
            return predicate;
        };
    }
}
