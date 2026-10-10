package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthorizationRevocationPolicyEntity;
import io.github.susimsek.kitezh.repository.AuthorizationRevocationPolicyRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

@ExtendWith(MockitoExtension.class)
class AuthorizationRevocationPolicyServiceTest {

    @Mock private AuthorizationRevocationPolicyRepository repository;

    @Test
    void createsAndUpdatesApplicationUserAndClientPolicies() {
        when(repository.findById(any())).thenReturn(Optional.empty());
        AuthorizationRevocationPolicyService service =
                new AuthorizationRevocationPolicyService(repository);

        service.revokeApplication();
        service.revokeUser("alice");
        service.revokeClient("admin-console");

        ArgumentCaptor<AuthorizationRevocationPolicyEntity> captor =
                ArgumentCaptor.forClass(AuthorizationRevocationPolicyEntity.class);
        verify(repository, org.mockito.Mockito.times(3)).save(captor.capture());
        assertThat(captor.getAllValues())
                .extracting(AuthorizationRevocationPolicyEntity::getId)
                .containsExactly("application:default", "user:alice", "client:admin-console");
    }

    @Test
    void appliesApplicationUserAndClientPoliciesToJwtIssuedBeforeTheCutoff() {
        Instant issuedAt = Instant.parse("2026-01-01T00:00:00Z");
        when(repository.findAllById(
                        List.of("application:default", "user:alice", "client:admin-console")))
                .thenReturn(
                        List.of(
                                new AuthorizationRevocationPolicyEntity(
                                        "user:alice",
                                        AuthorizationRevocationPolicyService.USER_SCOPE,
                                        "alice",
                                        issuedAt.plusSeconds(1))));

        Jwt token =
                Jwt.withTokenValue("token")
                        .header("alg", "none")
                        .subject("alice")
                        .claim("client_id", "admin-console")
                        .issuedAt(issuedAt)
                        .expiresAt(issuedAt.plusSeconds(300))
                        .build();

        assertThat(new AuthorizationRevocationPolicyService(repository).isRevoked(token)).isTrue();
    }

    @Test
    void doesNotRevokeTokensWithoutAnIssuedAtOrAtTheCutoff() {
        AuthorizationRevocationPolicyService service =
                new AuthorizationRevocationPolicyService(repository);

        assertThat(service.isRevoked("alice", "admin-console", null)).isFalse();
        assertThat(service.isRevoked("alice", "admin-console", Instant.EPOCH)).isFalse();
    }
}
