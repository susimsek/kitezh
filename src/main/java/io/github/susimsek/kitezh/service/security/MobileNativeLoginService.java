package io.github.susimsek.kitezh.service.security;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.config.security.SecurityJsonMapper;
import io.github.susimsek.kitezh.domain.AuthenticationFlowBindingType;
import io.github.susimsek.kitezh.domain.MobileLoginTransactionEntity;
import io.github.susimsek.kitezh.dto.account.MfaSetupDTO;
import io.github.susimsek.kitezh.dto.account.MobileGoogleLoginRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobileLoginActionRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobileLoginMfaRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobileLoginPlatform;
import io.github.susimsek.kitezh.dto.account.MobileLoginRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobileLoginResponseDTO;
import io.github.susimsek.kitezh.dto.account.MobilePasskeyAssertionRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobilePasskeyLoginRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobilePasskeyOptionsDTO;
import io.github.susimsek.kitezh.dto.account.MobilePasskeyRegistrationRequestDTO;
import io.github.susimsek.kitezh.dto.account.RecoveryCodesDTO;
import io.github.susimsek.kitezh.dto.account.RequiredActionDTO;
import io.github.susimsek.kitezh.repository.MobileLoginTransactionRepository;
import io.github.susimsek.kitezh.service.DomainUserDetailsService;
import io.github.susimsek.kitezh.service.account.MfaService;
import io.github.susimsek.kitezh.service.account.RecoveryCodeService;
import io.github.susimsek.kitezh.service.account.WebAuthnService;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.requiredaction.RequiredActionService;
import jakarta.servlet.http.HttpServletRequest;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.Principal;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.PkceParameterNames;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationCode;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.web.webauthn.api.AuthenticatorAssertionResponse;
import org.springframework.security.web.webauthn.api.AuthenticatorAttestationResponse;
import org.springframework.security.web.webauthn.api.PublicKeyCredential;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialCreationOptions;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialRequestOptions;
import org.springframework.security.web.webauthn.management.ImmutablePublicKeyCredentialCreationOptionsRequest;
import org.springframework.security.web.webauthn.management.ImmutablePublicKeyCredentialRequestOptionsRequest;
import org.springframework.security.web.webauthn.management.ImmutableRelyingPartyRegistrationRequest;
import org.springframework.security.web.webauthn.management.RelyingPartyAuthenticationRequest;
import org.springframework.security.web.webauthn.management.RelyingPartyPublicKey;
import org.springframework.security.web.webauthn.management.WebAuthnRelyingPartyOperations;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import tools.jackson.core.type.TypeReference;

/** Native credential continuation that issues only short-lived SAS authorization codes. */
@Service
@RequiredArgsConstructor
public class MobileNativeLoginService {

    private static final java.time.Duration TRANSACTION_TTL = java.time.Duration.ofMinutes(5);
    private static final Set<String> MOBILE_CLIENTS =
            Set.of("mobile-account-console", "mobile-admin-console");
    private static final Set<String> MOBILE_REQUIRED_ACTIONS =
            Set.of(
                    "UPDATE_PROFILE",
                    "UPDATE_EMAIL",
                    "UPDATE_PASSWORD",
                    "TERMS_AND_CONDITIONS",
                    "DELETE_ACCOUNT",
                    "CUSTOM",
                    "CONFIGURE_TOTP",
                    "RECOVERY_CODES");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RegisteredClientRepository registeredClientRepository;
    private final OAuth2AuthorizationService authorizationService;
    private final MobileLoginTransactionRepository transactionRepository;
    private final DomainUserDetailsService userDetailsService;
    private final Map<String, AuthenticationManager> authenticationManagers;
    private final LoginRateLimitService loginRateLimitService;
    private final RegistrationCaptchaService registrationCaptchaService;
    private final MfaService mfaService;
    private final RecoveryCodeService recoveryCodeService;
    private final RequiredActionService requiredActionService;
    private final AuthenticationFlowRuntimeService authenticationFlowRuntimeService;
    private final ApplicationEventPublisher eventPublisher;
    private final ApplicationProperties applicationProperties;
    private final AdminAuditEventService auditEventService;
    private final WebAuthnRelyingPartyOperations webAuthnRelyingPartyOperations;
    private final SecurityJsonMapper securityJsonMapper;
    private final WebAuthnService webAuthnService;

    @Transactional
    public MobileLoginResponseDTO beginPasskey(
            MobilePasskeyLoginRequestDTO request, HttpServletRequest servletRequest) {
        RegisteredClient client =
                validateAuthorizationRequest(
                        request.clientId(), request.redirectUri(), request.scope());
        LoginRateLimitService.RateLimitDecision decision =
                loginRateLimitService.check(request.username(), servletRequest.getRemoteAddr());
        if (!decision.allowed()) {
            throw ApiException.tooManyRequests(
                    ApiErrorCode.RATE_LIMIT_EXCEEDED,
                    "Too many login attempts. Please try again later.");
        }
        Authentication principal = currentPrincipal(request.username());
        if (!webAuthnService.hasCredential(request.username())) {
            throw ApiException.unauthorized(
                    ApiErrorCode.AUTHENTICATION_FAILED, "Passkey authentication failed.");
        }
        MobileLoginTransactionEntity entity = new MobileLoginTransactionEntity();
        entity.setId(opaqueId());
        entity.setRegisteredClientId(client.getId());
        entity.setPrincipalName(principal.getName());
        entity.setRedirectUri(request.redirectUri());
        entity.setScope(request.scope().trim());
        entity.setState(request.state());
        entity.setCodeChallenge(request.codeChallenge());
        entity.setNonce(request.nonce());
        entity.setPlatform(request.platform().name());
        entity.setMfaVerified(false);
        entity.setRecoveryCodesIssued(false);
        entity.setExpiresAt(Instant.now().plus(TRANSACTION_TTL));
        entity.setChallengeKind(ChallengeKind.PASSKEY.name());
        PublicKeyCredentialRequestOptions options =
                webAuthnRelyingPartyOperations.createCredentialRequestOptions(
                        new ImmutablePublicKeyCredentialRequestOptionsRequest(principal));
        entity.setWebAuthnOptions(serializeOptions(options));
        transactionRepository.saveAndFlush(entity);
        return MobileLoginResponseDTO.passkeyRequired(entity.getId(), webAuthnOptions(options));
    }

    @Transactional
    public MobileLoginResponseDTO verifyPasskey(
            String transactionId, MobilePasskeyAssertionRequestDTO request) {
        LoginTransaction transaction = transaction(transactionId);
        synchronized (transaction) {
            if (transaction.challengeKind() != ChallengeKind.PASSKEY) {
                throw ApiException.badRequest(
                        ApiErrorCode.INVALID_REQUEST,
                        "The mobile login transaction is not awaiting a passkey.");
            }
            PublicKeyCredentialRequestOptions options = requestOptions(transaction.entity());
            org.springframework.security.web.webauthn.api.PublicKeyCredentialUserEntity userEntity;
            try {
                userEntity =
                        webAuthnRelyingPartyOperations.authenticate(
                                new RelyingPartyAuthenticationRequest(
                                        options, credentialAssertion(request.credential())));
            } catch (RuntimeException exception) {
                Authentication attempt =
                        UsernamePasswordAuthenticationToken.unauthenticated(
                                transaction.principal().getName(), null);
                eventPublisher.publishEvent(
                        new AuthenticationFailureBadCredentialsEvent(
                                attempt,
                                new BadCredentialsException(
                                        "Passkey assertion failed", exception)));
                throw ApiException.unauthorized(
                        ApiErrorCode.AUTHENTICATION_FAILED, "Passkey authentication failed.");
            }
            if (!userEntity.getName().equals(transaction.principal().getName())) {
                throw ApiException.unauthorized(
                        ApiErrorCode.AUTHENTICATION_FAILED, "Passkey authentication failed.");
            }
            eventPublisher.publishEvent(new AuthenticationSuccessEvent(transaction.principal()));
            transaction.entity().setWebAuthnOptions(null);
            transaction.markMfaVerified();
            auditEventService.record(
                    "user.mobile-login.passkey-verified",
                    "user",
                    transaction.principal().getName(),
                    transaction.platform().name().toLowerCase(java.util.Locale.ROOT));
            return continueAfterPrimaryAuthentication(transactionId, transaction);
        }
    }

    @Transactional
    public MobilePasskeyOptionsDTO passkeyRegistrationOptions(
            String transactionId, String actionKey) {
        LoginTransaction transaction = transaction(transactionId);
        synchronized (transaction) {
            requirePasskeyAction(transaction, actionKey);
            Authentication principal = transaction.principal();
            PublicKeyCredentialCreationOptions options =
                    webAuthnRelyingPartyOperations.createPublicKeyCredentialCreationOptions(
                            new ImmutablePublicKeyCredentialCreationOptionsRequest(principal));
            transaction.entity().setWebAuthnOptions(serializeOptions(options));
            transactionRepository.flush();
            return new MobilePasskeyOptionsDTO(webAuthnOptions(options));
        }
    }

    @Transactional
    public MobileLoginResponseDTO registerPasskey(
            String transactionId,
            String actionKey,
            MobilePasskeyRegistrationRequestDTO request,
            HttpServletRequest servletRequest) {
        LoginTransaction transaction = transaction(transactionId);
        synchronized (transaction) {
            requirePasskeyAction(transaction, actionKey);
            PublicKeyCredentialCreationOptions options = creationOptions(transaction.entity());
            webAuthnRelyingPartyOperations.registerCredential(
                    new ImmutableRelyingPartyRegistrationRequest(
                            options,
                            new RelyingPartyPublicKey(
                                    credentialAttestation(request.credential()), request.label())));
            transaction.entity().setWebAuthnOptions(null);
            requiredActionService.complete(
                    transaction.principal().getName(),
                    actionKey,
                    Map.of(),
                    servletRequest.getRemoteAddr(),
                    servletRequest.getHeader("User-Agent"));
            auditEventService.record(
                    "user.mobile-login.passkey-registered",
                    "user",
                    transaction.principal().getName(),
                    transaction.platform().name().toLowerCase(java.util.Locale.ROOT));
            return continueAfterPrimaryAuthentication(transactionId, transaction);
        }
    }

    private void requirePasskeyAction(LoginTransaction transaction, String actionKey) {
        if (transaction.challengeKind() != ChallengeKind.REQUIRED_ACTIONS
                || !transaction.pendingActionKeys().contains(actionKey)
                || !("CONFIGURE_PASSKEY".equals(actionKey)
                        || "CONFIGURE_PASSKEY_PASSWORDLESS".equals(actionKey))
                || requiredActionService.pending(transaction.principal().getName()).stream()
                        .noneMatch(action -> action.key().equals(actionKey))) {
            throw ApiException.badRequest(
                    ApiErrorCode.ACTION_UNSUPPORTED,
                    "Passkey enrollment is not pending for this mobile login transaction.");
        }
    }

    private String serializeOptions(Object options) {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            securityJsonMapper.writeSessionAttribute(options, output);
            return Base64.getEncoder().encodeToString(output.toByteArray());
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to persist WebAuthn options", exception);
        }
    }

    private Map<String, Object> webAuthnOptions(Object options) {
        return securityJsonMapper.toWebauthnMap(options);
    }

    private PublicKeyCredentialRequestOptions requestOptions(MobileLoginTransactionEntity entity) {
        Object options = deserializeOptions(entity);
        if (options instanceof PublicKeyCredentialRequestOptions requestOptions) {
            return requestOptions;
        }
        throw ApiException.badRequest(
                ApiErrorCode.INVALID_REQUEST, "Passkey request options are unavailable.");
    }

    private PublicKeyCredentialCreationOptions creationOptions(
            MobileLoginTransactionEntity entity) {
        Object options = deserializeOptions(entity);
        if (options instanceof PublicKeyCredentialCreationOptions creationOptions) {
            return creationOptions;
        }
        throw ApiException.badRequest(
                ApiErrorCode.INVALID_REQUEST, "Passkey registration options are unavailable.");
    }

    private Object deserializeOptions(MobileLoginTransactionEntity entity) {
        if (!StringUtils.hasText(entity.getWebAuthnOptions())) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "Passkey options are unavailable.");
        }
        try {
            return securityJsonMapper.readSessionAttribute(
                    new ByteArrayInputStream(
                            Base64.getDecoder().decode(entity.getWebAuthnOptions())));
        } catch (IOException | IllegalArgumentException exception) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "Passkey options are invalid.");
        }
    }

    private PublicKeyCredential<AuthenticatorAssertionResponse> credentialAssertion(
            Map<String, Object> credential) {
        try {
            return securityJsonMapper.delegate().convertValue(credential, new TypeReference<>() {});
        } catch (RuntimeException exception) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "Passkey assertion is invalid.");
        }
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

    @Transactional
    public MobileLoginResponseDTO begin(
            MobileLoginRequestDTO request, HttpServletRequest servletRequest) {
        RegisteredClient client = validateAuthorizationRequest(request);
        LoginRateLimitService.RateLimitDecision decision =
                loginRateLimitService.check(request.username(), servletRequest.getRemoteAddr());
        if (!decision.allowed()) {
            throw ApiException.tooManyRequests(
                    ApiErrorCode.RATE_LIMIT_EXCEEDED,
                    "Too many login attempts. Please try again later.");
        }

        registrationCaptchaService.verifyMobileLoginOrThrow(
                request.captchaToken(), request.platform(), servletRequest);
        Authentication authentication = authenticate(request.username(), request.password());
        // The LDAP provider includes submitted credentials in its authenticated token. Keep only
        // the username and authorities in the server-side continuation.
        Authentication principal =
                UsernamePasswordAuthenticationToken.authenticated(
                        authentication.getName(), null, authentication.getAuthorities());
        eventPublisher.publishEvent(new AuthenticationSuccessEvent(principal));

        transactionRepository.deleteExpired(Instant.now());
        MobileLoginTransactionEntity entity = new MobileLoginTransactionEntity();
        entity.setId(opaqueId());
        entity.setRegisteredClientId(client.getId());
        entity.setPrincipalName(principal.getName());
        entity.setRedirectUri(request.redirectUri());
        entity.setScope(request.scope().trim());
        entity.setState(request.state());
        entity.setCodeChallenge(request.codeChallenge());
        entity.setNonce(request.nonce());
        entity.setPlatform(request.platform().name());
        entity.setChallengeKind(ChallengeKind.NONE.name());
        entity.setMfaVerified(false);
        entity.setRecoveryCodesIssued(false);
        entity.setExpiresAt(Instant.now().plus(TRANSACTION_TTL));
        transactionRepository.saveAndFlush(entity);
        LoginTransaction transaction =
                new LoginTransaction(
                        entity,
                        principal,
                        authorizationRequest(request, client),
                        request.platform());
        String transactionId = entity.getId();
        auditEventService.record(
                "user.mobile-login.authenticated",
                "user",
                principal.getName(),
                request.platform().name().toLowerCase(java.util.Locale.ROOT));
        return continueAfterPrimaryAuthentication(transactionId, transaction);
    }

    /**
     * Continues a verified native identity through the same MFA, required-action, and PKCE path.
     */
    @Transactional
    public MobileLoginResponseDTO beginSocialLogin(
            MobileGoogleLoginRequestDTO request, String username, boolean providerMfaRequired) {
        RegisteredClient client =
                validateAuthorizationRequest(
                        request.clientId(), request.redirectUri(), request.scope());
        Authentication principal = currentPrincipal(username);
        if (providerMfaRequired && !mfaService.status(principal.getName()).enabled()) {
            throw ApiException.unauthorized(
                    ApiErrorCode.AUTHENTICATION_FAILED,
                    "This provider requires an authenticator to be configured.");
        }
        eventPublisher.publishEvent(new AuthenticationSuccessEvent(principal));

        transactionRepository.deleteExpired(Instant.now());
        MobileLoginTransactionEntity entity = new MobileLoginTransactionEntity();
        entity.setId(opaqueId());
        entity.setRegisteredClientId(client.getId());
        entity.setPrincipalName(principal.getName());
        entity.setRedirectUri(request.redirectUri());
        entity.setScope(request.scope().trim());
        entity.setState(request.state());
        entity.setCodeChallenge(request.codeChallenge());
        entity.setNonce(request.nonce());
        entity.setPlatform(request.platform().name());
        entity.setChallengeKind(ChallengeKind.NONE.name());
        entity.setMfaVerified(false);
        entity.setProviderMfaRequired(providerMfaRequired);
        entity.setRecoveryCodesIssued(false);
        entity.setExpiresAt(Instant.now().plus(TRANSACTION_TTL));
        transactionRepository.saveAndFlush(entity);

        LoginTransaction transaction =
                new LoginTransaction(
                        entity,
                        principal,
                        authorizationRequest(entity, client),
                        request.platform());
        auditEventService.record(
                "user.mobile-login.social-authenticated",
                "user",
                principal.getName(),
                request.platform().name().toLowerCase(java.util.Locale.ROOT));
        return continueAfterPrimaryAuthentication(entity.getId(), transaction);
    }

    public void validateSocialLoginRequest(MobileGoogleLoginRequestDTO request) {
        validateAuthorizationRequest(request.clientId(), request.redirectUri(), request.scope());
    }

    @Transactional
    public MobileLoginResponseDTO verifyMfa(
            String transactionId,
            MobileLoginMfaRequestDTO request,
            HttpServletRequest servletRequest) {
        LoginTransaction transaction = transaction(transactionId);
        synchronized (transaction) {
            if (transaction.challengeKind() != ChallengeKind.MFA) {
                throw ApiException.badRequest(
                        ApiErrorCode.INVALID_REQUEST,
                        "The mobile login transaction is not awaiting MFA");
            }
            if (!mfaService.valid(transaction.principal().getName(), request.code())) {
                throw ApiException.badRequest(
                        ApiErrorCode.INVALID_TOTP_CODE, "Authenticator code is invalid.");
            }
            auditEventService.record(
                    "user.mobile-login.mfa-verified",
                    "user",
                    transaction.principal().getName(),
                    transaction.platform().name().toLowerCase(java.util.Locale.ROOT));
            transaction.markMfaVerified();
            return continueAfterPrimaryAuthentication(transactionId, transaction);
        }
    }

    @Transactional
    public MobileLoginResponseDTO completeAction(
            String transactionId,
            String actionKey,
            MobileLoginActionRequestDTO request,
            HttpServletRequest servletRequest) {
        LoginTransaction transaction = transaction(transactionId);
        synchronized (transaction) {
            if (transaction.challengeKind() != ChallengeKind.REQUIRED_ACTIONS
                    || !transaction.pendingActionKeys().contains(actionKey)
                    || !MOBILE_REQUIRED_ACTIONS.contains(actionKey)) {
                throw ApiException.badRequest(
                        ApiErrorCode.ACTION_UNSUPPORTED,
                        "This required action is not supported by native login.");
            }
            if ("UPDATE_EMAIL".equals(actionKey)) {
                throw ApiException.badRequest(
                        ApiErrorCode.ACTION_UNSUPPORTED,
                        "Complete the email verification link, then restart mobile sign-in.");
            }
            boolean isPending =
                    requiredActionService.pending(transaction.principal().getName()).stream()
                            .anyMatch(action -> action.key().equals(actionKey));
            if (!isPending) {
                throw ApiException.badRequest(
                        ApiErrorCode.ACTION_UNSUPPORTED,
                        "This required action is no longer pending or is not supported.");
            }
            requiredActionService.complete(
                    transaction.principal().getName(),
                    actionKey,
                    request.values(),
                    servletRequest.getRemoteAddr(),
                    servletRequest.getHeader("User-Agent"));
            if ("CONFIGURE_TOTP".equals(actionKey)) {
                // Matching a fresh TOTP during required enrollment is already the factor proof
                // required by the browser flow for this authorization request.
                transaction.markMfaVerified();
            }
            return continueAfterPrimaryAuthentication(transactionId, transaction);
        }
    }

    @Transactional
    public MfaSetupDTO setupTotp(String transactionId) {
        LoginTransaction transaction = transaction(transactionId);
        synchronized (transaction) {
            requireActionChallenge(transaction, "CONFIGURE_TOTP");
            // MfaService.setup reuses an unconfirmed secret, so retrying after a lost response is
            // safe.
            return mfaService.setup(transaction.principal().getName());
        }
    }

    @Transactional
    public RecoveryCodesDTO setupRecoveryCodes(String transactionId) {
        LoginTransaction transaction = transaction(transactionId);
        synchronized (transaction) {
            requireActionChallenge(transaction, "RECOVERY_CODES");
            if (recoveryCodeService == null) {
                throw ApiException.badRequest(
                        ApiErrorCode.ACTION_UNSUPPORTED,
                        "Recovery code setup is not available for native login.");
            }
            if (!mfaService.status(transaction.principal().getName()).enabled()) {
                throw ApiException.badRequest(
                        ApiErrorCode.ACTION_UNSUPPORTED,
                        "Authenticator-based MFA must be enabled before recovery codes can be"
                                + " generated.");
            }
            if (transaction.recoveryCodesIssued()) {
                throw ApiException.conflict(
                        ApiErrorCode.CONFLICT,
                        "Recovery-code setup was already issued for this transaction.");
            }
            transaction.markRecoveryCodesIssued();
            transactionRepository.flush();
            RecoveryCodesDTO codes =
                    recoveryCodeService.generate(transaction.principal().getName());
            return codes;
        }
    }

    private void requireActionChallenge(LoginTransaction transaction, String actionKey) {
        if (transaction.challengeKind() != ChallengeKind.REQUIRED_ACTIONS
                || !transaction.pendingActionKeys().contains(actionKey)
                || !MOBILE_REQUIRED_ACTIONS.contains(actionKey)
                || requiredActionService.pending(transaction.principal().getName()).stream()
                        .noneMatch(action -> action.key().equals(actionKey))) {
            throw ApiException.badRequest(
                    ApiErrorCode.ACTION_UNSUPPORTED,
                    "This required action is not pending for the mobile login transaction.");
        }
    }

    private Authentication authenticate(String username, String password) {
        UsernamePasswordAuthenticationToken attempt =
                UsernamePasswordAuthenticationToken.unauthenticated(username, password);
        try {
            AuthenticationManager authenticationManager =
                    authenticationManagers.get("formAuthenticationManager");
            if (authenticationManager == null) {
                throw new IllegalStateException("Form authentication manager is unavailable");
            }
            return authenticationManager.authenticate(attempt);
        } catch (AuthenticationException exception) {
            Authentication safeAttempt =
                    UsernamePasswordAuthenticationToken.unauthenticated(username, null);
            eventPublisher.publishEvent(
                    new AuthenticationFailureBadCredentialsEvent(safeAttempt, exception));
            throw ApiException.unauthorized(
                    ApiErrorCode.AUTHENTICATION_FAILED, "Invalid username or password.");
        }
    }

    private RegisteredClient validateAuthorizationRequest(MobileLoginRequestDTO request) {
        return validateAuthorizationRequest(
                request.clientId(), request.redirectUri(), request.scope());
    }

    private RegisteredClient validateAuthorizationRequest(
            String clientId, String redirectUri, String requestedScope) {
        if (!MOBILE_CLIENTS.contains(clientId)) {
            throw invalidRequest();
        }
        RegisteredClient client = registeredClientRepository.findByClientId(clientId);
        if (client == null
                || !client.getRedirectUris().contains(redirectUri)
                || !client.getClientAuthenticationMethods()
                        .contains(
                                org.springframework.security.oauth2.core.ClientAuthenticationMethod
                                        .NONE)
                || !client.getAuthorizationGrantTypes()
                        .contains(AuthorizationGrantType.AUTHORIZATION_CODE)
                || !client.getClientSettings().isRequireProofKey()
                || client.getClientSettings().isRequireAuthorizationConsent()) {
            throw invalidRequest();
        }
        Set<String> scopes = new HashSet<>(Arrays.asList(requestedScope.trim().split("\\s+")));
        if (scopes.size() != requestedScope.trim().split("\\s+").length
                || !scopes.contains("openid")
                || !client.getScopes().containsAll(scopes)) {
            throw invalidRequest();
        }
        boolean accountClient = clientId.equals("mobile-account-console");
        if (accountClient && scopes.contains("admin-api")) {
            throw invalidRequest();
        }
        if (!accountClient && scopes.contains("account-api")) {
            throw invalidRequest();
        }
        return client;
    }

    private OAuth2AuthorizationRequest authorizationRequest(
            MobileLoginRequestDTO request, RegisteredClient client) {
        String issuer = applicationProperties.authorizationServer().issuer();
        return OAuth2AuthorizationRequest.authorizationCode()
                .authorizationUri(issuer + "/oauth2/authorize")
                .clientId(client.getClientId())
                .redirectUri(request.redirectUri())
                .scopes(new HashSet<>(Arrays.asList(request.scope().trim().split("\\s+"))))
                .state(request.state())
                .attributes(
                        attributes -> {
                            attributes.put(
                                    PkceParameterNames.CODE_CHALLENGE, request.codeChallenge());
                            attributes.put(
                                    PkceParameterNames.CODE_CHALLENGE_METHOD,
                                    request.codeChallengeMethod());
                        })
                .additionalParameters(Map.of(OidcParameterNames.NONCE, request.nonce()))
                .build();
    }

    private OAuth2AuthorizationRequest authorizationRequest(
            MobileLoginTransactionEntity transaction, RegisteredClient client) {
        String issuer = applicationProperties.authorizationServer().issuer();
        return OAuth2AuthorizationRequest.authorizationCode()
                .authorizationUri(issuer + "/oauth2/authorize")
                .clientId(client.getClientId())
                .redirectUri(transaction.getRedirectUri())
                .scopes(new HashSet<>(Arrays.asList(transaction.getScope().split("\\s+"))))
                .state(transaction.getState())
                .attributes(
                        attributes -> {
                            attributes.put(
                                    PkceParameterNames.CODE_CHALLENGE,
                                    transaction.getCodeChallenge());
                            attributes.put(PkceParameterNames.CODE_CHALLENGE_METHOD, "S256");
                        })
                .additionalParameters(Map.of(OidcParameterNames.NONCE, transaction.getNonce()))
                .build();
    }

    private MobileLoginResponseDTO continueAfterPrimaryAuthentication(
            String transactionId, LoginTransaction transaction) {
        List<RequiredActionDTO> pending =
                requiredActionService.pending(transaction.principal().getName());
        if (!pending.isEmpty()) {
            transaction.awaitActions(
                    pending.stream()
                            .map(RequiredActionDTO::key)
                            .collect(java.util.stream.Collectors.toSet()));
            return MobileLoginResponseDTO.requiredActions(transactionId, pending);
        }
        if ((transaction.providerMfaRequired() || requiresMfa(transaction.principal().getName()))
                && !transaction.mfaVerified()) {
            transaction.awaitMfa();
            return MobileLoginResponseDTO.mfaRequired(transactionId);
        }
        return issueAuthorizationCode(transactionId, transaction);
    }

    private boolean requiresMfa(String username) {
        var status = mfaService.status(username);
        return status.enabled()
                && authenticationFlowRuntimeService.containsEnabledExecution(
                        AuthenticationFlowBindingType.BROWSER, "otp-form");
    }

    private MobileLoginResponseDTO issueAuthorizationCode(
            String transactionId, LoginTransaction transaction) {
        RegisteredClient client =
                registeredClientRepository.findById(transaction.entity().getRegisteredClientId());
        Authentication principal = currentPrincipal(transaction.entity().getPrincipalName());
        if (client == null
                || !MOBILE_CLIENTS.contains(client.getClientId())
                || !client.getRedirectUris().contains(transaction.redirectUri())
                || !client.getClientAuthenticationMethods()
                        .contains(
                                org.springframework.security.oauth2.core.ClientAuthenticationMethod
                                        .NONE)
                || !client.getAuthorizationGrantTypes()
                        .contains(AuthorizationGrantType.AUTHORIZATION_CODE)
                || !client.getClientSettings().isRequireProofKey()
                || client.getClientSettings().isRequireAuthorizationConsent()
                || !client.getScopes().containsAll(transaction.scopes())) {
            transactionRepository.delete(transaction.entity());
            throw invalidRequest();
        }
        Instant issuedAt = Instant.now();
        OAuth2AuthorizationCode code =
                new OAuth2AuthorizationCode(
                        opaqueId(),
                        issuedAt,
                        issuedAt.plus(client.getTokenSettings().getAuthorizationCodeTimeToLive()));
        OAuth2Authorization authorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .id(opaqueId())
                        .principalName(principal.getName())
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .authorizedScopes(transaction.scopes())
                        .attribute(Principal.class.getName(), principal)
                        .attribute(
                                OAuth2AuthorizationRequest.class.getName(),
                                transaction.authorizationRequest())
                        .token(code)
                        .build();
        authorizationService.save(authorization);
        transactionRepository.delete(transaction.entity());
        auditEventService.record(
                "user.mobile-login.completed",
                "user",
                principal.getName(),
                transaction.platform().name().toLowerCase(java.util.Locale.ROOT));
        return MobileLoginResponseDTO.authorized(
                code.getTokenValue(), transaction.state(), transaction.redirectUri());
    }

    private LoginTransaction transaction(String transactionId) {
        if (!StringUtils.hasText(transactionId)) {
            throw ApiException.notFound("Mobile login transaction not found");
        }
        MobileLoginTransactionEntity entity =
                transactionRepository.findByIdForUpdate(transactionId).orElse(null);
        if (entity == null || entity.getExpiresAt().isBefore(Instant.now())) {
            if (entity != null) {
                transactionRepository.delete(entity);
            }
            throw ApiException.notFound("Mobile login transaction not found");
        }
        Authentication principal = currentPrincipal(entity.getPrincipalName());
        RegisteredClient client =
                registeredClientRepository.findById(entity.getRegisteredClientId());
        if (client == null) {
            transactionRepository.delete(entity);
            throw ApiException.notFound("Mobile login transaction not found");
        }
        return new LoginTransaction(
                entity,
                principal,
                authorizationRequest(entity, client),
                MobileLoginPlatform.valueOf(entity.getPlatform()));
    }

    private Authentication currentPrincipal(String username) {
        UserDetails user;
        try {
            user = userDetailsService.loadUserByUsername(username);
        } catch (UsernameNotFoundException exception) {
            throw ApiException.unauthorized(
                    ApiErrorCode.AUTHENTICATION_FAILED, "The account is no longer available.");
        }
        if (!user.isEnabled() || !user.isAccountNonLocked() || !user.isAccountNonExpired()) {
            throw ApiException.unauthorized(
                    ApiErrorCode.AUTHENTICATION_FAILED, "The account is no longer available.");
        }
        return UsernamePasswordAuthenticationToken.authenticated(
                user.getUsername(), null, user.getAuthorities());
    }

    private static ApiException invalidRequest() {
        return ApiException.badRequest(
                ApiErrorCode.AUTHZ_INVALID_REQUEST, "The mobile authorization request is invalid.");
    }

    private static String opaqueId() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private enum ChallengeKind {
        NONE,
        MFA,
        PASSKEY,
        REQUIRED_ACTIONS
    }

    private static final class LoginTransaction {
        private final MobileLoginTransactionEntity entity;
        private final Authentication principal;
        private final OAuth2AuthorizationRequest authorizationRequest;
        private final MobileLoginPlatform platform;

        private LoginTransaction(
                MobileLoginTransactionEntity entity,
                Authentication principal,
                OAuth2AuthorizationRequest authorizationRequest,
                MobileLoginPlatform platform) {
            this.entity = entity;
            this.principal = principal;
            this.authorizationRequest = authorizationRequest;
            this.platform = platform;
        }

        MobileLoginTransactionEntity entity() {
            return entity;
        }

        Authentication principal() {
            return principal;
        }

        OAuth2AuthorizationRequest authorizationRequest() {
            return authorizationRequest;
        }

        String redirectUri() {
            return entity.getRedirectUri();
        }

        String state() {
            return entity.getState();
        }

        Set<String> scopes() {
            return Set.copyOf(Arrays.asList(entity.getScope().split("\\s+")));
        }

        MobileLoginPlatform platform() {
            return platform;
        }

        Instant expiresAt() {
            return entity.getExpiresAt();
        }

        boolean mfaVerified() {
            return entity.isMfaVerified();
        }

        ChallengeKind challengeKind() {
            return ChallengeKind.valueOf(entity.getChallengeKind());
        }

        Set<String> pendingActionKeys() {
            String keys = entity.getPendingActionKeys();
            return StringUtils.hasText(keys)
                    ? Set.copyOf(Arrays.asList(keys.split(",")))
                    : Set.of();
        }

        void awaitMfa() {
            entity.setChallengeKind(ChallengeKind.MFA.name());
            entity.setPendingActionKeys(null);
        }

        void awaitActions(Set<String> actionKeys) {
            entity.setChallengeKind(ChallengeKind.REQUIRED_ACTIONS.name());
            entity.setPendingActionKeys(String.join(",", actionKeys));
        }

        void markMfaVerified() {
            entity.setChallengeKind(ChallengeKind.NONE.name());
            entity.setPendingActionKeys(null);
            entity.setMfaVerified(true);
        }

        boolean recoveryCodesIssued() {
            return entity.isRecoveryCodesIssued();
        }

        boolean providerMfaRequired() {
            return entity.isProviderMfaRequired();
        }

        void markRecoveryCodesIssued() {
            entity.setRecoveryCodesIssued(true);
        }
    }
}
