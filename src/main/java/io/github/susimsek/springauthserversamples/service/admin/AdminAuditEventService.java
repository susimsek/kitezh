package io.github.susimsek.springauthserversamples.service.admin;

import io.github.susimsek.springauthserversamples.domain.AdminEventEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminEventDTO;
import io.github.susimsek.springauthserversamples.mapper.AdminEventMapper;
import io.github.susimsek.springauthserversamples.repository.AdminEventRepository;
import io.github.susimsek.springauthserversamples.repository.AdminEventSettingsRepository;
import java.security.Principal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@SuppressWarnings({"java:S107", "java:S6213", "java:S6829"})
public class AdminAuditEventService {

    private final AdminEventRepository adminEventRepository;
    private final AdminEventMapper adminEventMapper;
    private final AdminEventSettingsRepository settingsRepository;

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
        adminEventRepository.save(
                adminEventMapper.toEntity(
                        UUID.randomUUID().toString(),
                        actor,
                        action,
                        targetType,
                        targetId,
                        details,
                        Instant.now()));
    }

    private static String currentActor() {
        return java.util.Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
                .filter(Authentication::isAuthenticated)
                .map(Principal::getName)
                .orElse("system");
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
            Instant from,
            Instant to,
            Pageable pageable) {
        String search = q == null ? "" : q.trim().toLowerCase();
        return adminEventRepository
                .findAll(
                        eventSpecification(search, action, targetType, targetId, from, to),
                        pageable)
                .map(adminEventMapper::toDTO);
    }

    private static Specification<AdminEventEntity> eventSpecification(
            String search,
            String action,
            String targetType,
            String targetId,
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
            return addFilters(predicate, root, cb, action, targetType, targetId, from, to);
        };
    }

    private static jakarta.persistence.criteria.Predicate addFilters(
            jakarta.persistence.criteria.Predicate predicate,
            jakarta.persistence.criteria.Root<AdminEventEntity> root,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            String action,
            String targetType,
            String targetId,
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

    @Transactional
    public void avatarUpdated(Long userId) {
        recordInternal("user.avatar.updated", "user", userId.toString(), null, currentActor());
    }

    @Transactional
    public void avatarDeleted(Long userId) {
        recordInternal("user.avatar.deleted", "user", userId.toString(), null, currentActor());
    }
}
