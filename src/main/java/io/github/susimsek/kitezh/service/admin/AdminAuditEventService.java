package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.AdminEventEntity;
import io.github.susimsek.kitezh.dto.admin.AdminEventDTO;
import io.github.susimsek.kitezh.mapper.AdminEventMapper;
import io.github.susimsek.kitezh.repository.AdminEventRepository;
import io.github.susimsek.kitezh.repository.AdminEventSettingsRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.security.Principal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.mapstruct.factory.Mappers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
@RequiredArgsConstructor(onConstructor_ = @org.springframework.beans.factory.annotation.Autowired)
@SuppressWarnings({"java:S107", "java:S6213", "java:S6829"})
public class AdminAuditEventService {

    private static final int MAX_DETAILS_LENGTH = 2_000;
    private static final java.util.regex.Pattern SENSITIVE_DETAIL_VALUE =
            java.util.regex.Pattern.compile(
                    "(?i)(\\\"[^\\\"]*(?:password|secret|token|authorization|credential)[^\\\"]*\\\"\\s*:\\s*\\\")[^\\\"]*(\\\")");

    private final AdminEventRepository adminEventRepository;
    private final AdminEventMapper adminEventMapper;
    private final AdminEventSettingsRepository settingsRepository;
    private EventListenerDeliveryService eventListenerDeliveryService;

    @Autowired(required = false)
    void setEventListenerDeliveryService(EventListenerDeliveryService service) {
        this.eventListenerDeliveryService = service;
    }

    public AdminAuditEventService(
            AdminEventRepository adminEventRepository,
            AdminEventSettingsRepository settingsRepository) {
        this(adminEventRepository, Mappers.getMapper(AdminEventMapper.class), settingsRepository);
    }

    public AdminAuditEventService(AdminEventRepository adminEventRepository) {
        this(adminEventRepository, Mappers.getMapper(AdminEventMapper.class), null);
    }

    @Transactional
    public void record(String action, String targetType, String targetId) {
        recordInternal(action, targetType, targetId, null, currentActor());
    }

    @Transactional
    public void record(String action, String targetType, String targetId, String details) {
        recordInternal(action, targetType, targetId, details, currentActor());
    }

    @Transactional
    public void recordAs(
            String actor, String action, String targetType, String targetId, String details) {
        recordInternal(action, targetType, targetId, details, actor);
    }

    private void recordInternal(
            String action, String targetType, String targetId, String details, String actor) {
        if (settingsRepository != null) {
            var settings =
                    settingsRepository
                            .findById(1L)
                            .orElseThrow(
                                    () ->
                                            new IllegalStateException(
                                                    "Event settings are not initialized"));
            if (!settings.isEventsEnabled() || !settings.isAdminEventsEnabled()) {
                return;
            }
            if (settings.getEventsExpirationDays() > 0) {
                adminEventRepository.deleteByOccurredAtBefore(
                        Instant.now().minus(settings.getEventsExpirationDays(), ChronoUnit.DAYS));
            }
            if (!settings.isAdminEventsDetailsEnabled()) {
                details = null;
            }
        }
        details = sanitizeDetails(details);
        String eventId = UUID.randomUUID().toString();
        adminEventRepository.save(
                adminEventMapper.toEntity(
                        eventId,
                        actor,
                        currentClientId(),
                        currentIpAddress(),
                        action,
                        targetType,
                        targetId,
                        details,
                        Instant.now()));
        if (eventListenerDeliveryService != null) {
            eventListenerDeliveryService.dispatch(
                    io.github.susimsek.kitezh.domain.EventListenerEventType
                            .ADMIN_EVENT,
                    eventId,
                    Map.of(
                            "action",
                            action,
                            "targetType",
                            targetType,
                            "targetId",
                            targetId,
                            "actor",
                            actor,
                            "clientId",
                            currentClientId() == null ? "" : currentClientId(),
                            "ipAddress",
                            currentIpAddress() == null ? "" : currentIpAddress()));
        }
    }

    private static String currentActor() {
        return java.util.Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
                .filter(Authentication::isAuthenticated)
                .map(Principal::getName)
                .orElse("system");
    }

    static String sanitizeDetails(String details) {
        if (details == null || details.isBlank()) {
            return details;
        }
        String redacted = SENSITIVE_DETAIL_VALUE.matcher(details).replaceAll("$1[REDACTED]$2");
        return redacted.length() <= MAX_DETAILS_LENGTH
                ? redacted
                : redacted.substring(0, MAX_DETAILS_LENGTH);
    }

    @Transactional
    public void deleteAll() {
        adminEventRepository.deleteAllInBatch();
        recordInternal("events.cleared", "event", "all", null, currentActor());
    }

    public Page<AdminEventDTO> events(
            String q,
            String action,
            String targetType,
            String targetId,
            String actorFilter,
            String clientId,
            String ipAddress,
            Instant from,
            Instant to,
            Pageable pageable) {
        String search = q == null ? "" : q.trim().toLowerCase();
        return adminEventRepository
                .findAll(
                        eventSpecification(
                                search,
                                action,
                                targetType,
                                targetId,
                                actorFilter,
                                clientId,
                                ipAddress,
                                from,
                                to),
                        pageable)
                .map(adminEventMapper::toDTO);
    }

    public Page<AdminEventDTO> events(
            String q,
            String action,
            String targetType,
            String targetId,
            Instant from,
            Instant to,
            Pageable pageable) {
        return events(q, action, targetType, targetId, "", "", "", from, to, pageable);
    }

    @Transactional(readOnly = true)
    public AdminEventDTO event(String id) {
        return adminEventRepository
                .findById(id)
                .map(adminEventMapper::toDTO)
                .orElseThrow(() -> ApiException.notFound("Administrative event not found"));
    }

    private static Specification<AdminEventEntity> eventSpecification(
            String search,
            String action,
            String targetType,
            String targetId,
            String actorFilter,
            String clientId,
            String ipAddress,
            Instant from,
            Instant to) {
        return (root, query, cb) -> {
            var predicate = cb.conjunction();
            if (!search.isBlank()) {
                String like = "%" + search + "%";
                predicate =
                        cb.and(
                                predicate,
                                cb.or(
                                        cb.like(cb.lower(root.get("actor")), like),
                                        cb.like(cb.lower(root.get("action")), like),
                                        cb.like(cb.lower(root.get("targetType")), like),
                                        cb.like(cb.lower(root.get("targetId")), like)));
            }
            return addFilters(
                    predicate,
                    root,
                    cb,
                    action,
                    targetType,
                    targetId,
                    actorFilter,
                    clientId,
                    ipAddress,
                    from,
                    to);
        };
    }

    private static jakarta.persistence.criteria.Predicate addFilters(
            jakarta.persistence.criteria.Predicate predicate,
            jakarta.persistence.criteria.Root<AdminEventEntity> root,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            String action,
            String targetType,
            String targetId,
            String actorFilter,
            String clientId,
            String ipAddress,
            Instant from,
            Instant to) {
        if (action != null && !action.isBlank()) {
            predicate = cb.and(predicate, cb.equal(root.get("action"), action));
        }
        if (targetType != null && !targetType.isBlank()) {
            predicate = cb.and(predicate, cb.equal(root.get("targetType"), targetType));
        }
        if (targetId != null && !targetId.isBlank()) {
            predicate = cb.and(predicate, cb.equal(root.get("targetId"), targetId));
        }
        if (actorFilter != null && !actorFilter.isBlank()) {
            predicate = cb.and(predicate, cb.equal(root.get("actor"), actorFilter));
        }
        if (clientId != null && !clientId.isBlank()) {
            predicate = cb.and(predicate, cb.equal(root.get("clientId"), clientId));
        }
        if (ipAddress != null && !ipAddress.isBlank()) {
            predicate = cb.and(predicate, cb.equal(root.get("ipAddress"), ipAddress));
        }
        if (from != null) {
            predicate = cb.and(predicate, cb.greaterThanOrEqualTo(root.get("occurredAt"), from));
        }
        if (to != null) {
            predicate = cb.and(predicate, cb.lessThanOrEqualTo(root.get("occurredAt"), to));
        }
        return predicate;
    }

    public Page<AdminEventDTO> userEvents(Long userId, Pageable pageable) {
        return adminEventRepository
                .findByTargetTypeAndTargetId("user", userId.toString(), pageable)
                .map(adminEventMapper::toDTO);
    }

    public Page<AdminEventDTO> clientEvents(String clientId, Pageable pageable) {
        return adminEventRepository
                .findByTargetTypeAndTargetId("client", clientId, pageable)
                .map(adminEventMapper::toDTO);
    }

    private static String currentClientId() {
        if (RequestContextHolder.getRequestAttributes()
                instanceof ServletRequestAttributes attributes) {
            return attributes.getRequest().getParameter("client_id");
        }
        return null;
    }

    private static String currentIpAddress() {
        if (RequestContextHolder.getRequestAttributes()
                instanceof ServletRequestAttributes attributes) {
            return attributes.getRequest().getRemoteAddr();
        }
        return null;
    }

    @Transactional
    public void avatarUpdated(Long userId) {
        recordInternal("user.avatar.updated", "user", userId.toString(), null, currentActor());
    }

    @Transactional
    public void avatarDeleted(Long userId) {
        recordInternal("user.avatar.deleted", "user", userId.toString(), null, currentActor());
    }
}
