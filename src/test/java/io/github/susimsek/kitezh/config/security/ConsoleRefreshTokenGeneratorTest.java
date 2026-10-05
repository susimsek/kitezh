package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.security.OfflineAccessSettings;
import io.github.susimsek.kitezh.service.admin.OfflineAccessPolicyService;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;

class ConsoleRefreshTokenGeneratorTest {

    private final ConsoleRefreshTokenGenerator generator = new ConsoleRefreshTokenGenerator();

    @Test
    void returnsNullForNonRefreshTokenRequests() {
        OAuth2TokenContext context = mock(OAuth2TokenContext.class);
        when(context.getTokenType()).thenReturn(OAuth2TokenType.ACCESS_TOKEN);

        assertThat(generator.generate(context)).isNull();
    }

    @Test
    void delegatesForNonConsoleClients() {
        OAuth2RefreshToken token = generator.generate(context("regular-client"));

        assertThat(token).isNotNull();
    }

    @Test
    void generatesConsoleRefreshTokenWithExpectedTtl() {
        OAuth2RefreshToken token = generator.generate(context("admin-console"));

        assertThat(token).isNotNull();
        assertThat(token.getTokenValue()).isNotBlank();
        assertThat(Duration.between(token.getIssuedAt(), token.getExpiresAt()))
                .isEqualTo(Duration.ofHours(2));
    }

    @Test
    void generatesOfflineRefreshTokensWithApplicationIdleTtlForAnyClient() {
        Duration offlineIdle = Duration.ofDays(30);
        ConsoleRefreshTokenGenerator offlineGenerator =
                new ConsoleRefreshTokenGenerator(offlineIdle);

        OAuth2RefreshToken token =
                offlineGenerator.generate(
                        context("regular-client", Set.of("openid", "offline_access")));

        assertThat(token).isNotNull();
        assertThat(Duration.between(token.getIssuedAt(), token.getExpiresAt()))
                .isEqualTo(offlineIdle);
    }

    @Test
    void appliesOfflinePolicyIdleAndMaximumLifespans() {
        var client = registeredClient("regular-client");
        var policy = mock(OfflineAccessPolicyService.class);
        when(policy.idleTimeout(client)).thenReturn(Duration.ofDays(7));
        when(policy.maxLifespan(client)).thenReturn(Duration.ofDays(30));
        Instant startedAt = Instant.now().minus(Duration.ofDays(29));
        OAuth2Authorization authorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .id("authorization-id")
                        .principalName("admin")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .authorizedScopes(Set.of("openid", "offline_access"))
                        .attribute(OfflineAccessSettings.SESSION_STARTED_AT, startedAt)
                        .build();

        OAuth2RefreshToken token =
                new ConsoleRefreshTokenGenerator(Duration.ofDays(365), policy)
                        .generate(
                                context(client, Set.of("openid", "offline_access"), authorization));

        assertThat(token.getExpiresAt()).isEqualTo(startedAt.plus(Duration.ofDays(30)));
    }

    @Test
    void supportsStringAndFallbackOfflineSessionStartValues() {
        var client = registeredClient("regular-client");
        var policy = mock(OfflineAccessPolicyService.class);
        when(policy.idleTimeout(client)).thenReturn(Duration.ofDays(7));
        when(policy.maxLifespan(client)).thenReturn(null);
        Instant startedAt = Instant.parse("2026-01-01T00:00:00Z");

        OAuth2Authorization stringAuthorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .id("authorization-id")
                        .principalName("admin")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .authorizedScopes(Set.of("openid", "offline_access"))
                        .attribute(OfflineAccessSettings.SESSION_STARTED_AT, startedAt.toString())
                        .build();
        OAuth2RefreshToken stringToken =
                new ConsoleRefreshTokenGenerator(Duration.ofDays(365), policy)
                        .generate(
                                context(
                                        client,
                                        Set.of("openid", "offline_access"),
                                        stringAuthorization));

        OAuth2Authorization invalidAuthorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .id("authorization-id")
                        .principalName("admin")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .authorizedScopes(Set.of("openid", "offline_access"))
                        .attribute(OfflineAccessSettings.SESSION_STARTED_AT, "invalid")
                        .build();
        OAuth2RefreshToken invalidToken =
                new ConsoleRefreshTokenGenerator(Duration.ofDays(365), policy)
                        .generate(
                                context(
                                        client,
                                        Set.of("openid", "offline_access"),
                                        invalidAuthorization));

        assertThat(stringToken.getExpiresAt()).isAfter(startedAt);
        assertThat(Duration.between(invalidToken.getIssuedAt(), invalidToken.getExpiresAt()))
                .isEqualTo(Duration.ofDays(7));
    }

    @Test
    void rejectsInvalidOfflineSessionIdleValues() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new ConsoleRefreshTokenGenerator((Duration) null));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new ConsoleRefreshTokenGenerator(Duration.ZERO));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new ConsoleRefreshTokenGenerator(Duration.ofSeconds(-1)));
    }

    private static OAuth2TokenContext context(String clientId) {
        return context(registeredClient(clientId), Set.of(), null);
    }

    private static OAuth2TokenContext context(String clientId, Set<String> scopes) {
        return context(registeredClient(clientId), scopes, null);
    }

    private static OAuth2TokenContext context(
            RegisteredClient client, Set<String> scopes, OAuth2Authorization authorization) {
        OAuth2TokenContext context = mock(OAuth2TokenContext.class);
        when(context.getTokenType()).thenReturn(OAuth2TokenType.REFRESH_TOKEN);
        when(context.getAuthorizedScopes()).thenReturn(scopes);
        when(context.getRegisteredClient()).thenReturn(client);
        when(context.getAuthorization()).thenReturn(authorization);
        return context;
    }

    private static RegisteredClient registeredClient(String clientId) {
        return RegisteredClient.withId("id")
                .clientId(clientId)
                .clientAuthenticationMethod(
                        org.springframework.security.oauth2.core.ClientAuthenticationMethod.NONE)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .tokenSettings(
                        TokenSettings.builder().refreshTokenTimeToLive(Duration.ofHours(2)).build())
                .build();
    }
}
