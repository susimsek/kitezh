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
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
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
    private static final String CLIENT_ID = "clientId";
    private static final String IP_ADDRESS = "ipAddress";
    private static final String USERNAME = "username";

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
    public void recordEvent(UserEventType type, String username, String ipAddress) {
        recordInternal(type, username, null, ipAddress);
    }

    @Transactional
    public void recordEvent(
            UserEventType type, String username, String clientId, String ipAddress) {
        recordInternal(type, username, clientId, ipAddress);
    }

    private void recordInternal(
            UserEventType type, String username, String clientId, String ipAddress) {
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
                    io.github.susimsek.kitezh.domain.EventListenerEventType.USER_EVENT,
                    eventId,
                    Map.of(
                            "eventType",
                            type.name(),
                            USERNAME,
                            username,
                            CLIENT_ID,
                            clientId == null ? "" : clientId,
                            IP_ADDRESS,
                            ipAddress == null ? "" : ipAddress));
        }
    }

    @Transactional(readOnly = true)
    public Page<UserEventDTO> events(UserEventSearchCriteria criteria, Pageable pageable) {
        return repository
                .findAll(
                        eventSpecification(
                                AdminSearch.normalize(criteria.query()),
                                criteria.type(),
                                criteria.username(),
                                criteria.clientId(),
                                criteria.ipAddress(),
                                criteria.from(),
                                criteria.to()),
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
            predicate = addSearchPredicate(predicate, root, cb, query);
            predicate = addTypePredicate(predicate, root, cb, type);
            predicate = addEqualsPredicate(predicate, root, cb, USERNAME, username);
            predicate = addEqualsPredicate(predicate, root, cb, CLIENT_ID, clientId);
            predicate = addEqualsPredicate(predicate, root, cb, IP_ADDRESS, ipAddress);
            predicate = addFromPredicate(predicate, root, cb, from);
            return addToPredicate(predicate, root, cb, to);
        };
    }

    private static Predicate addSearchPredicate(
            Predicate predicate, Root<UserEventEntity> root, CriteriaBuilder cb, String query) {
        if (query.isBlank()) {
            return predicate;
        }
        String like = "%" + query.toLowerCase() + "%";
        return cb.and(
                predicate,
                cb.or(
                        cb.like(cb.lower(root.get(USERNAME)), like),
                        cb.like(cb.lower(root.get("type").as(String.class)), like),
                        cb.like(cb.lower(root.get(CLIENT_ID)), like),
                        cb.like(cb.lower(root.get(IP_ADDRESS)), like)));
    }

    private static Predicate addTypePredicate(
            Predicate predicate,
            Root<UserEventEntity> root,
            CriteriaBuilder cb,
            UserEventType type) {
        if (type == null) {
            return predicate;
        }
        return cb.and(predicate, cb.equal(root.get("type"), type));
    }

    private static Predicate addEqualsPredicate(
            Predicate predicate,
            Root<UserEventEntity> root,
            CriteriaBuilder cb,
            String property,
            String value) {
        if (value == null || value.isBlank()) {
            return predicate;
        }
        return cb.and(predicate, cb.equal(root.get(property), value));
    }

    private static Predicate addFromPredicate(
            Predicate predicate, Root<UserEventEntity> root, CriteriaBuilder cb, Instant from) {
        if (from == null) {
            return predicate;
        }
        return cb.and(predicate, cb.greaterThanOrEqualTo(root.get("occurredAt"), from));
    }

    private static Predicate addToPredicate(
            Predicate predicate, Root<UserEventEntity> root, CriteriaBuilder cb, Instant to) {
        if (to == null) {
            return predicate;
        }
        return cb.and(predicate, cb.lessThanOrEqualTo(root.get("occurredAt"), to));
    }
}
