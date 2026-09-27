package io.github.susimsek.springauthserversamples.service.ciba;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.util.ReflectionTestUtils.invokeMethod;

import io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminCibaPolicyDTO;
import io.github.susimsek.springauthserversamples.repository.CibaAuthenticationRequestRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.security.AuthorizationGrantTypes;
import io.github.susimsek.springauthserversamples.security.ClientSecuritySettings;
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
            new CibaAuthenticationService(requestRepository, userRepository);

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
        request.setStatus(
                io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestStatus
                        .PENDING);
        assertThat((Object) invokeMethod(service, "expireIfNecessary", request, Instant.now()))
                .isNull();
        assertThat(request.getStatus())
                .isEqualTo(
                        io.github.susimsek.springauthserversamples.domain
                                .CibaAuthenticationRequestStatus.EXPIRED);

        request.setStatus(
                io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestStatus
                        .CONSUMED);
        request.setExpiresAt(Instant.now().plusSeconds(60));
        assertThat((Object) invokeMethod(service, "expireIfNecessary", request, Instant.now()))
                .isNull();
        request.setStatus(
                io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestStatus
                        .PENDING);
        assertThat(invokeStatic("ensureActionable", request, "message")).isNull();

        request.setStatus(
                io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestStatus
                        .EXPIRED);
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
