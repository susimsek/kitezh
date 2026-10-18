package io.github.susimsek.kitezh.service.account;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.security.SecurityJsonMapper;
import io.github.susimsek.kitezh.domain.AccountPasskeyRegistrationChallengeEntity;
import io.github.susimsek.kitezh.repository.AccountPasskeyRegistrationChallengeRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.web.webauthn.management.WebAuthnRelyingPartyOperations;

class AccountPasskeyRegistrationServiceTest {

    private final AccountPasskeyRegistrationChallengeRepository repository =
            mock(AccountPasskeyRegistrationChallengeRepository.class);
    private final WebAuthnRelyingPartyOperations relyingParty =
            mock(WebAuthnRelyingPartyOperations.class);
    private final SecurityJsonMapper jsonMapper = mock(SecurityJsonMapper.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private final AccountPasskeyRegistrationService service =
            new AccountPasskeyRegistrationService(
                    repository, relyingParty, jsonMapper, auditEventService);

    @Test
    void rejectsChallengeOwnedByAnotherAccountBeforeInspectingAttestation() {
        var challenge = challenge("alice", Instant.now().plusSeconds(60));
        when(repository.findByIdForUpdate("challenge-1")).thenReturn(challenge);

        assertThatThrownBy(
                        () ->
                                service.complete(
                                        UsernamePasswordAuthenticationToken.authenticated(
                                                "bob", null, java.util.List.of()),
                                        "challenge-1",
                                        null))
                .isInstanceOf(ApiException.class);

        verify(relyingParty, never()).registerCredential(org.mockito.ArgumentMatchers.any());
        verify(repository, never()).delete(challenge);
    }

    @Test
    void rejectsExpiredChallengeBeforeInspectingAttestation() {
        var challenge = challenge("alice", Instant.now().minusSeconds(1));
        when(repository.findByIdForUpdate("challenge-1")).thenReturn(challenge);

        assertThatThrownBy(
                        () ->
                                service.complete(
                                        UsernamePasswordAuthenticationToken.authenticated(
                                                "alice", null, java.util.List.of()),
                                        "challenge-1",
                                        null))
                .isInstanceOf(ApiException.class);

        verify(relyingParty, never()).registerCredential(org.mockito.ArgumentMatchers.any());
        verify(repository, never()).delete(challenge);
    }

    private static AccountPasskeyRegistrationChallengeEntity challenge(
            String username, Instant expiresAt) {
        var challenge = new AccountPasskeyRegistrationChallengeEntity();
        challenge.setId("challenge-1");
        challenge.setUsername(username);
        challenge.setOptions("unused");
        challenge.setExpiresAt(expiresAt);
        return challenge;
    }
}
