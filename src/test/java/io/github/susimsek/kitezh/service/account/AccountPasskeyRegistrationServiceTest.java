package io.github.susimsek.kitezh.service.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.security.SecurityJsonMapper;
import io.github.susimsek.kitezh.domain.AccountPasskeyRegistrationChallengeEntity;
import io.github.susimsek.kitezh.dto.account.MobilePasskeyRegistrationRequestDTO;
import io.github.susimsek.kitezh.repository.AccountPasskeyRegistrationChallengeRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.webauthn.api.PublicKeyCredential;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialCreationOptions;
import org.springframework.security.web.webauthn.management.RelyingPartyRegistrationRequest;
import org.springframework.security.web.webauthn.management.WebAuthnRelyingPartyOperations;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

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

    @Test
    void rejectsMissingChallengeBeforeInspectingAttestation() {
        when(repository.findByIdForUpdate("missing")).thenReturn(null);

        assertThatThrownBy(
                        () ->
                                service.complete(
                                        UsernamePasswordAuthenticationToken.authenticated(
                                                "alice", null, java.util.List.of()),
                                        "missing",
                                        null))
                .isInstanceOf(ApiException.class);

        verify(relyingParty, never()).registerCredential(any());
    }

    @Test
    void createsOptionsAndConsumesTheChallengeAfterSuccessfulEnrollment() throws IOException {
        PublicKeyCredentialCreationOptions options = mock(PublicKeyCredentialCreationOptions.class);
        PublicKeyCredential<?> credential = mock(PublicKeyCredential.class);
        JsonMapper delegate = mock(JsonMapper.class);
        SecurityJsonMapper mapper = mock(SecurityJsonMapper.class);
        AccountPasskeyRegistrationService enrollmentService =
                serviceWithMapper(mapper, delegate, options, credential);
        Authentication authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        "alice", null, java.util.List.of());
        when(relyingParty.createPublicKeyCredentialCreationOptions(any())).thenReturn(options);
        when(mapper.toWebauthnMap(options)).thenReturn(Map.of("challenge", "server-challenge"));

        var response = enrollmentService.begin(authentication);
        ArgumentCaptor<AccountPasskeyRegistrationChallengeEntity> challengeCaptor =
                ArgumentCaptor.forClass(AccountPasskeyRegistrationChallengeEntity.class);
        verify(repository).deleteExpired(any(Instant.class));
        verify(repository).save(challengeCaptor.capture());
        AccountPasskeyRegistrationChallengeEntity challenge = challengeCaptor.getValue();

        assertThat(response.publicKey()).containsEntry("challenge", "server-challenge");
        assertThat(response.challengeId()).isEqualTo(challenge.getId());
        assertThat(challenge.getExpiresAt()).isAfter(Instant.now().plusSeconds(250));
        when(repository.findByIdForUpdate(challenge.getId())).thenReturn(challenge);

        enrollmentService.complete(
                authentication,
                challenge.getId(),
                new MobilePasskeyRegistrationRequestDTO(
                        Map.of("id", "credential-id"), "  My phone  "));

        verify(relyingParty).registerCredential(any(RelyingPartyRegistrationRequest.class));
        verify(repository).delete(challenge);
        verify(auditEventService).record("account.passkey.registered", "account", "alice");
    }

    @Test
    void rejectsUnusableStoredOptionsAndMalformedCredentialProofs() throws Exception {
        PublicKeyCredentialCreationOptions options = mock(PublicKeyCredentialCreationOptions.class);
        PublicKeyCredential<?> credential = mock(PublicKeyCredential.class);
        JsonMapper delegate = mock(JsonMapper.class);
        SecurityJsonMapper mapper = mock(SecurityJsonMapper.class);
        AccountPasskeyRegistrationService enrollmentService =
                serviceWithMapper(mapper, delegate, options, credential);
        var challenge = challenge("alice", Instant.now().plusSeconds(60));
        when(repository.findByIdForUpdate("challenge-1")).thenReturn(challenge);
        doThrow(new IOException("invalid stored options"))
                .when(mapper)
                .readSessionAttribute(any(InputStream.class));

        assertThatThrownBy(
                        () ->
                                enrollmentService.complete(
                                        UsernamePasswordAuthenticationToken.authenticated(
                                                "alice", null, java.util.List.of()),
                                        "challenge-1",
                                        new MobilePasskeyRegistrationRequestDTO(
                                                Map.of("id", "credential-id"), "Phone")))
                .isInstanceOf(ApiException.class);

        doReturn(options).when(mapper).readSessionAttribute(any(InputStream.class));
        when(mapper.delegate()).thenReturn(delegate);
        when(delegate.convertValue(any(), any(TypeReference.class)))
                .thenThrow(new IllegalArgumentException("invalid credential"));
        assertThatThrownBy(
                        () ->
                                enrollmentService.complete(
                                        UsernamePasswordAuthenticationToken.authenticated(
                                                "alice", null, java.util.List.of()),
                                        "challenge-1",
                                        new MobilePasskeyRegistrationRequestDTO(
                                                Map.of("id", "credential-id"), "Phone")))
                .isInstanceOf(ApiException.class);
        verify(relyingParty, never()).registerCredential(any());
    }

    @Test
    void rejectsInvalidBase64AndNonCredentialStoredOptions() throws Exception {
        PublicKeyCredentialCreationOptions options = mock(PublicKeyCredentialCreationOptions.class);
        PublicKeyCredential<?> credential = mock(PublicKeyCredential.class);
        JsonMapper delegate = mock(JsonMapper.class);
        SecurityJsonMapper mapper = mock(SecurityJsonMapper.class);
        AccountPasskeyRegistrationService enrollmentService =
                serviceWithMapper(mapper, delegate, options, credential);
        Authentication authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        "alice", null, java.util.List.of());
        var challenge = challenge("alice", Instant.now().plusSeconds(60));
        when(repository.findByIdForUpdate("challenge-1")).thenReturn(challenge);
        challenge.setOptions("!");

        assertThatThrownBy(
                        () ->
                                enrollmentService.complete(
                                        authentication,
                                        "challenge-1",
                                        new MobilePasskeyRegistrationRequestDTO(
                                                Map.of("id", "credential-id"), "Phone")))
                .isInstanceOf(ApiException.class);

        challenge.setOptions("unused");
        when(mapper.readSessionAttribute(any(InputStream.class))).thenReturn(Map.of());
        assertThatThrownBy(
                        () ->
                                enrollmentService.complete(
                                        authentication,
                                        "challenge-1",
                                        new MobilePasskeyRegistrationRequestDTO(
                                                Map.of("id", "credential-id"), "Phone")))
                .isInstanceOf(ApiException.class);
        verify(relyingParty, never()).registerCredential(any());
    }

    @Test
    void preservesChallengeWhenTheWebauthnProviderRejectsTheProof() throws IOException {
        PublicKeyCredentialCreationOptions options = mock(PublicKeyCredentialCreationOptions.class);
        PublicKeyCredential<?> credential = mock(PublicKeyCredential.class);
        JsonMapper delegate = mock(JsonMapper.class);
        SecurityJsonMapper mapper = mock(SecurityJsonMapper.class);
        AccountPasskeyRegistrationService enrollmentService =
                serviceWithMapper(mapper, delegate, options, credential);
        var challenge = challenge("alice", Instant.now().plusSeconds(60));
        when(repository.findByIdForUpdate("challenge-1")).thenReturn(challenge);
        when(mapper.readSessionAttribute(any(InputStream.class))).thenReturn(options);
        when(mapper.delegate()).thenReturn(delegate);
        when(delegate.convertValue(any(), any(TypeReference.class))).thenReturn(credential);
        doThrow(new IllegalArgumentException("provider rejected attestation"))
                .when(relyingParty)
                .registerCredential(any());

        assertThatThrownBy(
                        () ->
                                enrollmentService.complete(
                                        UsernamePasswordAuthenticationToken.authenticated(
                                                "alice", null, java.util.List.of()),
                                        "challenge-1",
                                        new MobilePasskeyRegistrationRequestDTO(
                                                Map.of("id", "credential-id"), "Phone")))
                .isInstanceOf(ApiException.class);

        verify(repository, never()).delete(challenge);
        verify(auditEventService, never()).record(any(), any(), any());
    }

    private AccountPasskeyRegistrationService serviceWithMapper(
            SecurityJsonMapper mapper,
            JsonMapper delegate,
            PublicKeyCredentialCreationOptions options,
            PublicKeyCredential<?> credential)
            throws IOException {
        doAnswer(
                        invocation -> {
                            OutputStream stream = invocation.getArgument(1);
                            stream.write(
                                    "stored-options"
                                            .getBytes(java.nio.charset.StandardCharsets.UTF_8));
                            return null;
                        })
                .when(mapper)
                .writeSessionAttribute(
                        org.mockito.ArgumentMatchers.same(options), any(OutputStream.class));
        when(mapper.readSessionAttribute(any(InputStream.class))).thenReturn(options);
        when(mapper.delegate()).thenReturn(delegate);
        when(delegate.convertValue(any(), any(TypeReference.class))).thenReturn(credential);
        return new AccountPasskeyRegistrationService(
                repository, relyingParty, mapper, auditEventService);
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
