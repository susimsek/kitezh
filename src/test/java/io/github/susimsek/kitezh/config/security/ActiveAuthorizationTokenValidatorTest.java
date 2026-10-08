package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.service.AuthorizationRevocationPolicyService;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

@ExtendWith(MockitoExtension.class)
class ActiveAuthorizationTokenValidatorTest {

    @Mock private AuthorizationRepository authorizationRepository;
    @Mock private AuthorizationRevocationPolicyService revocationPolicyService;

    @Test
    void acceptsAnAccessTokenWithAnActiveAuthorization() {
        when(authorizationRepository.existsByAccessTokenValue("access-token")).thenReturn(true);
        when(revocationPolicyService.isRevoked(any(Jwt.class))).thenReturn(false);

        assertThat(validator().validate(token()).hasErrors()).isFalse();
    }

    @Test
    void rejectsAnAccessTokenAfterItsAuthorizationIsRemoved() {
        when(authorizationRepository.existsByAccessTokenValue("access-token")).thenReturn(false);

        assertThat(validator().validate(token()).hasErrors()).isTrue();
    }

    @Test
    void rejectsAnAccessTokenAfterItsRevocationPolicyIsApplied() {
        when(authorizationRepository.existsByAccessTokenValue("access-token")).thenReturn(true);
        when(revocationPolicyService.isRevoked(any(Jwt.class))).thenReturn(true);

        assertThat(validator().validate(token()).hasErrors()).isTrue();
    }

    private ActiveAuthorizationTokenValidator validator() {
        return new ActiveAuthorizationTokenValidator(
                authorizationRepository, revocationPolicyService);
    }

    private static Jwt token() {
        Instant now = Instant.now();
        return Jwt.withTokenValue("access-token")
                .header("alg", "RS256")
                .subject("admin")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .build();
    }
}
