package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import io.github.susimsek.kitezh.security.ClientSecuritySettings;
import java.security.Principal;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsentService;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AccessTokenAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2TokenExchangeAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContext;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContextHolder;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;

class TokenExchangeAuthenticationProviderTest {

    private final OAuth2AuthorizationService authorizationService =
            mock(OAuth2AuthorizationService.class);
    private final RegisteredClientRepository clientRepository =
            mock(RegisteredClientRepository.class);
    private final OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator =
            mock(OAuth2TokenGenerator.class);

    @AfterEach
    void resetAuthorizationServerContext() {
        AuthorizationServerContextHolder.resetContext();
    }

    @Test
    void issuesAndPersistsARequestedRefreshToken() {
        RegisteredClient client =
                RegisteredClient.from(
                                client("client", ClientAuthenticationMethod.CLIENT_SECRET_BASIC))
                        .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                        .build();
        TestingAuthenticationToken principal = new TestingAuthenticationToken("service", null);
        OAuth2Authorization subjectAuthorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .principalName("service")
                        .attribute(Principal.class.getName(), principal)
                        .authorizedScopes(Set.of(OidcScopes.OPENID))
                        .accessToken(accessToken("subject"))
                        .build();
        OAuth2AccessToken exchangedAccessToken = accessToken("exchanged-access");
        OAuth2Authorization exchangedAuthorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .authorizationGrantType(
                                new AuthorizationGrantType(AuthorizationGrantTypes.TOKEN_EXCHANGE))
                        .principalName("service")
                        .attribute(Principal.class.getName(), principal)
                        .authorizedScopes(Set.of(OidcScopes.OPENID))
                        .accessToken(exchangedAccessToken)
                        .build();
        OAuth2RefreshToken exchangedRefreshToken =
                new OAuth2RefreshToken("exchanged-refresh", Instant.now());
        when(authorizationService.findByToken("subject", OAuth2TokenType.ACCESS_TOKEN))
                .thenReturn(subjectAuthorization);
        when(authorizationService.findByToken("exchanged-access", OAuth2TokenType.ACCESS_TOKEN))
                .thenReturn(exchangedAuthorization);
        when(tokenGenerator.generate(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(
                        invocation -> {
                            var context =
                                    invocation
                                            .<org.springframework.security.oauth2.server
                                                            .authorization.token.OAuth2TokenContext>
                                                    getArgument(0);
                            return OAuth2TokenType.REFRESH_TOKEN.equals(context.getTokenType())
                                    ? exchangedRefreshToken
                                    : exchangedAccessToken;
                        });
        AuthorizationServerContextHolder.setContext(mock(AuthorizationServerContext.class));

        TokenExchangeAuthenticationProvider provider = provider();
        OAuth2TokenExchangeAuthenticationToken request =
                requestWithRequestedType(
                        client,
                        "urn:ietf:params:oauth:token-type:refresh_token",
                        Set.of(OidcScopes.OPENID));

        Authentication result = provider.authenticate(request);

        assertThat(result).isInstanceOf(OAuth2AccessTokenAuthenticationToken.class);
        OAuth2AccessTokenAuthenticationToken accessResult =
                (OAuth2AccessTokenAuthenticationToken) result;
        assertThat(accessResult.getAccessToken().getTokenValue()).isEqualTo("exchanged-access");
        assertThat(accessResult.getRefreshToken()).isSameAs(exchangedRefreshToken);
        verify(authorizationService)
                .save(
                        org.mockito.ArgumentMatchers.argThat(
                                authorization ->
                                        authorization.getRefreshToken() != null
                                                && authorization
                                                        .getRefreshToken()
                                                        .getToken()
                                                        .equals(exchangedRefreshToken)));
    }

    @Test
    void issuesAndReturnsAnIdTokenWhenRequested() {
        RegisteredClient client = client("client", ClientAuthenticationMethod.CLIENT_SECRET_BASIC);
        TestingAuthenticationToken principal = new TestingAuthenticationToken("service", null);
        OAuth2Authorization subjectAuthorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .principalName("service")
                        .attribute(Principal.class.getName(), principal)
                        .authorizedScopes(Set.of(OidcScopes.OPENID))
                        .accessToken(accessToken("subject"))
                        .build();
        OAuth2AccessToken exchangedAccessToken = accessToken("exchanged-access");
        OAuth2Authorization exchangedAuthorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .authorizationGrantType(
                                new AuthorizationGrantType(AuthorizationGrantTypes.TOKEN_EXCHANGE))
                        .principalName("service")
                        .attribute(Principal.class.getName(), principal)
                        .authorizedScopes(Set.of(OidcScopes.OPENID))
                        .accessToken(exchangedAccessToken)
                        .build();
        Instant issuedAt = Instant.now();
        Jwt idToken =
                Jwt.withTokenValue("exchanged-id")
                        .header("alg", "RS256")
                        .issuer("https://issuer.example.test")
                        .subject("service")
                        .issuedAt(issuedAt)
                        .expiresAt(issuedAt.plusSeconds(300))
                        .claim("aud", client.getClientId())
                        .build();
        when(authorizationService.findByToken("subject", OAuth2TokenType.ACCESS_TOKEN))
                .thenReturn(subjectAuthorization);
        when(authorizationService.findByToken("exchanged-access", OAuth2TokenType.ACCESS_TOKEN))
                .thenReturn(exchangedAuthorization);
        when(tokenGenerator.generate(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(
                        invocation -> {
                            var context =
                                    invocation
                                            .<org.springframework.security.oauth2.server
                                                            .authorization.token.OAuth2TokenContext>
                                                    getArgument(0);
                            return OidcParameterNames.ID_TOKEN.equals(
                                            context.getTokenType().getValue())
                                    ? idToken
                                    : exchangedAccessToken;
                        });
        AuthorizationServerContextHolder.setContext(mock(AuthorizationServerContext.class));

        Authentication result =
                provider()
                        .authenticate(
                                requestWithRequestedType(
                                        client,
                                        "urn:ietf:params:oauth:token-type:id_token",
                                        Set.of(OidcScopes.OPENID)));

        assertThat(result).isInstanceOf(OAuth2AccessTokenAuthenticationToken.class);
        OAuth2AccessTokenAuthenticationToken accessResult =
                (OAuth2AccessTokenAuthenticationToken) result;
        assertThat(accessResult.getAdditionalParameters())
                .containsEntry(OidcParameterNames.ID_TOKEN, "exchanged-id");
    }

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
    void rejectsClientsWithoutTheTokenExchangeGrant() {
        RegisteredClient client =
                RegisteredClient.withId("client-id")
                        .clientId("client")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .build();
        TokenExchangeAuthenticationProvider provider = provider();

        assertThatThrownBy(() -> provider.authenticate(request(client, null, Set.of())))
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
    void rejectsAnUnauthenticatedClientPrincipal() {
        OAuth2TokenExchangeAuthenticationToken request =
                new OAuth2TokenExchangeAuthenticationToken(
                        "urn:ietf:params:oauth:token-type:refresh_token",
                        "subject",
                        "urn:ietf:params:oauth:token-type:access_token",
                        new TestingAuthenticationToken("not-a-client", "credentials"),
                        null,
                        null,
                        null,
                        Set.of(),
                        Set.of(),
                        Map.of());
        TokenExchangeAuthenticationProvider provider = provider();

        assertThatThrownBy(() -> provider.authenticate(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertThat(((OAuth2AuthenticationException) exception).getError())
                                        .extracting(OAuth2Error::getErrorCode)
                                        .isEqualTo("invalid_client"));
    }

    @Test
    void rejectsResourceParameters() {
        RegisteredClient client = client("client", ClientAuthenticationMethod.CLIENT_SECRET_BASIC);
        OAuth2TokenExchangeAuthenticationToken request =
                new OAuth2TokenExchangeAuthenticationToken(
                        "urn:ietf:params:oauth:token-type:refresh_token",
                        "subject",
                        "urn:ietf:params:oauth:token-type:access_token",
                        authenticatedClient(client),
                        null,
                        null,
                        Set.of("resource"),
                        Set.of(),
                        Set.of(),
                        Map.of());
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
    void rejectsAnInvalidSubjectToken() {
        RegisteredClient client = client("client", ClientAuthenticationMethod.CLIENT_SECRET_BASIC);
        OAuth2TokenExchangeAuthenticationToken request = request(client, null, Set.of());
        TokenExchangeAuthenticationProvider provider = provider();

        assertThatThrownBy(() -> provider.authenticate(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertThat(((OAuth2AuthenticationException) exception).getError())
                                        .extracting(OAuth2Error::getErrorCode)
                                        .isEqualTo("invalid_grant"));
    }

    @Test
    void rejectsARequestingClientThatIsNotInTheSubjectTokenAudience() {
        RegisteredClient requestingClient =
                client("requester", ClientAuthenticationMethod.CLIENT_SECRET_BASIC);
        RegisteredClient subjectClient =
                RegisteredClient.withId("subject-id")
                        .clientId("subject-client")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .build();
        OAuth2Authorization authorization =
                OAuth2Authorization.withRegisteredClient(subjectClient)
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .principalName("service")
                        .token(
                                new OAuth2AccessToken(
                                        OAuth2AccessToken.TokenType.BEARER,
                                        "subject",
                                        Instant.now(),
                                        Instant.now().plusSeconds(300),
                                        Set.of("openid")))
                        .build();
        when(authorizationService.findByToken(
                        "subject",
                        org.springframework.security.oauth2.server.authorization.OAuth2TokenType
                                .ACCESS_TOKEN))
                .thenReturn(authorization);

        assertThatThrownBy(() -> provider().authenticate(request(requestingClient, null, Set.of())))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertThat(((OAuth2AuthenticationException) exception).getError())
                                        .extracting(OAuth2Error::getErrorCode)
                                        .isEqualTo("access_denied"));
    }

    @Test
    void preventsScopeEscalationForDownscopeOnlyClients() {
        RegisteredClient client =
                RegisteredClient.from(
                                client("client", ClientAuthenticationMethod.CLIENT_SECRET_BASIC))
                        .clientSettings(
                                ClientSettings.withSettings(
                                                Map.of(
                                                        ClientSecuritySettings
                                                                .TOKEN_EXCHANGE_DOWNSCOPE_ONLY,
                                                        true))
                                        .build())
                        .build();
        OAuth2Authorization authorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .principalName("service")
                        .authorizedScopes(Set.of("openid"))
                        .build();
        when(authorizationService.findByToken(
                        "subject",
                        org.springframework.security.oauth2.server.authorization.OAuth2TokenType
                                .ACCESS_TOKEN))
                .thenReturn(authorization);
        OAuth2TokenExchangeAuthenticationToken request = requestWithScopes(client, Set.of("admin"));

        assertThatThrownBy(() -> provider().authenticate(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertThat(((OAuth2AuthenticationException) exception).getError())
                                        .extracting(OAuth2Error::getErrorCode)
                                        .isEqualTo("invalid_scope"));
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
        return requestWithRequestedType(
                client,
                "urn:ietf:params:oauth:token-type:access_token",
                actorToken,
                audiences,
                Set.of());
    }

    private static OAuth2TokenExchangeAuthenticationToken requestWithRequestedType(
            RegisteredClient client, String requestedTokenType, Set<String> scopes) {
        return requestWithRequestedType(client, requestedTokenType, null, Set.of(), scopes);
    }

    private static OAuth2TokenExchangeAuthenticationToken requestWithRequestedType(
            RegisteredClient client,
            String requestedTokenType,
            String actorToken,
            Set<String> audiences,
            Set<String> scopes) {
        return new OAuth2TokenExchangeAuthenticationToken(
                requestedTokenType,
                "subject",
                "urn:ietf:params:oauth:token-type:access_token",
                authenticatedClient(client),
                actorToken,
                actorToken == null ? null : "urn:ietf:params:oauth:token-type:access_token",
                null,
                audiences,
                scopes,
                Map.of());
    }

    private static OAuth2AccessToken accessToken(String tokenValue) {
        Instant now = Instant.now();
        return new OAuth2AccessToken(
                OAuth2AccessToken.TokenType.BEARER, tokenValue, now, now.plusSeconds(300));
    }

    private static OAuth2TokenExchangeAuthenticationToken requestWithScopes(
            RegisteredClient client, Set<String> scopes) {
        return new OAuth2TokenExchangeAuthenticationToken(
                "urn:ietf:params:oauth:token-type:access_token",
                "subject",
                "urn:ietf:params:oauth:token-type:access_token",
                authenticatedClient(client),
                null,
                null,
                null,
                Set.of(),
                scopes,
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
