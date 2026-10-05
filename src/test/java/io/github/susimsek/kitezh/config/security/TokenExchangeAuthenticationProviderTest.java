package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import io.github.susimsek.kitezh.security.ClientSecuritySettings;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsentService;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2TokenExchangeAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;

class TokenExchangeAuthenticationProviderTest {

    private final OAuth2AuthorizationService authorizationService =
            mock(OAuth2AuthorizationService.class);
    private final RegisteredClientRepository clientRepository =
            mock(RegisteredClientRepository.class);
    private final OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator =
            mock(OAuth2TokenGenerator.class);

    @Test
    void rejectsPublicClients() {
        RegisteredClient client = client("client", ClientAuthenticationMethod.NONE);
        OAuth2TokenExchangeAuthenticationToken request = request(client, null, Set.of());
        TokenExchangeAuthenticationProvider provider = provider();

        assertThatThrownBy(() -> provider.authenticate(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertThat(((OAuth2AuthenticationException) exception).getError())
                                        .extracting(OAuth2Error::getErrorCode)
                                        .isEqualTo("unauthorized_client"));
    }

    @Test
    void rejectsActorTokensWhenDelegationIsDisabled() {
        RegisteredClient client = client("client", ClientAuthenticationMethod.CLIENT_SECRET_BASIC);
        OAuth2TokenExchangeAuthenticationToken request = request(client, "actor", Set.of());
        TokenExchangeAuthenticationProvider provider = provider();

        assertThatThrownBy(() -> provider.authenticate(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertThat(((OAuth2AuthenticationException) exception).getError())
                                        .extracting(OAuth2Error::getErrorCode)
                                        .isEqualTo("access_denied"));
    }

    @Test
    void rejectsRequestedSubjectBecauseStandardExchangeDoesNotImpersonateUsers() {
        RegisteredClient client = client("client", ClientAuthenticationMethod.CLIENT_SECRET_BASIC);
        OAuth2TokenExchangeAuthenticationToken request =
                new OAuth2TokenExchangeAuthenticationToken(
                        "urn:ietf:params:oauth:token-type:access_token",
                        "subject",
                        "urn:ietf:params:oauth:token-type:access_token",
                        authenticatedClient(client),
                        null,
                        null,
                        null,
                        null,
                        null,
                        Map.of("requested_subject", "admin"));
        TokenExchangeAuthenticationProvider provider = provider();

        assertThatThrownBy(() -> provider.authenticate(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertThat(((OAuth2AuthenticationException) exception).getError())
                                        .extracting(OAuth2Error::getErrorCode)
                                        .isEqualTo("invalid_request"));
    }

    @Test
    void rejectsAudienceOutsideTheClientPolicy() {
        RegisteredClient client =
                RegisteredClient.from(
                                client("client", ClientAuthenticationMethod.CLIENT_SECRET_BASIC))
                        .clientSettings(
                                org.springframework.security.oauth2.server.authorization.settings
                                        .ClientSettings.withSettings(
                                                Map.of(
                                                        ClientSecuritySettings
                                                                .TOKEN_EXCHANGE_ALLOWED_AUDIENCES,
                                                        Set.of("reports-api")))
                                        .build())
                        .build();
        OAuth2TokenExchangeAuthenticationToken request =
                request(client, null, Set.of("unknown-api"));
        OAuth2Authorization authorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .principalName("admin")
                        .build();
        when(authorizationService.findByToken(
                        "subject",
                        org.springframework.security.oauth2.server.authorization.OAuth2TokenType
                                .ACCESS_TOKEN))
                .thenReturn(authorization);
        when(clientRepository.findByClientId("unknown-api")).thenReturn(null);
        TokenExchangeAuthenticationProvider provider = provider();

        assertThatThrownBy(() -> provider.authenticate(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertThat(((OAuth2AuthenticationException) exception).getError())
                                        .extracting(OAuth2Error::getErrorCode)
                                        .isEqualTo("invalid_target"));
    }

    @Test
    void rejectsTargetThatDoesNotOptIntoTokenExchange() {
        RegisteredClient client =
                RegisteredClient.from(
                                client("client", ClientAuthenticationMethod.CLIENT_SECRET_BASIC))
                        .clientSettings(
                                ClientSettings.withSettings(
                                                Map.of(
                                                        ClientSecuritySettings
                                                                .TOKEN_EXCHANGE_ALLOWED_AUDIENCES,
                                                        Set.of("reports-api")))
                                        .build())
                        .build();
        RegisteredClient target =
                RegisteredClient.withId("reports-id")
                        .clientId("reports-api")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .build();
        OAuth2TokenExchangeAuthenticationToken request =
                request(client, null, Set.of("reports-api"));
        OAuth2Authorization authorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .principalName("admin")
                        .build();
        when(authorizationService.findByToken(
                        "subject",
                        org.springframework.security.oauth2.server.authorization.OAuth2TokenType
                                .ACCESS_TOKEN))
                .thenReturn(authorization);
        when(clientRepository.findByClientId("reports-api")).thenReturn(target);
        TokenExchangeAuthenticationProvider provider = provider();

        assertThatThrownBy(() -> provider.authenticate(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertThat(((OAuth2AuthenticationException) exception).getError())
                                        .extracting(OAuth2Error::getErrorCode)
                                        .isEqualTo("invalid_target"));
    }

    @Test
    void requiresConsentForUserAuthorizationExchange() {
        RegisteredClient client =
                RegisteredClient.from(
                                client("client", ClientAuthenticationMethod.CLIENT_SECRET_BASIC))
                        .clientSettings(
                                ClientSettings.builder().requireAuthorizationConsent(true).build())
                        .build();
        OAuth2Authorization authorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .principalName("admin")
                        .authorizedScopes(Set.of("openid"))
                        .build();
        when(authorizationService.findByToken(
                        "subject",
                        org.springframework.security.oauth2.server.authorization.OAuth2TokenType
                                .ACCESS_TOKEN))
                .thenReturn(authorization);
        OAuth2AuthorizationConsentService consentService =
                mock(OAuth2AuthorizationConsentService.class);
        TokenExchangeAuthenticationProvider provider =
                new TokenExchangeAuthenticationProvider(
                        authorizationService, clientRepository, consentService, tokenGenerator);
        OAuth2TokenExchangeAuthenticationToken request = request(client, null, Set.of());

        assertThatThrownBy(() -> provider.authenticate(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertThat(((OAuth2AuthenticationException) exception).getError())
                                        .extracting(OAuth2Error::getErrorCode)
                                        .isEqualTo("access_denied"));
    }

    private TokenExchangeAuthenticationProvider provider() {
        return new TokenExchangeAuthenticationProvider(
                authorizationService, clientRepository, tokenGenerator);
    }

    private static OAuth2TokenExchangeAuthenticationToken request(
            RegisteredClient client, String actorToken, Set<String> audiences) {
        return new OAuth2TokenExchangeAuthenticationToken(
                "urn:ietf:params:oauth:token-type:access_token",
                "subject",
                "urn:ietf:params:oauth:token-type:access_token",
                authenticatedClient(client),
                actorToken,
                actorToken == null ? null : "urn:ietf:params:oauth:token-type:access_token",
                null,
                audiences,
                Set.of(),
                Map.of());
    }

    private static OAuth2ClientAuthenticationToken authenticatedClient(RegisteredClient client) {
        return new OAuth2ClientAuthenticationToken(
                client, ClientAuthenticationMethod.CLIENT_SECRET_BASIC, "secret");
    }

    private static RegisteredClient client(String clientId, ClientAuthenticationMethod method) {
        return RegisteredClient.withId(clientId + "-id")
                .clientId(clientId)
                .clientAuthenticationMethod(method)
                .authorizationGrantType(
                        new org.springframework.security.oauth2.core.AuthorizationGrantType(
                                AuthorizationGrantTypes.TOKEN_EXCHANGE))
                .scope("openid")
                .build();
    }
}
