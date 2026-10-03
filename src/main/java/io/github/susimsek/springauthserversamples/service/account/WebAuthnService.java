package io.github.susimsek.springauthserversamples.service.account;

import io.github.susimsek.springauthserversamples.config.security.WebAuthnUserEntityRepository;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.account.WebAuthnCredentialDTO;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import io.github.susimsek.springauthserversamples.service.admin.UserAccessInvalidationService;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.web.webauthn.api.Bytes;
import org.springframework.security.web.webauthn.api.CredentialRecord;
import org.springframework.security.web.webauthn.api.ImmutableCredentialRecord;
import org.springframework.security.web.webauthn.management.UserCredentialRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@SuppressWarnings("java:S6213")
public class WebAuthnService {

    private static final String PASSKEY_NOT_FOUND = "Passkey not found";

    private final UserRepository userRepository;
    private final UserCredentialRepository credentialRepository;
    private final UserAccessInvalidationService userAccessInvalidationService;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public Page<WebAuthnCredentialDTO> credentials(String username, Pageable pageable) {
        UserEntity user = user(username);
        Bytes userHandle = WebAuthnUserEntityRepository.userHandle(user.getId());
        List<WebAuthnCredentialDTO> credentials =
                credentialRepository.findByUserId(userHandle).stream()
                        .sorted(Comparator.comparing(CredentialRecord::getCreated).reversed())
                        .map(this::toDTO)
                        .toList();
        int start = Math.min((int) pageable.getOffset(), credentials.size());
        int end = Math.min(start + pageable.getPageSize(), credentials.size());
        return new PageImpl<>(credentials.subList(start, end), pageable, credentials.size());
    }

    @Transactional(readOnly = true)
    public WebAuthnCredentialDTO credential(String username, String credentialId) {
        UserEntity user = user(username);
        Bytes id;
        try {
            id = Bytes.fromBase64(credentialId);
        } catch (RuntimeException _) {
            throw ApiException.notFound(PASSKEY_NOT_FOUND);
        }
        CredentialRecord record = credentialRepository.findByCredentialId(id);
        if (record == null
                || !record.getUserEntityUserId()
                        .equals(WebAuthnUserEntityRepository.userHandle(user.getId()))) {
            throw ApiException.notFound(PASSKEY_NOT_FOUND);
        }
        return toDTO(record);
    }

    @Transactional(readOnly = true)
    public boolean hasCredential(String username) {
        UserEntity user = user(username);
        return !credentialRepository
                .findByUserId(WebAuthnUserEntityRepository.userHandle(user.getId()))
                .isEmpty();
    }

    @Transactional
    public void delete(String username, String credentialId) {
        deleteCredential(username, credentialId, "account.passkey.deleted", "account");
    }

    @Transactional
    public void deleteForAdministrator(String username, String credentialId, String actorUsername) {
        deleteCredential(username, credentialId, "admin.passkey.deleted", "user");
    }

    @Transactional
    public void updateLabel(
            String username, String credentialId, String label, String actorUsername) {
        UserEntity user = user(username);
        Bytes id;
        try {
            id = Bytes.fromBase64(credentialId);
        } catch (IllegalArgumentException _) {
            throw ApiException.notFound(PASSKEY_NOT_FOUND);
        }
        CredentialRecord record = credentialRepository.findByCredentialId(id);
        if (record == null
                || !Objects.equals(
                        record.getUserEntityUserId(),
                        WebAuthnUserEntityRepository.userHandle(user.getId()))) {
            throw ApiException.notFound(PASSKEY_NOT_FOUND);
        }
        credentialRepository.save(
                ImmutableCredentialRecord.fromCredentialRecord(record).label(label).build());
        auditEventService.record(
                actorUsername == null ? "account.passkey.renamed" : "admin.passkey.renamed",
                "user",
                user.getId().toString());
    }

    private void deleteCredential(
            String username, String credentialId, String event, String resourceType) {
        UserEntity user = user(username);
        Bytes id;
        try {
            id = Bytes.fromBase64(credentialId);
        } catch (IllegalArgumentException _) {
            throw ApiException.notFound(PASSKEY_NOT_FOUND);
        }
        CredentialRecord record = credentialRepository.findByCredentialId(id);
        if (record == null
                || !Objects.equals(
                        record.getUserEntityUserId(),
                        WebAuthnUserEntityRepository.userHandle(user.getId()))) {
            throw ApiException.notFound(PASSKEY_NOT_FOUND);
        }
        credentialRepository.delete(id);
        userAccessInvalidationService.invalidate(user.getUsername());
        auditEventService.record(event, resourceType, user.getId().toString());
    }

    private WebAuthnCredentialDTO toDTO(CredentialRecord record) {
        Set<String> transports =
                record.getTransports().stream()
                        .map(value -> value.getValue())
                        .collect(Collectors.toUnmodifiableSet());
        return new WebAuthnCredentialDTO(
                record.getCredentialId().toBase64UrlString(),
                record.getLabel(),
                record.getCreated(),
                record.getLastUsed(),
                transports,
                record.isBackupEligible(),
                record.isBackupState(),
                record.getCredentialType() == null
                        ? "public-key"
                        : record.getCredentialType().getValue(),
                record.getSignatureCount(),
                record.isUvInitialized(),
                record.getAttestationObject() != null
                        && record.getAttestationClientDataJSON() != null);
    }

    private UserEntity user(String username) {
        return userRepository
                .findByUsername(username)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }
}
