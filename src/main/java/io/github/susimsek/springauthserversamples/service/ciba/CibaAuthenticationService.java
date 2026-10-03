package io.github.susimsek.springauthserversamples.service.ciba;

import io.github.susimsek.springauthserversamples.config.security.SocialLoginSecretCipher;
import io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestEntity;
import io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestStatus;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminCibaPolicyDTO;
import io.github.susimsek.springauthserversamples.dto.oauth.CibaPendingRequestDTO;
import io.github.susimsek.springauthserversamples.repository.CibaAuthenticationRequestRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.security.AuthorizationGrantTypes;
import io.github.susimsek.springauthserversamples.security.ClientSecuritySettings;
import io.github.susimsek.springauthserversamples.service.admin.CibaPolicyService;
import java.net.URI;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** Creates and advances the persisted CIBA request lifecycle. */
@Service
@RequiredArgsConstructor
public class CibaAuthenticationService {

    private static final int MAX_REQUEST_TTL_SECONDS = 3600;
    private static final String USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int USER_CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String INVALID_REQUEST = "invalid_request";
    private static final String INVALID_SCOPE = "invalid_scope";
    private static final String ACCESS_DENIED = "access_denied";
    private static final String REQUEST_CLAIM_MESSAGE = "The CIBA request claim ";

    private final CibaAuthenticationRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final CibaNotificationService notificationService;
    private final CibaPushTokenService pushTokenService;
    private final JwtDecoder jwtDecoder;
    private final CibaPolicyService policyService;
    private final AuthorizationServerSettings authorizationServerSettings;
    private final SocialLoginSecretCipher notificationTokenCipher;

    @Transactional
    public CibaAuthenticationRequestEntity create(
            RegisteredClient client,
            String scope,
            String loginHint,
            String bindingMessage,
            Integer requestedExpiry) {
        return persistRequest(
                client,
                scope,
                loginHint,
                null,
                null,
                bindingMessage,
                requestedExpiry,
                null,
                null,
                null,
                null);
    }

    @Transactional
    public CibaAuthenticationRequestEntity create(
            RegisteredClient client,
            String scope,
            String loginHint,
            String bindingMessage,
            Integer requestedExpiry,
            String requestedDeliveryMode) {
        return persistRequest(
                client,
                scope,
                loginHint,
                null,
                null,
                bindingMessage,
                requestedExpiry,
                requestedDeliveryMode,
                null,
                null,
                null);
    }

    @Transactional
    @SuppressWarnings("java:S107")
    public CibaAuthenticationRequestEntity create(
            RegisteredClient client,
            String scope,
            String loginHint,
            String loginHintToken,
            String idTokenHint,
            String bindingMessage,
            Integer requestedExpiry,
            String requestedDeliveryMode) {
        return persistRequest(
                client,
                scope,
                loginHint,
                loginHintToken,
                idTokenHint,
                bindingMessage,
                requestedExpiry,
                requestedDeliveryMode,
                null,
                null,
                null);
    }

    @Transactional
    @SuppressWarnings("java:S107")
    public CibaAuthenticationRequestEntity create(
            RegisteredClient client,
            String scope,
            String loginHint,
            String loginHintToken,
            String idTokenHint,
            String bindingMessage,
            Integer requestedExpiry,
            String requestedDeliveryMode,
            String requestObject) {
        return persistRequestFromObject(
                client,
                scope,
                loginHint,
                loginHintToken,
                idTokenHint,
                bindingMessage,
                requestedExpiry,
                requestedDeliveryMode,
                null,
                null,
                null,
                requestObject);
    }

    @Transactional
    @SuppressWarnings("java:S107")
    public CibaAuthenticationRequestEntity create(
            RegisteredClient client,
            String scope,
            String loginHint,
            String loginHintToken,
            String idTokenHint,
            String bindingMessage,
            Integer requestedExpiry,
            String requestedDeliveryMode,
            String requestedUserCode,
            String requestObject) {
        return persistRequestFromObject(
                client,
                scope,
                loginHint,
                loginHintToken,
                idTokenHint,
                bindingMessage,
                requestedExpiry,
                requestedDeliveryMode,
                requestedUserCode,
                null,
                null,
                requestObject);
    }

    @Transactional
    @SuppressWarnings("java:S107")
    public CibaAuthenticationRequestEntity create(
            RegisteredClient client,
            String scope,
            String loginHint,
            String loginHintToken,
            String idTokenHint,
            String bindingMessage,
            Integer requestedExpiry,
            String requestedDeliveryMode,
            String clientNotificationToken,
            String requestedUserCode,
            String requestObject) {
        return persistRequestFromObject(
                client,
                scope,
                loginHint,
                loginHintToken,
                idTokenHint,
                bindingMessage,
                requestedExpiry,
                requestedDeliveryMode,
                requestedUserCode,
                clientNotificationToken,
                null,
                requestObject);
    }

    @Transactional
    @SuppressWarnings("java:S107")
    public CibaAuthenticationRequestEntity create(
            RegisteredClient client,
            String scope,
            String loginHint,
            String loginHintToken,
            String idTokenHint,
            String bindingMessage,
            Integer requestedExpiry,
            String requestedDeliveryMode,
            String clientNotificationToken,
            String requestedUserCode,
            String acrValues,
            String requestObject) {
        return persistRequestFromObject(
                client,
                scope,
                loginHint,
                loginHintToken,
                idTokenHint,
                bindingMessage,
                requestedExpiry,
                requestedDeliveryMode,
                requestedUserCode,
                clientNotificationToken,
                acrValues,
                requestObject);
    }

    @SuppressWarnings("java:S107")
    private CibaAuthenticationRequestEntity persistRequestFromObject(
            RegisteredClient client,
            String scope,
            String loginHint,
            String loginHintToken,
            String idTokenHint,
            String bindingMessage,
            Integer requestedExpiry,
            String requestedDeliveryMode,
            String requestedUserCode,
            String clientNotificationToken,
            String acrValues,
            String requestObject) {
        CibaRequestObjectParameters requestParameters = decodeRequestObject(client, requestObject);
        if (StringUtils.hasText(requestObject)
                && (StringUtils.hasText(scope)
                        || StringUtils.hasText(loginHint)
                        || StringUtils.hasText(loginHintToken)
                        || StringUtils.hasText(idTokenHint)
                        || StringUtils.hasText(bindingMessage)
                        || requestedExpiry != null
                        || StringUtils.hasText(requestedDeliveryMode)
                        || StringUtils.hasText(clientNotificationToken)
                        || StringUtils.hasText(acrValues)
                        || StringUtils.hasText(requestedUserCode))) {
            throw protocol(
                    INVALID_REQUEST,
                    "Authentication request parameters must be sent inside the request JWT");
        }
        return persistRequest(
                client,
                mergeString("scope", scope, requestParameters.scope()),
                mergeString("login_hint", loginHint, requestParameters.loginHint()),
                mergeString("login_hint_token", loginHintToken, requestParameters.loginHintToken()),
                mergeString("id_token_hint", idTokenHint, requestParameters.idTokenHint()),
                mergeString("binding_message", bindingMessage, requestParameters.bindingMessage()),
                mergeInteger(
                        "requested_expiry", requestedExpiry, requestParameters.requestedExpiry()),
                mergeString(
                        "backchannel_token_delivery_mode",
                        requestedDeliveryMode,
                        requestParameters.deliveryMode()),
                mergeString("user_code", requestedUserCode, requestParameters.userCode()),
                mergeString(
                        "client_notification_token",
                        clientNotificationToken,
                        requestParameters.clientNotificationToken()),
                mergeString("acr_values", acrValues, requestParameters.acrValues()));
    }

    @SuppressWarnings("java:S107")
    private CibaAuthenticationRequestEntity persistRequest(
            RegisteredClient client,
            String scope,
            String loginHint,
            String loginHintToken,
            String idTokenHint,
            String bindingMessage,
            Integer requestedExpiry,
            String requestedDeliveryMode,
            String requestedUserCode,
            String clientNotificationToken,
            String acrValues) {
        requireCibaGrant(client);
        Set<String> scopes = parseScopes(scope);
        if (!scopes.contains("openid")) {
            throw protocol(INVALID_SCOPE, "CIBA requests must include the openid scope");
        }
        if (!client.getScopes().containsAll(scopes)) {
            throw protocol(INVALID_SCOPE, "The requested scope is not registered for the client");
        }
        AdminCibaPolicyDTO policy = policy();
        String deliveryMode = resolveDeliveryMode(client, requestedDeliveryMode, policy);
        String notificationEndpoint = ClientSecuritySettings.cibaNotificationEndpoint(client);
        if (!ClientSecuritySettings.CIBA_POLL.equals(deliveryMode)
                && (!isHttpUri(notificationEndpoint)
                        || !isValidNotificationToken(clientNotificationToken))) {
            throw protocol(
                    INVALID_REQUEST,
                    "A notification endpoint and client notification token are required for "
                            + deliveryMode
                            + " delivery");
        }
        if (bindingMessage != null && bindingMessage.length() > 20) {
            throw protocol(INVALID_REQUEST, "binding_message must contain at most 20 characters");
        }
        int ttlSeconds =
                requestedExpiry == null ? policy.requestLifespanSeconds() : requestedExpiry;
        if (ttlSeconds < 1
                || ttlSeconds > MAX_REQUEST_TTL_SECONDS
                || ttlSeconds > policy.requestLifespanSeconds()) {
            throw protocol(INVALID_REQUEST, "requested_expiry is outside the supported range");
        }
        UserEntity user = resolveUser(client, loginHint, loginHintToken, idTokenHint);
        String principalName =
                StringUtils.hasText(user.getUsername())
                        ? user.getUsername().trim()
                        : requireLoginHint(loginHint);
        Instant now = Instant.now();
        String persistedNotificationToken =
                persistNotificationToken(clientNotificationToken, deliveryMode);
        CibaAuthenticationRequestEntity entity =
                new CibaAuthenticationRequestEntity(
                        newAuthReqId(),
                        client.getId(),
                        principalName,
                        String.join(" ", scopes),
                        bindingMessage,
                        deliveryMode,
                        notificationEndpoint,
                        persistedNotificationToken,
                        now,
                        now.plusSeconds(ttlSeconds),
                        policy.pollingIntervalSeconds());
        entity.setUserCode(resolveUserCode(requestedUserCode));
        entity.setAcrValues(normalizeAcrValues(acrValues));
        entity.setUserVerification(policy.userVerification());
        entity.setMfaRequired(policy.mfaRequired());
        entity.setStepUpRequired(policy.stepUpRequired());
        entity.setStepUpAcr(policy.stepUpAcr());
        return requestRepository.save(entity);
    }

    private String persistNotificationToken(String token, String deliveryMode) {
        if (ClientSecuritySettings.CIBA_POLL.equals(deliveryMode) || !StringUtils.hasText(token)) {
            return null;
        }
        if (notificationTokenCipher == null) {
            return token;
        }
        if (!notificationTokenCipher.isConfigured()) {
            throw protocol(
                    INVALID_REQUEST,
                    "SOCIAL_LOGIN_ENCRYPTION_KEY is required for ping or push delivery");
        }
        return notificationTokenCipher.encrypt(token);
    }

    private UserEntity resolveUser(
            RegisteredClient client, String loginHint, String loginHintToken, String idTokenHint) {
        int hintCount =
                (StringUtils.hasText(loginHint) ? 1 : 0)
                        + (StringUtils.hasText(loginHintToken) ? 1 : 0)
                        + (StringUtils.hasText(idTokenHint) ? 1 : 0);
        if (hintCount != 1) {
            throw protocol(
                    INVALID_REQUEST,
                    "Exactly one of login_hint, login_hint_token, or id_token_hint is required");
        }
        if (StringUtils.hasText(loginHint)) {
            return userRepository
                    .findByUsername(requireLoginHint(loginHint))
                    .filter(UserEntity::isEnabled)
                    .orElseThrow(
                            () ->
                                    protocol(
                                            INVALID_REQUEST,
                                            "The hint does not identify an enabled user"));
        }
        return resolveTokenUser(
                client, StringUtils.hasText(loginHintToken) ? loginHintToken : idTokenHint);
    }

    private CibaRequestObjectParameters decodeRequestObject(
            RegisteredClient client, String requestObject) {
        if (!StringUtils.hasText(requestObject)) {
            return CibaRequestObjectParameters.empty();
        }
        if (jwtDecoder == null && !StringUtils.hasText(client.getClientSettings().getJwkSetUrl())) {
            throw protocol(INVALID_REQUEST, "Signed CIBA requests are not configured");
        }
        try {
            Jwt jwt = requestObjectDecoder(client).decode(requestObject.trim());
            Object algorithm = jwt.getHeaders().get("alg");
            if (!(algorithm instanceof String value)
                    || !ClientSecuritySettings.allowedCibaRequestSigningAlgorithms(client)
                            .contains(value)) {
                throw protocol(INVALID_REQUEST, "The CIBA request uses a disallowed algorithm");
            }
            Object issuer = jwt.getClaims().get("iss");
            if (!client.getClientId().equals(issuer)
                    || jwt.getExpiresAt() == null
                    || jwt.getIssuedAt() == null
                    || jwt.getNotBefore() == null
                    || !StringUtils.hasText(jwt.getId())) {
                throw protocol(INVALID_REQUEST, "The CIBA request JWT claims are invalid");
            }
            if (jwt.getAudience() == null
                    || jwt.getAudience().isEmpty()
                    || (authorizationServerSettings != null
                            && authorizationServerSettings.getIssuer() != null
                            && !jwt.getAudience()
                                    .contains(authorizationServerSettings.getIssuer()))) {
                throw protocol(INVALID_REQUEST, "The CIBA request was not issued to this client");
            }
            Map<String, Object> claims = jwt.getClaims();
            return new CibaRequestObjectParameters(
                    stringClaim(claims, "scope"),
                    stringClaim(claims, "login_hint"),
                    stringClaim(claims, "login_hint_token"),
                    stringClaim(claims, "id_token_hint"),
                    stringClaim(claims, "binding_message"),
                    integerClaim(claims, "requested_expiry"),
                    stringClaim(claims, "backchannel_token_delivery_mode"),
                    stringClaim(claims, "user_code"),
                    stringClaim(claims, "client_notification_token"),
                    stringClaim(claims, "acr_values"));
        } catch (JwtException | IllegalArgumentException _) {
            throw protocol(INVALID_REQUEST, "The CIBA request signature is invalid");
        }
    }

    private JwtDecoder requestObjectDecoder(RegisteredClient client) {
        String jwkSetUrl = client.getClientSettings().getJwkSetUrl();
        if (StringUtils.hasText(jwkSetUrl)) {
            return NimbusJwtDecoder.withJwkSetUri(jwkSetUrl).build();
        }
        return jwtDecoder;
    }

    private static String stringClaim(Map<String, Object> claims, String name) {
        Object value = claims.get(name);
        if (value == null) {
            return null;
        }
        if (value instanceof String string) {
            return string;
        }
        throw protocol(INVALID_REQUEST, REQUEST_CLAIM_MESSAGE + name + " must be a string");
    }

    private static Integer integerClaim(Map<String, Object> claims, String name) {
        Object value = claims.get(name);
        if (value == null) {
            return null;
        }
        if (value instanceof Number number && number.longValue() <= Integer.MAX_VALUE) {
            return number.intValue();
        }
        if (value instanceof String string) {
            try {
                return Integer.valueOf(string);
            } catch (NumberFormatException _) {
                throw protocol(
                        INVALID_REQUEST, REQUEST_CLAIM_MESSAGE + name + " must be an integer");
            }
        }
        throw protocol(INVALID_REQUEST, REQUEST_CLAIM_MESSAGE + name + " must be an integer");
    }

    private static String mergeString(String name, String directValue, String requestValue) {
        if (StringUtils.hasText(directValue)
                && StringUtils.hasText(requestValue)
                && !directValue.equals(requestValue)) {
            throw protocol(INVALID_REQUEST, "Conflicting values for " + name);
        }
        return StringUtils.hasText(directValue) ? directValue : requestValue;
    }

    private static Integer mergeInteger(String name, Integer directValue, Integer requestValue) {
        if (directValue != null && requestValue != null && !directValue.equals(requestValue)) {
            throw protocol(INVALID_REQUEST, "Conflicting values for " + name);
        }
        return directValue != null ? directValue : requestValue;
    }

    private UserEntity resolveTokenUser(RegisteredClient client, String token) {
        if (jwtDecoder == null) {
            throw protocol(INVALID_REQUEST, "Token hints are not configured");
        }
        try {
            Jwt jwt = jwtDecoder.decode(token);
            if (jwt.getAudience() == null
                    || jwt.getAudience().isEmpty()
                    || !jwt.getAudience().contains(client.getClientId())) {
                throw protocol(INVALID_REQUEST, "The token hint was not issued to this client");
            }
            return findUserByTokenClaims(jwt)
                    .filter(UserEntity::isEnabled)
                    .orElseThrow(
                            () ->
                                    protocol(
                                            INVALID_REQUEST,
                                            "The token hint does not identify an enabled user"));
        } catch (JwtException _) {
            throw protocol(INVALID_REQUEST, "The token hint is invalid");
        }
    }

    private Optional<UserEntity> findUserByTokenClaims(Jwt jwt) {
        String subject = jwt.getSubject();
        if (StringUtils.hasText(subject)) {
            Optional<UserEntity> user = userRepository.findByUsername(subject);
            if (user.isPresent()) {
                return user;
            }
            user = userRepository.findByEmailIgnoreCase(subject);
            if (user.isPresent()) {
                return user;
            }
        }
        for (String claim : new String[] {"preferred_username", "username", "email"}) {
            Object value = jwt.getClaims().get(claim);
            if (value instanceof String identifier && StringUtils.hasText(identifier)) {
                Optional<UserEntity> user =
                        "email".equals(claim)
                                ? userRepository.findByEmailIgnoreCase(identifier)
                                : userRepository.findByUsername(identifier);
                if (user.isPresent()) {
                    return user;
                }
            }
        }
        return Optional.empty();
    }

    @Transactional
    public void approve(String authReqId, String username) {
        approveRequest(authReqId, username, null, false, false);
    }

    @Transactional
    public void approve(
            String authReqId, String username, boolean mfaVerified, boolean stepUpVerified) {
        approveRequest(authReqId, username, null, mfaVerified, stepUpVerified);
    }

    @Transactional
    public void approve(
            String authReqId,
            String username,
            String userCode,
            boolean mfaVerified,
            boolean stepUpVerified) {
        approveRequest(authReqId, username, userCode, mfaVerified, stepUpVerified);
    }

    private void approveRequest(
            String authReqId,
            String username,
            String userCode,
            boolean mfaVerified,
            boolean stepUpVerified) {
        CibaAuthenticationRequestEntity request = request(authReqId);
        ensureOwner(request, username);
        ensureUserCode(request, userCode);
        expireIfNecessary(request, Instant.now());
        if (request.isMfaRequired() && !mfaVerified) {
            throw protocol(ACCESS_DENIED, "MFA verification is required before approval");
        }
        if (request.isStepUpRequired() && !stepUpVerified) {
            throw protocol(ACCESS_DENIED, "Step-up authentication is required before approval");
        }
        if ("required".equals(request.getUserVerification()) && !stepUpVerified) {
            throw protocol(ACCESS_DENIED, "User verification is required before approval");
        }
        if (request.getStatus() == CibaAuthenticationRequestStatus.PENDING) {
            request.setStatus(CibaAuthenticationRequestStatus.APPROVED);
            request.setApprovedAt(Instant.now());
            requestRepository.save(request);
            if (ClientSecuritySettings.CIBA_PING.equals(request.getDeliveryMode())) {
                notificationService.notifyPing(request);
            }
        }
        if (ClientSecuritySettings.CIBA_PUSH.equals(request.getDeliveryMode())
                && request.getStatus() == CibaAuthenticationRequestStatus.APPROVED
                && pushTokenService != null) {
            pushTokenService.issue(request);
        }
        ensureActionable(request, "The CIBA request cannot be approved");
    }

    @Transactional
    public void deny(String authReqId, String username) {
        denyRequest(authReqId, username, null);
    }

    @Transactional
    public void deny(String authReqId, String username, String userCode) {
        denyRequest(authReqId, username, userCode);
    }

    private void denyRequest(String authReqId, String username, String userCode) {
        CibaAuthenticationRequestEntity request = request(authReqId);
        ensureOwner(request, username);
        ensureUserCode(request, userCode);
        expireIfNecessary(request, Instant.now());
        if (request.getStatus() == CibaAuthenticationRequestStatus.PENDING) {
            request.setStatus(CibaAuthenticationRequestStatus.DENIED);
            request.setDeniedAt(Instant.now());
            requestRepository.save(request);
        }
        ensureActionable(request, "The CIBA request cannot be denied");
    }

    @Transactional
    public CibaAuthenticationRequestEntity poll(String authReqId, String registeredClientId) {
        CibaAuthenticationRequestEntity request = request(authReqId);
        if (!request.getRegisteredClientId().equals(registeredClientId)) {
            throw oauthError(OAuth2ErrorCodes.INVALID_GRANT, "The auth_req_id is not valid");
        }
        if (ClientSecuritySettings.CIBA_PUSH.equals(request.getDeliveryMode())) {
            throw oauthError(
                    OAuth2ErrorCodes.INVALID_GRANT,
                    "The auth_req_id uses push delivery and cannot be polled");
        }
        Instant now = Instant.now();
        expireIfNecessary(request, now);
        return switch (request.getStatus()) {
            case PENDING -> pending(request, now);
            case APPROVED -> request;
            case DENIED -> throw oauthError(ACCESS_DENIED, "The user denied the request");
            case EXPIRED -> throw oauthError("expired_token", "The auth_req_id has expired");
            case CONSUMED ->
                    throw oauthError(
                            OAuth2ErrorCodes.INVALID_GRANT, "The auth_req_id was consumed");
        };
    }

    @Transactional
    public void consume(CibaAuthenticationRequestEntity request) {
        request.setStatus(CibaAuthenticationRequestStatus.CONSUMED);
        request.setConsumedAt(Instant.now());
        requestRepository.save(request);
    }

    public boolean deliverPush(
            CibaAuthenticationRequestEntity request, java.util.Map<String, Object> tokenResponse) {
        return ClientSecuritySettings.CIBA_PUSH.equals(request.getDeliveryMode())
                && notificationService.deliverPush(request, tokenResponse);
    }

    @Transactional(readOnly = true)
    public Page<CibaPendingRequestDTO> pendingRequests(String username, Pageable pageable) {
        return requestRepository
                .findByPrincipalNameAndStatusAndExpiresAtAfter(
                        username, CibaAuthenticationRequestStatus.PENDING, Instant.now(), pageable)
                .map(
                        request ->
                                new CibaPendingRequestDTO(
                                        request.getAuthReqId(),
                                        request.getUserCode(),
                                        request.getBindingMessage(),
                                        request.getAuthorizedScopes(),
                                        request.getDeliveryMode(),
                                        request.getCreatedAt(),
                                        request.getExpiresAt(),
                                        request.getStatus(),
                                        request.isMfaRequired(),
                                        request.isStepUpRequired()));
    }

    private static String resolveDeliveryMode(
            RegisteredClient client, String requestedDeliveryMode, AdminCibaPolicyDTO policy) {
        String configuredMode = ClientSecuritySettings.cibaDeliveryMode(client);
        String resolvedMode;
        if (!StringUtils.hasText(requestedDeliveryMode)) {
            resolvedMode = configuredMode;
        } else {
            String requested = requestedDeliveryMode.trim().toLowerCase(java.util.Locale.ROOT);
            if (!ClientSecuritySettings.CIBA_DELIVERY_MODES.contains(requested)) {
                throw protocol(INVALID_REQUEST, "Unsupported CIBA token delivery mode");
            }
            if (!configuredMode.equals(requested)) {
                throw protocol(
                        INVALID_REQUEST,
                        "The requested delivery mode is not registered for the client");
            }
            resolvedMode = requested;
        }
        if (!"all".equals(policy.deliveryMode()) && !policy.deliveryMode().equals(resolvedMode)) {
            throw protocol(INVALID_REQUEST, "The delivery mode is disabled by CIBA policy");
        }
        return resolvedMode;
    }

    private AdminCibaPolicyDTO policy() {
        return policyService == null ? AdminCibaPolicyDTO.defaults() : policyService.get();
    }

    private static boolean isHttpUri(String value) {
        if (!StringUtils.hasText(value)) {
            return false;
        }
        try {
            URI uri = URI.create(value);
            return uri.getHost() != null
                    && ("http".equalsIgnoreCase(uri.getScheme())
                            || "https".equalsIgnoreCase(uri.getScheme()))
                    && uri.getFragment() == null;
        } catch (IllegalArgumentException _) {
            return false;
        }
    }

    private static boolean isValidNotificationToken(String value) {
        return StringUtils.hasText(value)
                && value.length() <= 1024
                && value.chars().allMatch(character -> character >= 0x21 && character <= 0x7e);
    }

    private static String normalizeAcrValues(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String normalized = value.trim().replaceAll("\\s+", " ");
        if (normalized.length() > 1000) {
            throw protocol(INVALID_REQUEST, "acr_values is too long");
        }
        return normalized;
    }

    private CibaAuthenticationRequestEntity pending(
            CibaAuthenticationRequestEntity request, Instant now) {
        Instant lastPolledAt = request.getLastPolledAt();
        if (lastPolledAt != null
                && now.isBefore(lastPolledAt.plusSeconds(request.getIntervalSeconds()))) {
            throw oauthError("slow_down", "Polling interval has not elapsed");
        }
        request.setLastPolledAt(now);
        requestRepository.save(request);
        throw oauthError("authorization_pending", "The user has not approved the request");
    }

    private CibaAuthenticationRequestEntity request(String authReqId) {
        return requestRepository
                .findByAuthReqIdForUpdate(authReqId)
                .orElseThrow(
                        () ->
                                oauthError(
                                        OAuth2ErrorCodes.INVALID_GRANT,
                                        "The auth_req_id is not valid"));
    }

    private static void requireCibaGrant(RegisteredClient client) {
        if (client.getAuthorizationGrantTypes().stream()
                .noneMatch(grant -> AuthorizationGrantTypes.CIBA.equals(grant.getValue()))) {
            throw protocol("unauthorized_client", "The client is not allowed to use CIBA");
        }
    }

    private static String requireLoginHint(String loginHint) {
        if (!StringUtils.hasText(loginHint) || loginHint.length() > 200) {
            throw protocol(INVALID_REQUEST, "login_hint is required");
        }
        return loginHint.trim();
    }

    private String resolveUserCode(String requestedUserCode) {
        if (StringUtils.hasText(requestedUserCode)) {
            String normalized = requestedUserCode.trim().toUpperCase(java.util.Locale.ROOT);
            if (!normalized.matches("[A-Z0-9]{4,32}")) {
                throw protocol(INVALID_REQUEST, "user_code must contain 4 to 32 letters or digits");
            }
            if (requestRepository.existsByUserCode(normalized)) {
                throw protocol(INVALID_REQUEST, "user_code is already in use");
            }
            return normalized;
        }
        for (int attempt = 0; attempt < 10; attempt++) {
            String generated = generateUserCode();
            if (!requestRepository.existsByUserCode(generated)) {
                return generated;
            }
        }
        throw protocol("server_error", "Unable to allocate a CIBA user code");
    }

    private static String generateUserCode() {
        StringBuilder code = new StringBuilder(USER_CODE_LENGTH);
        for (int index = 0; index < USER_CODE_LENGTH; index++) {
            code.append(USER_CODE_ALPHABET.charAt(RANDOM.nextInt(USER_CODE_ALPHABET.length())));
        }
        return code.toString();
    }

    private static void ensureUserCode(
            CibaAuthenticationRequestEntity request, String suppliedUserCode) {
        if (StringUtils.hasText(suppliedUserCode)
                && !request.getUserCode().equalsIgnoreCase(suppliedUserCode.trim())) {
            throw protocol(ACCESS_DENIED, "The user_code does not match the request");
        }
    }

    private static Set<String> parseScopes(String scope) {
        if (!StringUtils.hasText(scope)) {
            throw protocol(INVALID_SCOPE, "scope is required");
        }
        Set<String> scopes =
                new LinkedHashSet<>(StringUtils.commaDelimitedListToSet(scope.replace(' ', ',')));
        scopes.removeIf(String::isBlank);
        if (scopes.isEmpty()) {
            throw protocol(INVALID_SCOPE, "scope is required");
        }
        return scopes;
    }

    private void expireIfNecessary(CibaAuthenticationRequestEntity request, Instant now) {
        if (now.isBefore(request.getExpiresAt())
                || request.getStatus() == CibaAuthenticationRequestStatus.CONSUMED
                || request.getStatus() == CibaAuthenticationRequestStatus.EXPIRED) {
            return;
        }
        request.setStatus(CibaAuthenticationRequestStatus.EXPIRED);
        requestRepository.save(request);
    }

    private static void ensureOwner(CibaAuthenticationRequestEntity request, String username) {
        if (!request.getPrincipalName().equals(username)) {
            throw protocol(ACCESS_DENIED, "The request belongs to another user");
        }
    }

    private static void ensureActionable(CibaAuthenticationRequestEntity request, String message) {
        if (request.getStatus() == CibaAuthenticationRequestStatus.EXPIRED
                || request.getStatus() == CibaAuthenticationRequestStatus.CONSUMED) {
            throw protocol(INVALID_REQUEST, message);
        }
    }

    private static String newAuthReqId() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes) + UUID.randomUUID();
    }

    private static CibaProtocolException protocol(String error, String message) {
        return new CibaProtocolException(error, message, HttpStatus.BAD_REQUEST);
    }

    private static OAuth2AuthenticationException oauthError(String code, String message) {
        return new OAuth2AuthenticationException(
                new OAuth2Error(
                        code,
                        message,
                        "https://openid.net/specs/openid-client-initiated-backchannel-authentication-core-1_0.html"));
    }

    private record CibaRequestObjectParameters(
            String scope,
            String loginHint,
            String loginHintToken,
            String idTokenHint,
            String bindingMessage,
            Integer requestedExpiry,
            String deliveryMode,
            String userCode,
            String clientNotificationToken,
            String acrValues) {

        private static CibaRequestObjectParameters empty() {
            return new CibaRequestObjectParameters(
                    null, null, null, null, null, null, null, null, null, null);
        }
    }
}
