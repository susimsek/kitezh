package io.github.susimsek.kitezh.service.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.security.WebAuthnUserEntityRepository;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.UserAccessInvalidationService;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.web.webauthn.api.Bytes;
import org.springframework.security.web.webauthn.api.CredentialRecord;
import org.springframework.security.web.webauthn.management.UserCredentialRepository;

@SuppressWarnings({"java:S5778", "java:S6213"})
class WebAuthnServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserCredentialRepository credentialRepository =
            mock(UserCredentialRepository.class);
    private final UserAccessInvalidationService invalidationService =
            mock(UserAccessInvalidationService.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);

    @Test
    void listsCredentialsNewestFirst() {
        UserEntity user = user();
        CredentialRecord first = mock(CredentialRecord.class);
        CredentialRecord second = mock(CredentialRecord.class);
        when(first.getCredentialId()).thenReturn(Bytes.random());
        when(second.getCredentialId()).thenReturn(Bytes.random());
        when(first.getCreated()).thenReturn(Instant.parse("2026-01-01T00:00:00Z"));
        when(second.getCreated()).thenReturn(Instant.parse("2026-01-02T00:00:00Z"));
        when(first.getLastUsed()).thenReturn(Instant.parse("2026-01-01T00:00:00Z"));
        when(second.getLastUsed()).thenReturn(Instant.parse("2026-01-02T00:00:00Z"));
        when(first.getTransports()).thenReturn(Set.of());
        when(second.getTransports()).thenReturn(Set.of());
        when(first.getLabel()).thenReturn("first");
        when(second.getLabel()).thenReturn("second");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(credentialRepository.findByUserId(WebAuthnUserEntityRepository.userHandle(7L)))
                .thenReturn(List.of(first, second));

        var result = service().credentials("alice", PageRequest.of(0, 20));

        assertThat(result.getContent()).hasSize(2);
        assertThat(result.getContent().get(0)).isNotNull();
    }

    @Test
    void deletesOnlyCredentialsOwnedByTheAccount() {
        UserEntity user = user();
        Bytes credentialId = Bytes.random();
        CredentialRecord record = mock(CredentialRecord.class);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(credentialRepository.findByCredentialId(credentialId)).thenReturn(record);
        when(record.getUserEntityUserId()).thenReturn(WebAuthnUserEntityRepository.userHandle(7L));

        service().delete("alice", credentialId.toBase64UrlString());

        verify(credentialRepository).delete(credentialId);
        verify(invalidationService).invalidate("alice");
        verify(auditEventService).record("account.passkey.deleted", "account", "7");
    }

    @Test
    void rejectsCredentialOwnedByAnotherAccount() {
        UserEntity user = user();
        CredentialRecord record = mock(CredentialRecord.class);
        Bytes credentialId = Bytes.random();
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(credentialRepository.findByCredentialId(credentialId)).thenReturn(record);
        when(record.getUserEntityUserId()).thenReturn(WebAuthnUserEntityRepository.userHandle(8L));

        assertThatThrownBy(() -> service().delete("alice", credentialId.toBase64UrlString()))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void readsCredentialByIdAndHandlesInvalidOrUnknownCredentials() {
        UserEntity user = user();
        Bytes credentialId = Bytes.random();
        CredentialRecord record =
                credential(credentialId, WebAuthnUserEntityRepository.userHandle(7L));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(credentialRepository.findByCredentialId(credentialId)).thenReturn(record);

        var result = service().credential("alice", credentialId.toBase64UrlString());

        assertThat(result.credentialId()).isEqualTo(credentialId.toBase64UrlString());
        assertThat(result.credentialType()).isEqualTo("public-key");
        assertThat(result.transports()).containsExactly("internal");

        assertThatThrownBy(() -> service().credential("alice", "not-base64"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Passkey not found");
        when(credentialRepository.findByCredentialId(credentialId)).thenReturn(null);
        assertThatThrownBy(() -> service().credential("alice", credentialId.toBase64UrlString()))
                .isInstanceOf(ApiException.class)
                .hasMessage("Passkey not found");
    }

    @Test
    void reportsCredentialPresenceAndMissingUsers() {
        UserEntity user = user();
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(credentialRepository.findByUserId(WebAuthnUserEntityRepository.userHandle(7L)))
                .thenReturn(List.of());
        assertThat(service().hasCredential("alice")).isFalse();
        when(credentialRepository.findByUserId(WebAuthnUserEntityRepository.userHandle(7L)))
                .thenReturn(List.of(mock(CredentialRecord.class)));
        assertThat(service().hasCredential("alice")).isTrue();
        when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().hasCredential("missing"))
                .isInstanceOf(ApiException.class)
                .hasMessage("User not found");
    }

    @Test
    void updatesLabelsAndSupportsAdministratorDeletion() {
        UserEntity user = user();
        Bytes credentialId = Bytes.random();
        CredentialRecord record =
                credential(credentialId, WebAuthnUserEntityRepository.userHandle(7L));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(credentialRepository.findByCredentialId(credentialId)).thenReturn(record);

        service().updateLabel("alice", credentialId.toBase64UrlString(), "Laptop", null);
        verify(credentialRepository).save(any(CredentialRecord.class));
        verify(auditEventService).record("account.passkey.renamed", "user", "7");

        service().updateLabel("alice", credentialId.toBase64UrlString(), "Admin laptop", "admin");
        verify(auditEventService).record("admin.passkey.renamed", "user", "7");
        service().deleteForAdministrator("alice", credentialId.toBase64UrlString(), "admin");
        verify(auditEventService).record("admin.passkey.deleted", "user", "7");
        verify(invalidationService, times(1)).invalidate("alice");
    }

    @Test
    void rejectsInvalidUpdatesAndDeletes() {
        UserEntity user = user();
        Bytes credentialId = Bytes.random();
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(credentialRepository.findByCredentialId(credentialId)).thenReturn(null);
        assertThatThrownBy(() -> service().updateLabel("alice", "not-base64", "label", null))
                .isInstanceOf(ApiException.class)
                .hasMessage("Passkey not found");
        assertThatThrownBy(
                        () ->
                                service()
                                        .deleteForAdministrator(
                                                "alice", credentialId.toBase64UrlString(), "admin"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Passkey not found");
        verify(credentialRepository, never()).delete(credentialId);
    }

    private static CredentialRecord credential(Bytes id, Bytes userHandle) {
        CredentialRecord record = mock(CredentialRecord.class);
        when(record.getCredentialId()).thenReturn(id);
        when(record.getUserEntityUserId()).thenReturn(userHandle);
        when(record.getCreated()).thenReturn(Instant.parse("2026-01-01T00:00:00Z"));
        when(record.getLastUsed()).thenReturn(Instant.parse("2026-01-02T00:00:00Z"));
        when(record.getLabel()).thenReturn("Passkey");
        when(record.getTransports())
                .thenReturn(
                        Set.of(
                                org.springframework.security.web.webauthn.api.AuthenticatorTransport
                                        .INTERNAL));
        when(record.getCredentialType())
                .thenReturn(
                        org.springframework.security.web.webauthn.api.PublicKeyCredentialType
                                .PUBLIC_KEY);
        when(record.getSignatureCount()).thenReturn(3L);
        when(record.isUvInitialized()).thenReturn(true);
        when(record.isBackupEligible()).thenReturn(true);
        when(record.isBackupState()).thenReturn(false);
        when(record.getAttestationObject()).thenReturn(null);
        when(record.getAttestationClientDataJSON()).thenReturn(null);
        return record;
    }

    private WebAuthnService service() {
        return new WebAuthnService(
                userRepository, credentialRepository, invalidationService, auditEventService);
    }

    private UserEntity user() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        return user;
    }
}
