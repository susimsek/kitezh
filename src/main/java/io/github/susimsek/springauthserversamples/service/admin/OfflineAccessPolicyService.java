package io.github.susimsek.springauthserversamples.service.admin;

import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.domain.OfflineAccessPolicyEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminOfflineAccessPolicyDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminOfflineAccessPolicyRequestDTO;
import io.github.susimsek.springauthserversamples.repository.OfflineAccessPolicyRepository;
import io.github.susimsek.springauthserversamples.security.OfflineAccessSettings;
import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OfflineAccessPolicyService {

    private static final long POLICY_ID = 1L;

    private final OfflineAccessPolicyRepository repository;
    private final ApplicationProperties applicationProperties;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public AdminOfflineAccessPolicyDTO get() {
        return toDto(entity());
    }

    @Transactional
    @CacheEvict(
            cacheNames = OfflineAccessPolicyRepository.OFFLINE_ACCESS_POLICY_BY_ID_CACHE,
            allEntries = true)
    public AdminOfflineAccessPolicyDTO update(AdminOfflineAccessPolicyRequestDTO request) {
        validate(request.idleTimeout(), request.maxLifespan(), request.maxLimited());
        OfflineAccessPolicyEntity policy = entity();
        policy.setIdleTimeoutSeconds(request.idleTimeout().toSeconds());
        policy.setMaxLifespanSeconds(
                request.maxLifespan() == null ? null : request.maxLifespan().toSeconds());
        policy.setMaxLimited(request.maxLimited());
        repository.save(policy);
        auditEventService.record(
                "offline-access.policy.updated", "offline-access-policy", "default");
        return toDto(policy);
    }

    @Transactional
    @CacheEvict(
            cacheNames = OfflineAccessPolicyRepository.OFFLINE_ACCESS_POLICY_BY_ID_CACHE,
            allEntries = true)
    public AdminOfflineAccessPolicyDTO revokeAll() {
        OfflineAccessPolicyEntity policy = entity();
        policy.setRevokedBefore(Instant.now());
        repository.save(policy);
        auditEventService.record(
                "offline-access.tokens.revoked", "offline-access-policy", "default");
        return toDto(policy);
    }

    @Transactional(readOnly = true)
    public Duration idleTimeout(RegisteredClient client) {
        Object override =
                client.getTokenSettings()
                        .getSettings()
                        .get(OfflineAccessSettings.OFFLINE_SESSION_IDLE);
        return duration(override, Duration.ofSeconds(entity().getIdleTimeoutSeconds()));
    }

    @Transactional(readOnly = true)
    public Duration maxLifespan(RegisteredClient client) {
        if (!entity().isMaxLimited()) {
            return null;
        }
        Object override =
                client.getTokenSettings()
                        .getSettings()
                        .get(OfflineAccessSettings.OFFLINE_SESSION_MAX);
        return duration(override, seconds(entity().getMaxLifespanSeconds()));
    }

    @Transactional(readOnly = true)
    public boolean revoked(Instant startedAt) {
        Instant revokedBefore = entity().getRevokedBefore();
        return revokedBefore != null && startedAt != null && startedAt.isBefore(revokedBefore);
    }

    private OfflineAccessPolicyEntity entity() {
        return repository.findById(POLICY_ID).orElseGet(this::fallbackEntity);
    }

    private OfflineAccessPolicyEntity fallbackEntity() {
        OfflineAccessPolicyEntity fallback = new OfflineAccessPolicyEntity();
        fallback.setId(POLICY_ID);
        fallback.setIdleTimeoutSeconds(
                applicationProperties.authorizationServer().offlineSessionIdle().toSeconds());
        fallback.setMaxLimited(false);
        return fallback;
    }

    private static void validate(Duration idle, Duration max, boolean maxLimited) {
        if (maxLimited && (max == null || max.compareTo(idle) < 0)) {
            throw new IllegalArgumentException(
                    "maxLifespan must be greater than or equal to idleTimeout");
        }
    }

    private static Duration duration(Object value, Duration fallback) {
        if (value instanceof String string) {
            try {
                return Duration.parse(string);
            } catch (RuntimeException _) {
                return fallback;
            }
        }
        return fallback;
    }

    private static Duration seconds(Long value) {
        return value == null ? null : Duration.ofSeconds(value);
    }

    private static AdminOfflineAccessPolicyDTO toDto(OfflineAccessPolicyEntity policy) {
        return new AdminOfflineAccessPolicyDTO(
                Duration.ofSeconds(policy.getIdleTimeoutSeconds()),
                seconds(policy.getMaxLifespanSeconds()),
                policy.isMaxLimited(),
                policy.getRevokedBefore());
    }
}
