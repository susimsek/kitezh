package io.github.susimsek.kitezh.service.account;

import io.github.susimsek.kitezh.config.security.SecurityJsonMapper;
import io.github.susimsek.kitezh.domain.AccountPasskeyRegistrationChallengeEntity;
import io.github.susimsek.kitezh.dto.account.AccountPasskeyRegistrationOptionsDTO;
import io.github.susimsek.kitezh.dto.account.MobilePasskeyRegistrationRequestDTO;
import io.github.susimsek.kitezh.repository.AccountPasskeyRegistrationChallengeRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.webauthn.api.AuthenticatorAttestationResponse;
import org.springframework.security.web.webauthn.api.PublicKeyCredential;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialCreationOptions;
import org.springframework.security.web.webauthn.management.ImmutablePublicKeyCredentialCreationOptionsRequest;
import org.springframework.security.web.webauthn.management.ImmutableRelyingPartyRegistrationRequest;
import org.springframework.security.web.webauthn.management.RelyingPartyPublicKey;
import org.springframework.security.web.webauthn.management.WebAuthnRelyingPartyOperations;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;

/** Authenticated, single-use passkey enrollment for the native Account Security screen. */
@Service
@RequiredArgsConstructor
public class AccountPasskeyRegistrationService {

    private static final Duration CHALLENGE_TTL = Duration.ofMinutes(5);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AccountPasskeyRegistrationChallengeRepository challengeRepository;
    private final WebAuthnRelyingPartyOperations relyingParty;
    private final SecurityJsonMapper securityJsonMapper;
    private final AdminAuditEventService auditEventService;

    @Transactional
    public AccountPasskeyRegistrationOptionsDTO begin(Authentication authentication) {
        challengeRepository.deleteExpired(Instant.now());
        PublicKeyCredentialCreationOptions options =
                relyingParty.createPublicKeyCredentialCreationOptions(
                        new ImmutablePublicKeyCredentialCreationOptionsRequest(authentication));
        AccountPasskeyRegistrationChallengeEntity challenge =
                new AccountPasskeyRegistrationChallengeEntity();
        challenge.setId(opaqueId());
        challenge.setUsername(authentication.getName());
        challenge.setOptions(serializeOptions(options));
        challenge.setExpiresAt(Instant.now().plus(CHALLENGE_TTL));
        challengeRepository.save(challenge);
        return new AccountPasskeyRegistrationOptionsDTO(
                challenge.getId(), securityJsonMapper.toWebauthnMap(options));
    }

    @Transactional
    public void complete(
            Authentication authentication,
            String challengeId,
            MobilePasskeyRegistrationRequestDTO request) {
        AccountPasskeyRegistrationChallengeEntity challenge =
                challengeRepository.findByIdForUpdate(challengeId);
        if (challenge == null
                || !challenge.getUsername().equals(authentication.getName())
                || challenge.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.notFound("Passkey registration challenge not found");
        }
        PublicKeyCredentialCreationOptions options = deserializeOptions(challenge.getOptions());
        PublicKeyCredential<AuthenticatorAttestationResponse> credential =
                credentialAttestation(request.credential());
        try {
            relyingParty.registerCredential(
                    new ImmutableRelyingPartyRegistrationRequest(
                            options,
                            new RelyingPartyPublicKey(credential, request.label().trim())));
        } catch (RuntimeException exception) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "Passkey registration proof is invalid.");
        }
        challengeRepository.delete(challenge);
        auditEventService.record("account.passkey.registered", "account", authentication.getName());
    }

    private String serializeOptions(PublicKeyCredentialCreationOptions options) {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            securityJsonMapper.writeSessionAttribute(options, output);
            return Base64.getEncoder().encodeToString(output.toByteArray());
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Unable to persist passkey registration options", exception);
        }
    }

    private PublicKeyCredentialCreationOptions deserializeOptions(String encoded) {
        try {
            Object value =
                    securityJsonMapper.readSessionAttribute(
                            new ByteArrayInputStream(Base64.getDecoder().decode(encoded)));
            if (value instanceof PublicKeyCredentialCreationOptions options) {
                return options;
            }
        } catch (IOException | IllegalArgumentException exception) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "Passkey registration options are invalid.");
        }
        throw ApiException.badRequest(
                ApiErrorCode.INVALID_REQUEST, "Passkey registration options are invalid.");
    }

    private PublicKeyCredential<AuthenticatorAttestationResponse> credentialAttestation(
            Map<String, Object> credential) {
        try {
            return securityJsonMapper.delegate().convertValue(credential, new TypeReference<>() {});
        } catch (RuntimeException exception) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "Passkey registration response is invalid.");
        }
    }

    private static String opaqueId() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
