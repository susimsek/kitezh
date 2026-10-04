package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.domain.OfflineAccessPolicyEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOfflineAccessPolicyRequestDTO;
import io.github.susimsek.kitezh.repository.OfflineAccessPolicyRepository;
import io.github.susimsek.kitezh.security.OfflineAccessSettings;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;

@ExtendWith(MockitoExtension.class)
class OfflineAccessPolicyServiceTest {

    @Mock private OfflineAccessPolicyRepository repository;
    @Mock private AdminAuditEventService auditEventService;

    @Test
    void usesApplicationDefaultsWhenPolicyIsMissing() {
        when(repository.findById(1L)).thenReturn(Optional.empty());

        var result = service().get();

        assertThat(result.idleTimeout()).isEqualTo(Duration.ofDays(30));
        assertThat(result.maxLifespan()).isNull();
        assertThat(result.maxLimited()).isFalse();
    }

    @Test
    void updatesAndAuditsPolicy() {
        OfflineAccessPolicyEntity policy = policy();
        when(repository.findById(1L)).thenReturn(Optional.of(policy));

        var result =
                service()
                        .update(
                                new AdminOfflineAccessPolicyRequestDTO(
                                        Duration.ofDays(7), Duration.ofDays(90), true));

        assertThat(result.idleTimeout()).isEqualTo(Duration.ofDays(7));
        assertThat(result.maxLifespan()).isEqualTo(Duration.ofDays(90));
        assertThat(result.maxLimited()).isTrue();
        verify(repository).save(policy);
        verify(auditEventService)
                .record("offline-access.policy.updated", "offline-access-policy", "default");
    }

    @Test
    void rejectsMaximumShorterThanIdleTimeout() {
        OfflineAccessPolicyService target = service();
        AdminOfflineAccessPolicyRequestDTO request =
                new AdminOfflineAccessPolicyRequestDTO(
                        Duration.ofDays(7), Duration.ofDays(6), true);
        assertThatThrownBy(() -> target.update(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("maxLifespan must be greater than or equal to idleTimeout");
    }

    @Test
    void revokesAllAndAuditsPolicy() {
        OfflineAccessPolicyEntity policy = policy();
        when(repository.findById(1L)).thenReturn(Optional.of(policy));

        var result = service().revokeAll();

        assertThat(result.revokedBefore()).isNotNull();
        verify(repository).save(policy);
        verify(auditEventService)
                .record("offline-access.tokens.revoked", "offline-access-policy", "default");
    }

    @Test
    void appliesClientOverridesAndFallbacks() {
        OfflineAccessPolicyEntity policy = policy();
        policy.setMaxLimited(true);
        policy.setMaxLifespanSeconds(Duration.ofDays(180).toSeconds());
        when(repository.findById(1L)).thenReturn(Optional.of(policy));

        assertThat(
                        service()
                                .idleTimeout(
                                        client(
                                                Map.of(
                                                        OfflineAccessSettings.OFFLINE_SESSION_IDLE,
                                                        "P2D"))))
                .isEqualTo(Duration.ofDays(2));
        assertThat(
                        service()
                                .idleTimeout(
                                        client(
                                                Map.of(
                                                        OfflineAccessSettings.OFFLINE_SESSION_IDLE,
                                                        "invalid"))))
                .isEqualTo(Duration.ofDays(30));
        assertThat(
                        service()
                                .maxLifespan(
                                        client(
                                                Map.of(
                                                        OfflineAccessSettings.OFFLINE_SESSION_MAX,
                                                        "P365D"))))
                .isEqualTo(Duration.ofDays(365));
        assertThat(
                        service()
                                .maxLifespan(
                                        client(
                                                Map.of(
                                                        OfflineAccessSettings.OFFLINE_SESSION_MAX,
                                                        "invalid"))))
                .isEqualTo(Duration.ofDays(180));
    }

    @Test
    void handlesDisabledMaximumAndRevocationBoundary() {
        OfflineAccessPolicyEntity policy = policy();
        policy.setRevokedBefore(Instant.parse("2026-01-02T00:00:00Z"));
        when(repository.findById(1L)).thenReturn(Optional.of(policy));

        assertThat(service().maxLifespan(client(Map.of()))).isNull();
        assertThat(service().revoked(Instant.parse("2026-01-01T00:00:00Z"))).isTrue();
        assertThat(service().revoked(Instant.parse("2026-01-02T00:00:00Z"))).isFalse();
        assertThat(service().revoked(null)).isFalse();
    }

    private OfflineAccessPolicyService service() {
        return new OfflineAccessPolicyService(
                repository, new ApplicationProperties(), auditEventService);
    }

    private static OfflineAccessPolicyEntity policy() {
        OfflineAccessPolicyEntity policy = new OfflineAccessPolicyEntity();
        policy.setId(1L);
        policy.setIdleTimeoutSeconds(Duration.ofDays(30).toSeconds());
        policy.setMaxLimited(false);
        return policy;
    }

    private static RegisteredClient client(Map<String, Object> settings) {
        TokenSettings tokenSettings =
                settings.isEmpty()
                        ? TokenSettings.builder().build()
                        : TokenSettings.withSettings(settings).build();
        return RegisteredClient.withId("client-id")
                .clientId("client")
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .tokenSettings(tokenSettings)
                .build();
    }
}
