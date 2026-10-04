package io.github.susimsek.kitezh.service.ciba;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.util.ReflectionTestUtils.invokeMethod;

import io.github.susimsek.kitezh.config.security.SocialLoginSecretCipher;
import io.github.susimsek.kitezh.domain.CibaAuthenticationRequestEntity;
import io.github.susimsek.kitezh.domain.CibaAuthenticationRequestStatus;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminCibaPolicyDTO;
import io.github.susimsek.kitezh.repository.CibaAuthenticationRequestRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import io.github.susimsek.kitezh.security.ClientSecuritySettings;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;

class CibaAuthenticationServicePrivateTest {

    private final CibaAuthenticationRequestRepository requestRepository =
            Mockito.mock(CibaAuthenticationRequestRepository.class);
    private final UserRepository userRepository = Mockito.mock(UserRepository.class);
    private final CibaAuthenticationService service =
            CibaTestSupport.service(requestRepository, userRepository);

    @Test
    void coversRequestClaimAndMergeValidationBranches() {
        assertThat(invokeStatic("stringClaim", Map.of(), "scope")).isNull();
        assertThat(invokeStatic("stringClaim", Map.of("scope", "openid"), "scope"))
                .isEqualTo("openid");
        assertThat(invokeStatic("stringClaim", Map.of("scope", 1), "scope"))
                .isInstanceOf(CibaProtocolException.class);

        assertThat(invokeStatic("integerClaim", Map.of(), "requested_expiry")).isNull();
        assertThat(invokeStatic("integerClaim", Map.of("requested_expiry", 10), "requested_expiry"))
                .isEqualTo(10);
        assertThat(
                        invokeStatic(
                                "integerClaim",
                                Map.of("requested_expiry", Integer.MAX_VALUE + 1L),
                                "requested_expiry"))
                .isInstanceOf(CibaProtocolException.class);
        assertThat(
                        invokeStatic(
                                "integerClaim",
                                Map.of("requested_expiry", "10"),
                                "requested_expiry"))
                .isEqualTo(10);
        assertThat(
                        invokeStatic(
                                "integerClaim",
                                Map.of("requested_expiry", "bad"),
                                "requested_expiry"))
                .isInstanceOf(CibaProtocolException.class);
        assertThat(
                        invokeStatic(
                                "integerClaim",
                                Map.of("requested_expiry", true),
                                "requested_expiry"))
                .isInstanceOf(CibaProtocolException.class);

        assertThat(invokeStatic("mergeString", "scope", "openid", "openid")).isEqualTo("openid");
        assertThat(invokeStatic("mergeString", "scope", null, "openid")).isEqualTo("openid");
        assertThat(invokeStatic("mergeString", "scope", "openid", null)).isEqualTo("openid");
        assertThat(invokeStatic("mergeString", "scope", "one", "two"))
                .isInstanceOf(CibaProtocolException.class);
        assertThat(invokeStatic("mergeInteger", "expiry", 10, 10)).isEqualTo(10);
        assertThat(invokeStatic("mergeInteger", "expiry", null, 10)).isEqualTo(10);
        assertThat(invokeStatic("mergeInteger", "expiry", 10, null)).isEqualTo(10);
        assertThat(invokeStatic("mergeInteger", "expiry", 10, 20))
                .isInstanceOf(CibaProtocolException.class);
    }

    @Test
    void coversScopeUriAndUserCodeValidationBranches() {
        assertThat(invokeStatic("parseScopes", "openid profile"))
                .isEqualTo(Set.of("openid", "profile"));
        assertThat(invokeStatic("parseScopes", "openid,, profile"))
                .isEqualTo(Set.of("openid", "profile"));
        assertThat(invokeStatic("parseScopes", (Object) null))
                .isInstanceOf(CibaProtocolException.class);
        assertThat(invokeStatic("parseScopes", " , ")).isInstanceOf(CibaProtocolException.class);

        assertThat(invokeStatic("isHttpUri", "https://client.example/ciba")).isEqualTo(true);
        assertThat(invokeStatic("isHttpUri", "http://client.example/ciba#fragment"))
                .isEqualTo(false);
        assertThat(invokeStatic("isHttpUri", "file:///tmp/ciba")).isEqualTo(false);
        assertThat(invokeStatic("isHttpUri", "ftp://client.example/ciba")).isEqualTo(false);
        assertThat(invokeStatic("isHttpUri", "not a uri")).isEqualTo(false);
        assertThat(invokeStatic("isHttpUri", " ")).isEqualTo(false);

        assertThat(invokeStatic("requireLoginHint", " admin ")).isEqualTo("admin");
        assertThat(invokeStatic("requireLoginHint", " ")).isInstanceOf(CibaProtocolException.class);
        assertThat(invokeStatic("requireLoginHint", "x".repeat(201)))
                .isInstanceOf(CibaProtocolException.class);

        assertThat(invokeStatic("generateUserCode")).isInstanceOf(String.class);
        CibaAuthenticationRequestEntity request = new CibaAuthenticationRequestEntity();
        request.setUserCode("ABCD");
        assertThat(invokeStatic("ensureUserCode", request, "abcd")).isNull();
        assertThat(invokeStatic("ensureUserCode", request, "different"))
                .isInstanceOf(CibaProtocolException.class);
        assertThat(invokeStatic("ensureUserCode", request, (Object) null)).isNull();
    }

    @Test
    void coversRequestExpiryAndActionabilityBranches() {
        CibaAuthenticationRequestEntity request = new CibaAuthenticationRequestEntity();
        request.setExpiresAt(Instant.now().minusSeconds(1));
        request.setStatus(CibaAuthenticationRequestStatus.PENDING);
        assertThat((Object) invokeMethod(service, "expireIfNecessary", request, Instant.now()))
                .isNull();
        assertThat(request.getStatus()).isEqualTo(CibaAuthenticationRequestStatus.EXPIRED);

        request.setStatus(CibaAuthenticationRequestStatus.CONSUMED);
        request.setExpiresAt(Instant.now().plusSeconds(60));
        assertThat((Object) invokeMethod(service, "expireIfNecessary", request, Instant.now()))
                .isNull();
        request.setStatus(CibaAuthenticationRequestStatus.PENDING);
        assertThat(invokeStatic("ensureActionable", request, "message")).isNull();

        request.setStatus(CibaAuthenticationRequestStatus.EXPIRED);
        assertThat(invokeStatic("ensureActionable", request, "message"))
                .isInstanceOf(CibaProtocolException.class);
        request.setPrincipalName("admin");
        assertThat(invokeStatic("ensureOwner", request, "other"))
                .isInstanceOf(CibaProtocolException.class);
        assertThat(invokeStatic("ensureOwner", request, "admin")).isNull();
    }

    @Test
    void coversDeliveryModeAndTokenClaimResolutionBranches() {
        RegisteredClient client =
                RegisteredClient.withId("client-id")
                        .clientId("client")
                        .authorizationGrantType(
                                new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                        .clientSettings(
                                ClientSettings.builder()
                                        .setting(ClientSecuritySettings.CIBA_DELIVERY_MODE, "poll")
                                        .build())
                        .build();
        assertThat(invokeStatic("resolveDeliveryMode", client, null, AdminCibaPolicyDTO.defaults()))
                .isEqualTo("poll");
        assertThat(
                        invokeStatic(
                                "resolveDeliveryMode",
                                client,
                                " poll ",
                                AdminCibaPolicyDTO.defaults()))
                .isEqualTo("poll");
        assertThat(
                        invokeStatic(
                                "resolveDeliveryMode",
                                client,
                                "invalid",
                                AdminCibaPolicyDTO.defaults()))
                .isInstanceOf(CibaProtocolException.class);
        assertThat(
                        invokeStatic(
                                "resolveDeliveryMode",
                                client,
                                "ping",
                                AdminCibaPolicyDTO.defaults()))
                .isInstanceOf(CibaProtocolException.class);
        assertThat(
                        invokeStatic(
                                "resolveDeliveryMode",
                                client,
                                null,
                                new AdminCibaPolicyDTO(
                                        300, 5, "ping", "preferred", false, false, null)))
                .isInstanceOf(CibaProtocolException.class);

        UserEntity admin = new UserEntity();
        admin.setUsername("admin");
        admin.setEmail("admin@example.com");
        admin.setEnabled(true);
        Mockito.when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        Mockito.when(userRepository.findByEmailIgnoreCase("admin@example.com"))
                .thenReturn(Optional.of(admin));
        Jwt subjectJwt =
                Jwt.withTokenValue("subject").header("alg", "RS256").subject("admin").build();
        assertThat((Object) invokeMethod(service, "findUserByTokenClaims", subjectJwt))
                .isEqualTo(Optional.of(admin));
        Jwt emailJwt =
                Jwt.withTokenValue("email")
                        .header("alg", "RS256")
                        .subject("admin@example.com")
                        .build();
        assertThat((Object) invokeMethod(service, "findUserByTokenClaims", emailJwt))
                .isEqualTo(Optional.of(admin));
        Jwt claimJwt =
                Jwt.withTokenValue("claim")
                        .header("alg", "RS256")
                        .claim("preferred_username", "admin")
                        .build();
        assertThat((Object) invokeMethod(service, "findUserByTokenClaims", claimJwt))
                .isEqualTo(Optional.of(admin));
        Jwt noUserJwt =
                Jwt.withTokenValue("none").header("alg", "RS256").claim("other", "value").build();
        assertThat((Object) invokeMethod(service, "findUserByTokenClaims", noUserJwt))
                .isEqualTo(Optional.empty());
        Jwt nonStringClaimJwt =
                Jwt.withTokenValue("non-string")
                        .header("alg", "RS256")
                        .claim("preferred_username", 42)
                        .build();
        assertThat((Object) invokeMethod(service, "findUserByTokenClaims", nonStringClaimJwt))
                .isEqualTo(Optional.empty());
        Jwt blankClaimJwt =
                Jwt.withTokenValue("blank-claim")
                        .header("alg", "RS256")
                        .claim("preferred_username", " ")
                        .build();
        assertThat((Object) invokeMethod(service, "findUserByTokenClaims", blankClaimJwt))
                .isEqualTo(Optional.empty());

        Jwt usernameClaimJwt =
                Jwt.withTokenValue("username-claim")
                        .header("alg", "RS256")
                        .claim("username", "admin")
                        .build();
        assertThat((Object) invokeMethod(service, "findUserByTokenClaims", usernameClaimJwt))
                .isEqualTo(Optional.of(admin));
        Jwt emailClaimJwt =
                Jwt.withTokenValue("email-claim")
                        .header("alg", "RS256")
                        .claim("email", "admin@example.com")
                        .build();
        assertThat((Object) invokeMethod(service, "findUserByTokenClaims", emailClaimJwt))
                .isEqualTo(Optional.of(admin));

        assertThat(
                        invokeStatic(
                                "resolveDeliveryMode",
                                client,
                                "poll",
                                new AdminCibaPolicyDTO(
                                        300, 5, "all", "preferred", false, false, null)))
                .isEqualTo("poll");
    }

    @Test
    void coversTokenHintFailureAndNotificationFallbackBranches() {
        var decoder = Mockito.mock(org.springframework.security.oauth2.jwt.JwtDecoder.class);
        CibaAuthenticationService hintService =
                CibaTestSupport.service(
                        requestRepository,
                        userRepository,
                        CibaTestSupport.notificationService(),
                        null,
                        decoder);
        RegisteredClient client =
                RegisteredClient.withId("client-id")
                        .clientId("client")
                        .authorizationGrantType(
                                new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                        .scope("openid")
                        .build();
        Jwt wrongAudience =
                Jwt.withTokenValue("wrong-audience")
                        .header("alg", "RS256")
                        .audience(java.util.List.of("other"))
                        .build();
        Mockito.when(decoder.decode("wrong-audience")).thenReturn(wrongAudience);
        assertThatThrownBy(
                        () ->
                                invokeMethod(
                                        hintService, "resolveTokenUser", client, "wrong-audience"))
                .isInstanceOf(CibaProtocolException.class);
        Mockito.when(decoder.decode("broken"))
                .thenThrow(new org.springframework.security.oauth2.jwt.JwtException("broken"));
        assertThatThrownBy(() -> invokeMethod(hintService, "resolveTokenUser", client, "broken"))
                .isInstanceOf(CibaProtocolException.class);
        assertThatThrownBy(() -> invokeMethod(service, "resolveTokenUser", client, "token"))
                .isInstanceOf(CibaProtocolException.class);

        assertThat((Object) invokeMethod(service, "persistNotificationToken", "token", "push"))
                .isEqualTo("token");
        RegisteredClient jwkClient =
                RegisteredClient.withId("jwk-client")
                        .clientId("jwk-client")
                        .authorizationGrantType(
                                new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                        .clientSettings(
                                ClientSettings.builder()
                                        .jwkSetUrl("https://client.example/jwks")
                                        .build())
                        .build();
        assertThat((Object) invokeMethod(service, "requestObjectDecoder", jwkClient)).isNotNull();
        assertThatThrownBy(() -> invokeMethod(service, "decodeRequestObject", jwkClient, "bad"))
                .isInstanceOf(CibaProtocolException.class);

        Jwt emptyAudience =
                Jwt.withTokenValue("empty-audience")
                        .header("alg", "RS256")
                        .audience(java.util.List.of())
                        .build();
        Mockito.when(decoder.decode("empty-audience")).thenReturn(emptyAudience);
        assertThatThrownBy(
                        () ->
                                invokeMethod(
                                        hintService, "resolveTokenUser", client, "empty-audience"))
                .isInstanceOf(CibaProtocolException.class);
        Jwt nullAudience =
                Jwt.withTokenValue("null-audience")
                        .header("alg", "RS256")
                        .claim("sub", "admin")
                        .build();
        Mockito.when(decoder.decode("null-audience")).thenReturn(nullAudience);
        assertThatThrownBy(
                        () ->
                                invokeMethod(
                                        hintService, "resolveTokenUser", client, "null-audience"))
                .isInstanceOf(CibaProtocolException.class);

        Mockito.when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());
        Mockito.when(userRepository.findByEmailIgnoreCase("missing@example.com"))
                .thenReturn(Optional.empty());
        Jwt missingClaims =
                Jwt.withTokenValue("missing-claims")
                        .header("alg", "RS256")
                        .subject("missing")
                        .claim("email", "missing@example.com")
                        .build();
        assertThat((Object) invokeMethod(service, "findUserByTokenClaims", missingClaims))
                .isEqualTo(Optional.empty());

        CibaAuthenticationRequestEntity protectedRequest = new CibaAuthenticationRequestEntity();
        protectedRequest.setPrincipalName("admin");
        protectedRequest.setExpiresAt(Instant.now().plusSeconds(60));
        protectedRequest.setStatus(CibaAuthenticationRequestStatus.PENDING);
        protectedRequest.setStepUpRequired(true);
        Mockito.when(requestRepository.findByAuthReqIdForUpdate("protected"))
                .thenReturn(Optional.of(protectedRequest));
        assertThatThrownBy(() -> service.approve("protected", "admin"))
                .isInstanceOf(CibaProtocolException.class);

        protectedRequest.setStepUpRequired(false);
        protectedRequest.setUserVerification("required");
        assertThatThrownBy(() -> service.approve("protected", "admin"))
                .isInstanceOf(CibaProtocolException.class);
        service.approve("protected", "admin", true, true);
    }

    @Test
    void coversGeneratedUserCodeExhaustionAndActionableConsumedState() {
        Mockito.when(requestRepository.existsByUserCode(Mockito.anyString())).thenReturn(true);
        assertThatThrownBy(() -> invokeMethod(service, "resolveUserCode", (Object) null))
                .isInstanceOf(CibaProtocolException.class);
        CibaAuthenticationRequestEntity consumed = new CibaAuthenticationRequestEntity();
        consumed.setStatus(CibaAuthenticationRequestStatus.CONSUMED);
        assertThat(invokeStatic("ensureActionable", consumed, "message"))
                .isInstanceOf(CibaProtocolException.class);

        CibaAuthenticationRequestEntity polling = new CibaAuthenticationRequestEntity();
        polling.setLastPolledAt(Instant.now().minusSeconds(60));
        polling.setIntervalSeconds(5);
        Instant pollingNow = Instant.now();
        assertThatThrownBy(() -> invokeMethod(service, "pending", polling, pollingNow))
                .isInstanceOfAny(
                        CibaProtocolException.class,
                        org.springframework.security.oauth2.core.OAuth2AuthenticationException
                                .class);

        CibaAuthenticationRequestEntity consumedExpired = new CibaAuthenticationRequestEntity();
        consumedExpired.setExpiresAt(Instant.now().minusSeconds(1));
        consumedExpired.setStatus(CibaAuthenticationRequestStatus.CONSUMED);
        assertThat(
                        (Object)
                                invokeMethod(
                                        service,
                                        "expireIfNecessary",
                                        consumedExpired,
                                        Instant.now()))
                .isNull();
        CibaAuthenticationRequestEntity alreadyExpired = new CibaAuthenticationRequestEntity();
        alreadyExpired.setExpiresAt(Instant.now().minusSeconds(1));
        alreadyExpired.setStatus(CibaAuthenticationRequestStatus.EXPIRED);
        assertThat(
                        (Object)
                                invokeMethod(
                                        service,
                                        "expireIfNecessary",
                                        alreadyExpired,
                                        Instant.now()))
                .isNull();
    }

    @Test
    void coversNotificationTokenAndAcrValidationBranches() {
        assertThat((Boolean) invokeStatic("isValidNotificationToken", (Object) null)).isFalse();
        assertThat((Boolean) invokeStatic("isValidNotificationToken", " ")).isFalse();
        assertThat((Boolean) invokeStatic("isValidNotificationToken", "token")).isTrue();
        assertThat((Boolean) invokeStatic("isValidNotificationToken", "token\n")).isFalse();
        assertThat((Boolean) invokeStatic("isValidNotificationToken", "token\u007f")).isFalse();
        assertThat((Boolean) invokeStatic("isValidNotificationToken", " token")).isFalse();
        assertThat((Boolean) invokeStatic("isValidNotificationToken", "x".repeat(1025))).isFalse();

        assertThat(invokeStatic("normalizeAcrValues", (Object) null)).isNull();
        assertThat(invokeStatic("normalizeAcrValues", " loa1   loa2 ")).isEqualTo("loa1 loa2");
        assertThat(invokeStatic("normalizeAcrValues", "x".repeat(1001)))
                .isInstanceOf(CibaProtocolException.class);

        SocialLoginSecretCipher cipher = Mockito.mock(SocialLoginSecretCipher.class);
        Mockito.when(cipher.isConfigured()).thenReturn(true);
        Mockito.when(cipher.encrypt("token")).thenReturn("v1:encrypted");
        CibaAuthenticationService encryptedService =
                CibaTestSupport.service(
                        requestRepository,
                        userRepository,
                        CibaTestSupport.notificationService(),
                        null,
                        null,
                        null,
                        null,
                        cipher);
        assertThat(
                        (Object)
                                invokeMethod(
                                        encryptedService,
                                        "persistNotificationToken",
                                        "token",
                                        "ping"))
                .isEqualTo("v1:encrypted");
        assertThat(
                        (Object)
                                invokeMethod(
                                        encryptedService,
                                        "persistNotificationToken",
                                        "token",
                                        "poll"))
                .isNull();
        assertThat((Object) invokeMethod(encryptedService, "persistNotificationToken", " ", "ping"))
                .isNull();

        Mockito.when(cipher.isConfigured()).thenReturn(false);
        assertThatThrownBy(
                        () ->
                                invokeMethod(
                                        encryptedService,
                                        "persistNotificationToken",
                                        "token",
                                        "push"))
                .isInstanceOf(CibaProtocolException.class);
    }

    private static Object invokeStatic(String method, Object... arguments) {
        try {
            Method target =
                    java.util.Arrays.stream(CibaAuthenticationService.class.getDeclaredMethods())
                            .filter(candidate -> candidate.getName().equals(method))
                            .filter(candidate -> candidate.getParameterCount() == arguments.length)
                            .findFirst()
                            .orElseThrow();
            target.setAccessible(true);
            return target.invoke(null, arguments);
        } catch (InvocationTargetException exception) {
            return exception.getCause();
        } catch (ReflectiveOperationException exception) {
            return exception;
        }
    }
}
