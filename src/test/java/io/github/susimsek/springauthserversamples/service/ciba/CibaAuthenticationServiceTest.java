package io.github.susimsek.springauthserversamples.service.ciba;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestEntity;
import io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestStatus;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminCibaPolicyDTO;
import io.github.susimsek.springauthserversamples.repository.CibaAuthenticationRequestRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.security.AuthorizationGrantTypes;
import io.github.susimsek.springauthserversamples.security.ClientSecuritySettings;
import io.github.susimsek.springauthserversamples.service.admin.CibaPolicyService;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;

class CibaAuthenticationServiceTest {

    private final CibaAuthenticationRequestRepository requestRepository =
            mock(CibaAuthenticationRequestRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final CibaAuthenticationService service =
            new CibaAuthenticationService(requestRepository, userRepository);
    private final RegisteredClient client = client();

    @BeforeEach
    void resetDefaults() {
        when(requestRepository.save(any(CibaAuthenticationRequestEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void supportsNotificationAndPushTokenConstructor() {
        CibaAuthenticationService configuredService =
                new CibaAuthenticationService(
                        requestRepository, userRepository, new CibaNotificationService(), null);

        assertThat(configuredService).isNotNull();
    }

    @Test
    void createsRequestWithDefaultsAndNormalizedScopes() {
        UserEntity user = new UserEntity();
        user.setUsername(" admin ");
        user.setEnabled(true);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));

        CibaAuthenticationRequestEntity request =
                service.create(client, "openid profile openid", " admin ", "Approve", null);

        assertThat(request.getAuthReqId()).hasSizeGreaterThan(40);
        assertThat(request.getRegisteredClientId()).isEqualTo("client-id");
        assertThat(request.getPrincipalName()).isEqualTo("admin");
        assertThat(request.getAuthorizedScopes()).isEqualTo("openid profile");
        assertThat(request.getStatus()).isEqualTo(CibaAuthenticationRequestStatus.PENDING);
        assertThat(request.getIntervalSeconds()).isEqualTo(5);
        assertThat(request.getExpiresAt()).isEqualTo(request.getCreatedAt().plusSeconds(300));
        verify(requestRepository).save(request);
    }

    @Test
    void createsAndValidatesUserCode() {
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        user.setEnabled(true);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));

        CibaAuthenticationRequestEntity request =
                service.create(
                        client,
                        "openid",
                        "admin",
                        null,
                        null,
                        "Approve",
                        null,
                        null,
                        "k7p4m2q9",
                        null);

        assertThat(request.getUserCode()).isEqualTo("K7P4M2Q9");
        when(requestRepository.existsByUserCode("TAKEN")).thenReturn(true);
        assertProtocol(
                () ->
                        service.create(
                                client, "openid", "admin", null, null, null, null, null, "TAKEN",
                                null),
                "invalid_request");
        assertProtocol(
                () ->
                        service.create(
                                client,
                                "openid",
                                "admin",
                                null,
                                null,
                                null,
                                null,
                                null,
                                "bad code",
                                null),
                "invalid_request");
    }

    @Test
    void listsOnlyPendingRequestsForTheAuthenticatedUser() {
        CibaAuthenticationRequestEntity request = request("admin", Instant.now().plusSeconds(60));
        request.setUserCode("K7P4M2Q9");
        when(requestRepository.findByPrincipalNameAndStatusAndExpiresAtAfter(
                        any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(request)));

        var result = service.pendingRequests("admin", PageRequest.of(0, 20));

        assertThat(result.getContent())
                .singleElement()
                .satisfies(
                        pending -> {
                            assertThat(pending.userCode()).isEqualTo("K7P4M2Q9");
                            assertThat(pending.authReqId()).isEqualTo("request");
                        });
    }

    @Test
    void validatesClientUserScopesBindingAndExpiry() {
        assertProtocol(
                () -> service.create(clientWithoutCiba(), "openid", "admin", null, null),
                "unauthorized_client");
        assertProtocol(() -> service.create(client, "openid", "", null, null), "invalid_request");
        when(userRepository.findByUsername("admin")).thenReturn(Optional.empty());
        assertProtocol(
                () -> service.create(client, "openid", "admin", null, null), "invalid_request");
        UserEntity disabled = new UserEntity();
        disabled.setEnabled(false);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(disabled));
        assertProtocol(
                () -> service.create(client, "openid", "admin", null, null), "invalid_request");
        UserEntity enabled = new UserEntity();
        enabled.setEnabled(true);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(enabled));
        assertProtocol(
                () -> service.create(client, "unknown", "admin", null, null), "invalid_scope");
        assertProtocol(
                () -> service.create(client, "openid", "admin", "123456789012345678901", null),
                "invalid_request");
        assertProtocol(() -> service.create(client, "openid", "admin", null, 0), "invalid_request");
        assertProtocol(
                () -> service.create(client, "openid", "admin", null, 3601), "invalid_request");
        assertProtocol(() -> service.create(client, " ", "admin", null, null), "invalid_scope");
    }

    @Test
    void appliesConfiguredPolicyToNewRequestsAndApproval() {
        CibaPolicyService policyService = mock(CibaPolicyService.class);
        when(policyService.get())
                .thenReturn(new AdminCibaPolicyDTO(60, 10, "poll", "required", true, true, "loa2"));
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        user.setEnabled(true);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        CibaAuthenticationService policyAwareService =
                new CibaAuthenticationService(
                        requestRepository,
                        userRepository,
                        new CibaNotificationService(),
                        null,
                        null,
                        policyService);

        CibaAuthenticationRequestEntity request =
                policyAwareService.create(client, "openid", "admin", null, 60);
        assertThat(request.getIntervalSeconds()).isEqualTo(10);
        assertThat(request.getUserVerification()).isEqualTo("required");
        assertThat(request.isMfaRequired()).isTrue();
        assertThat(request.isStepUpRequired()).isTrue();
        assertThat(request.getStepUpAcr()).isEqualTo("loa2");
        assertProtocol(
                () -> policyAwareService.create(client, "openid", "admin", null, 61),
                "invalid_request");

        when(requestRepository.findByAuthReqIdForUpdate(request.getAuthReqId()))
                .thenReturn(Optional.of(request));
        assertProtocol(
                () -> policyAwareService.approve(request.getAuthReqId(), "admin", false, false),
                "access_denied");
        policyAwareService.approve(request.getAuthReqId(), "admin", true, true);
        assertThat(request.getStatus()).isEqualTo(CibaAuthenticationRequestStatus.APPROVED);
    }

    @Test
    void approvalAndDenialRequireOwnerAndPendingState() {
        CibaAuthenticationRequestEntity request = request("admin", Instant.now().plusSeconds(60));
        when(requestRepository.findByAuthReqIdForUpdate("request"))
                .thenReturn(Optional.of(request));

        assertProtocol(() -> service.approve("request", "other"), "access_denied");
        service.approve("request", "admin");
        assertThat(request.getStatus()).isEqualTo(CibaAuthenticationRequestStatus.APPROVED);
        assertThat(request.getApprovedAt()).isNotNull();

        CibaAuthenticationRequestEntity denied = request("admin", Instant.now().plusSeconds(60));
        denied.setUserCode("K7P4M2Q9");
        when(requestRepository.findByAuthReqIdForUpdate("denied")).thenReturn(Optional.of(denied));
        assertProtocol(() -> service.deny("denied", "admin", "wrong-code"), "access_denied");
        service.deny("denied", "admin");
        assertThat(denied.getStatus()).isEqualTo(CibaAuthenticationRequestStatus.DENIED);
        assertThat(denied.getDeniedAt()).isNotNull();
    }

    @Test
    void pollingReturnsProtocolStatesAndEnforcesInterval() {
        CibaAuthenticationRequestEntity request = request("admin", Instant.now().plusSeconds(60));
        when(requestRepository.findByAuthReqIdForUpdate("request"))
                .thenReturn(Optional.of(request));

        assertProtocol(() -> service.poll("request", "wrong-client"), "invalid_grant");
        assertProtocol(() -> service.poll("request", "client-id"), "authorization_pending");
        assertProtocol(() -> service.poll("request", "client-id"), "slow_down");
        request.setStatus(CibaAuthenticationRequestStatus.APPROVED);
        assertThat(service.poll("request", "client-id")).isSameAs(request);
        request.setStatus(CibaAuthenticationRequestStatus.DENIED);
        assertProtocol(() -> service.poll("request", "client-id"), "access_denied");
        request.setStatus(CibaAuthenticationRequestStatus.CONSUMED);
        assertProtocol(() -> service.poll("request", "client-id"), "invalid_grant");
    }

    @Test
    void pingApprovalNotifiesClientAndCanPollAfterNotification() {
        final CibaNotificationService notifications = mock(CibaNotificationService.class);
        final RegisteredClient pingClient = pingClient();
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        user.setEnabled(true);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        CibaAuthenticationService pingService =
                new CibaAuthenticationService(requestRepository, userRepository, notifications);

        CibaAuthenticationRequestEntity request =
                pingService.create(
                        pingClient,
                        "openid",
                        "admin",
                        null,
                        null,
                        null,
                        null,
                        ClientSecuritySettings.CIBA_PING,
                        "notification-token",
                        null,
                        null);
        when(requestRepository.findByAuthReqIdForUpdate(request.getAuthReqId()))
                .thenReturn(Optional.of(request));

        pingService.approve(request.getAuthReqId(), "admin");

        assertThat(request.getDeliveryMode()).isEqualTo(ClientSecuritySettings.CIBA_PING);
        verify(notifications).notifyPing(request);
        assertThat(pingService.poll(request.getAuthReqId(), pingClient.getId())).isSameAs(request);
    }

    @Test
    void resolvesLoginHintTokenAndIdTokenHintAndRequiresOneHint() {
        final JwtDecoder decoder = mock(JwtDecoder.class);
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        user.setEnabled(true);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        when(userRepository.findByEmailIgnoreCase("admin@example.com"))
                .thenReturn(Optional.of(user));
        Instant issuedAt = Instant.now();
        when(decoder.decode("login-token"))
                .thenReturn(
                        Jwt.withTokenValue("login-token")
                                .header("alg", "RS256")
                                .subject("admin")
                                .audience(List.of("demo"))
                                .issuedAt(issuedAt)
                                .expiresAt(issuedAt.plusSeconds(300))
                                .build());
        when(decoder.decode("id-token"))
                .thenReturn(
                        Jwt.withTokenValue("id-token")
                                .header("alg", "RS256")
                                .audience(List.of("demo"))
                                .claim("email", "admin@example.com")
                                .issuedAt(issuedAt)
                                .expiresAt(issuedAt.plusSeconds(300))
                                .build());
        CibaAuthenticationService hintService =
                new CibaAuthenticationService(
                        requestRepository,
                        userRepository,
                        new CibaNotificationService(),
                        null,
                        decoder);

        assertThat(
                        hintService
                                .create(
                                        client(),
                                        "openid",
                                        null,
                                        "login-token",
                                        null,
                                        null,
                                        null,
                                        null)
                                .getPrincipalName())
                .isEqualTo("admin");
        assertThat(
                        hintService
                                .create(
                                        client(),
                                        "openid",
                                        null,
                                        null,
                                        "id-token",
                                        null,
                                        null,
                                        null)
                                .getPrincipalName())
                .isEqualTo("admin");
        assertProtocol(
                () ->
                        hintService.create(
                                client(), "openid", "admin", "login-token", null, null, null, null),
                "invalid_request");
    }

    @Test
    void verifiesSignedRequestObjectAndAppliesClientAlgorithmPolicy() {
        final JwtDecoder decoder = mock(JwtDecoder.class);
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        user.setEnabled(true);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        Instant issuedAt = Instant.now();
        when(decoder.decode("request-jwt"))
                .thenReturn(
                        Jwt.withTokenValue("request-jwt")
                                .header("alg", "RS256")
                                .issuer("demo")
                                .audience(List.of("demo"))
                                .claim("jti", "request-jwt-id")
                                .claim("scope", "openid profile")
                                .claim("login_hint", "admin")
                                .claim("binding_message", "Approve")
                                .claim("requested_expiry", 120)
                                .issuedAt(issuedAt)
                                .notBefore(issuedAt)
                                .expiresAt(issuedAt.plusSeconds(300))
                                .build());
        CibaAuthenticationService requestService =
                new CibaAuthenticationService(
                        requestRepository,
                        userRepository,
                        new CibaNotificationService(),
                        null,
                        decoder);

        CibaAuthenticationRequestEntity request =
                requestService.create(
                        client(), null, null, null, null, null, null, null, "request-jwt");

        assertThat(request.getPrincipalName()).isEqualTo("admin");
        assertThat(request.getAuthorizedScopes()).isEqualTo("openid profile");
        assertThat(request.getBindingMessage()).isEqualTo("Approve");
        assertThat(request.getExpiresAt()).isEqualTo(request.getCreatedAt().plusSeconds(120));
        assertProtocol(
                () ->
                        requestService.create(
                                client(),
                                "openid",
                                "other",
                                null,
                                null,
                                null,
                                null,
                                null,
                                "request-jwt"),
                "invalid_request");

        when(decoder.decode("disallowed-jwt"))
                .thenReturn(
                        Jwt.withTokenValue("disallowed-jwt")
                                .header("alg", "HS256")
                                .audience(List.of("demo"))
                                .claim("scope", "openid")
                                .claim("login_hint", "admin")
                                .issuedAt(issuedAt)
                                .expiresAt(issuedAt.plusSeconds(300))
                                .build());
        assertProtocol(
                () ->
                        requestService.create(
                                client(),
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                "disallowed-jwt"),
                "invalid_request");
    }

    @Test
    void rejectsMalformedSignedRequestObjectsAndKeepsDirectParameters() {
        assertProtocol(
                () ->
                        service.create(
                                client(), "openid", "admin", null, null, null, null, null, "jwt"),
                "invalid_request");

        final JwtDecoder decoder = mock(JwtDecoder.class);
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        user.setEnabled(true);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        CibaAuthenticationService requestService =
                new CibaAuthenticationService(
                        requestRepository,
                        userRepository,
                        new CibaNotificationService(),
                        null,
                        decoder);
        assertThat(
                        requestService
                                .create(
                                        client(), "openid", "admin", null, null, null, null, null,
                                        null)
                                .getPrincipalName())
                .isEqualTo("admin");

        when(decoder.decode("invalid")).thenThrow(new JwtException("invalid"));
        assertProtocol(
                () ->
                        requestService.create(
                                client(), null, null, null, null, null, null, null, "invalid"),
                "invalid_request");
        Instant issuedAt = Instant.now();
        when(decoder.decode("missing-audience"))
                .thenReturn(
                        Jwt.withTokenValue("missing-audience")
                                .header("alg", "RS256")
                                .claim("scope", "openid")
                                .claim("login_hint", "admin")
                                .issuedAt(issuedAt)
                                .expiresAt(issuedAt.plusSeconds(300))
                                .build());
        assertProtocol(
                () ->
                        requestService.create(
                                client(),
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                "missing-audience"),
                "invalid_request");
        when(decoder.decode("invalid-claim"))
                .thenReturn(
                        Jwt.withTokenValue("invalid-claim")
                                .header("alg", "RS256")
                                .audience(List.of("demo"))
                                .claim("scope", 42)
                                .issuedAt(issuedAt)
                                .expiresAt(issuedAt.plusSeconds(300))
                                .build());
        assertProtocol(
                () ->
                        requestService.create(
                                client(),
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                "invalid-claim"),
                "invalid_request");

        RegisteredClient customAlgorithmClient =
                RegisteredClient.withId("custom-client-id")
                        .clientId("custom-client")
                        .authorizationGrantType(
                                new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                        .scope("openid")
                        .clientSettings(
                                ClientSettings.builder()
                                        .setting(
                                                ClientSecuritySettings
                                                        .CIBA_REQUEST_SIGNING_ALGORITHMS,
                                                Set.of("HS256"))
                                        .build())
                        .build();
        when(decoder.decode("custom-algorithm"))
                .thenReturn(
                        Jwt.withTokenValue("custom-algorithm")
                                .header("alg", "HS256")
                                .issuer("custom-client")
                                .audience(List.of("custom-client"))
                                .claim("jti", "custom-request-id")
                                .claim("scope", "openid")
                                .claim("login_hint", "admin")
                                .issuedAt(issuedAt)
                                .notBefore(issuedAt)
                                .expiresAt(issuedAt.plusSeconds(300))
                                .build());
        assertThat(
                        requestService
                                .create(
                                        customAlgorithmClient,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        "custom-algorithm")
                                .getPrincipalName())
                .isEqualTo("admin");
    }

    @Test
    void expiresMissingAndExpiredRequestsAndConsumesApprovedRequest() {
        CibaAuthenticationRequestEntity expired = request("admin", Instant.now().minusSeconds(1));
        when(requestRepository.findByAuthReqIdForUpdate("expired"))
                .thenReturn(Optional.of(expired));
        assertProtocol(() -> service.poll("expired", "client-id"), "expired_token");
        assertThat(expired.getStatus()).isEqualTo(CibaAuthenticationRequestStatus.EXPIRED);
        assertProtocol(() -> service.poll("missing", "client-id"), "invalid_grant");
        when(requestRepository.findByAuthReqIdForUpdate("missing")).thenReturn(Optional.empty());

        CibaAuthenticationRequestEntity request = request("admin", Instant.now().plusSeconds(60));
        service.consume(request);
        assertThat(request.getStatus()).isEqualTo(CibaAuthenticationRequestStatus.CONSUMED);
        assertThat(request.getConsumedAt()).isNotNull();
    }

    private static RegisteredClient client() {
        return RegisteredClient.withId("client-id")
                .clientId("demo")
                .authorizationGrantType(new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                .scope("openid")
                .scope("profile")
                .build();
    }

    private static RegisteredClient clientWithoutCiba() {
        return RegisteredClient.withId("client-id")
                .clientId("demo")
                .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                .scope("openid")
                .build();
    }

    private static RegisteredClient pingClient() {
        return RegisteredClient.withId("client-id")
                .clientId("demo")
                .authorizationGrantType(new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                .scope("openid")
                .clientSettings(
                        ClientSettings.builder()
                                .setting(ClientSecuritySettings.CIBA_DELIVERY_MODE, "ping")
                                .setting(
                                        ClientSecuritySettings.CIBA_NOTIFICATION_ENDPOINT,
                                        "https://client.example/ciba/notify")
                                .setting(
                                        ClientSecuritySettings.CIBA_CLIENT_NOTIFICATION_TOKEN,
                                        "notification-token")
                                .build())
                .build();
    }

    private static CibaAuthenticationRequestEntity request(String user, Instant expiresAt) {
        return new CibaAuthenticationRequestEntity(
                "request", "client-id", user, "openid", null, Instant.now(), expiresAt, 5);
    }

    private static void assertProtocol(ThrowingOperation operation, String error) {
        assertThatThrownBy(operation::run)
                .isInstanceOfAny(CibaProtocolException.class, OAuth2AuthenticationException.class)
                .satisfies(
                        exception -> {
                            if (exception instanceof CibaProtocolException ciba) {
                                assertThat(ciba.error()).isEqualTo(error);
                            } else {
                                OAuth2AuthenticationException oauth =
                                        (OAuth2AuthenticationException) exception;
                                assertThat(oauth.getError().getErrorCode()).isEqualTo(error);
                            }
                        });
    }

    @FunctionalInterface
    private interface ThrowingOperation {
        void run();
    }
}
