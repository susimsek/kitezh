package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.CibaAuthenticationRequestEntity;
import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import io.github.susimsek.kitezh.service.ciba.CibaAuthenticationService;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AccessTokenAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContext;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContextHolder;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;

class CibaAuthenticationGrantAuthenticationProviderTest {

    private final OAuth2AuthorizationService authorizationService =
            mock(OAuth2AuthorizationService.class);
    private final OAuth2TokenGenerator<OAuth2Token> tokenGenerator =
            mock(OAuth2TokenGenerator.class);
    private final CibaAuthenticationService cibaService = mock(CibaAuthenticationService.class);
    private final UserDetailsService users = mock(UserDetailsService.class);
    private final CibaAuthenticationGrantAuthenticationProvider provider =
            new CibaAuthenticationGrantAuthenticationProvider(
                    authorizationService, tokenGenerator, cibaService, users);

    @AfterEach
    void resetContext() {
        AuthorizationServerContextHolder.resetContext();
    }

    @Test
    void supportsOnlyCibaGrantAndRejectsUnauthenticatedClient() {
        assertThat(provider.supports(CibaAuthenticationGrantAuthenticationToken.class)).isTrue();
        assertThat(provider.supports(String.class)).isFalse();
        CibaAuthenticationGrantAuthenticationToken grant =
                new CibaAuthenticationGrantAuthenticationToken("id", mock(), Map.of());
        assertThatThrownBy(() -> provider.authenticate(grant))
                .isInstanceOf(OAuth2AuthenticationException.class);
        RegisteredClient client = client();
        OAuth2ClientAuthenticationToken unauthenticated =
                new OAuth2ClientAuthenticationToken(
                        client, ClientAuthenticationMethod.CLIENT_SECRET_BASIC, "secret");
        unauthenticated.setAuthenticated(false);
        CibaAuthenticationGrantAuthenticationToken unauthenticatedGrant =
                new CibaAuthenticationGrantAuthenticationToken("id", unauthenticated, Map.of());
        assertThatThrownBy(() -> provider.authenticate(unauthenticatedGrant))
                .isInstanceOf(OAuth2AuthenticationException.class);
    }

    @Test
    void issuesAndPersistsAccessTokenAfterApproval() {
        RegisteredClient client = client();
        final OAuth2ClientAuthenticationToken clientPrincipal =
                new OAuth2ClientAuthenticationToken(
                        client, ClientAuthenticationMethod.CLIENT_SECRET_BASIC, "secret");
        CibaAuthenticationRequestEntity request =
                new CibaAuthenticationRequestEntity(
                        "request",
                        client.getId(),
                        "admin",
                        "openid  profile",
                        null,
                        Instant.now(),
                        Instant.now().plusSeconds(60),
                        5);
        request.setAcrValues("loa2");
        when(cibaService.poll("request", client.getId())).thenReturn(request);
        when(users.loadUserByUsername("admin"))
                .thenReturn(User.withUsername("admin").password("unused").roles("USER").build());
        OAuth2AccessToken accessToken =
                new OAuth2AccessToken(
                        OAuth2AccessToken.TokenType.BEARER,
                        "access-token",
                        Instant.now(),
                        Instant.now().plusSeconds(300));
        when(tokenGenerator.generate(any()))
                .thenAnswer(
                        invocation -> {
                            var context =
                                    invocation
                                            .<org.springframework.security.oauth2.server
                                                            .authorization.token.OAuth2TokenContext>
                                                    getArgument(0);
                            return OidcParameterNames.ID_TOKEN.equals(
                                            context.getTokenType().getValue())
                                    ? Jwt.withTokenValue("id-token")
                                            .header("alg", "RS256")
                                            .subject("admin")
                                            .issuedAt(Instant.now())
                                            .expiresAt(Instant.now().plusSeconds(1800))
                                            .build()
                                    : accessToken;
                        });
        AuthorizationServerContextHolder.setContext(mock(AuthorizationServerContext.class));
        CibaAuthenticationGrantAuthenticationToken grant =
                new CibaAuthenticationGrantAuthenticationToken(
                        "request", clientPrincipal, Map.of());

        AuthenticationResult result = new AuthenticationResult(provider.authenticate(grant));

        assertThat(result.authentication())
                .isInstanceOf(OAuth2AccessTokenAuthenticationToken.class);
        assertThat(result.token().getTokenValue()).isEqualTo("access-token");
        verify(authorizationService).save(any());
        verify(cibaService).consume(request);
    }

    @Test
    void rejectsClientsWithoutCibaGrantAndGeneratorFailure() {
        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .clientSecret("secret")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .build();
        final OAuth2ClientAuthenticationToken principal =
                new OAuth2ClientAuthenticationToken(
                        client, ClientAuthenticationMethod.CLIENT_SECRET_BASIC, "secret");
        CibaAuthenticationGrantAuthenticationToken grant =
                new CibaAuthenticationGrantAuthenticationToken("id", principal, Map.of());
        assertThatThrownBy(() -> provider.authenticate(grant))
                .isInstanceOf(OAuth2AuthenticationException.class);
    }

    @Test
    void supportsRefreshTokenAndConvertsGenericAccessToken() {
        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .clientSecret("secret")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(
                                new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                        .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                        .scope("openid")
                        .scope("offline_access")
                        .build();
        CibaAuthenticationRequestEntity request =
                new CibaAuthenticationRequestEntity(
                        "request",
                        client.getId(),
                        "admin",
                        "openid offline_access",
                        null,
                        Instant.now(),
                        Instant.now().plusSeconds(60),
                        5);
        when(cibaService.poll("request", client.getId())).thenReturn(request);
        when(users.loadUserByUsername("admin"))
                .thenReturn(User.withUsername("admin").password("unused").roles("USER").build());
        when(tokenGenerator.generate(any()))
                .thenAnswer(
                        invocation -> {
                            var context =
                                    invocation
                                            .<org.springframework.security.oauth2.server
                                                            .authorization.token.OAuth2TokenContext>
                                                    getArgument(0);
                            if (OidcParameterNames.ID_TOKEN.equals(
                                    context.getTokenType().getValue())) {
                                return Jwt.withTokenValue("id-token")
                                        .header("alg", "RS256")
                                        .subject("admin")
                                        .issuedAt(Instant.now())
                                        .expiresAt(Instant.now().plusSeconds(1800))
                                        .build();
                            }
                            if (org.springframework.security.oauth2.core.AuthorizationGrantType
                                    .REFRESH_TOKEN
                                    .getValue()
                                    .equals(context.getTokenType().getValue())) {
                                return new OAuth2RefreshToken(
                                        "refresh-token",
                                        Instant.now(),
                                        Instant.now().plusSeconds(3600));
                            }
                            return Jwt.withTokenValue("access-token")
                                    .header("alg", "none")
                                    .issuedAt(Instant.now())
                                    .expiresAt(Instant.now().plusSeconds(300))
                                    .build();
                        });
        AuthorizationServerContextHolder.setContext(mock(AuthorizationServerContext.class));
        final OAuth2ClientAuthenticationToken principal =
                new OAuth2ClientAuthenticationToken(
                        client, ClientAuthenticationMethod.CLIENT_SECRET_BASIC, "secret");

        AuthenticationResult result =
                new AuthenticationResult(
                        provider.authenticate(
                                new CibaAuthenticationGrantAuthenticationToken(
                                        "request", principal, Map.of())));

        assertThat(result.token().getTokenValue()).isEqualTo("access-token");
        assertThat(
                        ((OAuth2AccessTokenAuthenticationToken) result.authentication())
                                .getRefreshToken())
                .isNotNull();
        verify(authorizationService).save(any());
    }

    @Test
    void rejectsMissingAccessIdAndRefreshTokens() {
        RegisteredClient client = client();
        CibaAuthenticationRequestEntity request =
                new CibaAuthenticationRequestEntity(
                        "request",
                        client.getId(),
                        "admin",
                        "openid",
                        null,
                        Instant.now(),
                        Instant.now().plusSeconds(60),
                        5);
        when(cibaService.poll("request", client.getId())).thenReturn(request);
        when(users.loadUserByUsername("admin"))
                .thenReturn(User.withUsername("admin").password("unused").roles("USER").build());
        when(tokenGenerator.generate(any())).thenReturn(null);
        AuthorizationServerContextHolder.setContext(mock(AuthorizationServerContext.class));
        final OAuth2ClientAuthenticationToken principal =
                new OAuth2ClientAuthenticationToken(
                        client, ClientAuthenticationMethod.CLIENT_SECRET_BASIC, "secret");
        CibaAuthenticationGrantAuthenticationToken grant =
                new CibaAuthenticationGrantAuthenticationToken("request", principal, Map.of());

        assertThatThrownBy(() -> provider.authenticate(grant))
                .isInstanceOf(OAuth2AuthenticationException.class);
    }

    @Test
    void rejectsInvalidGeneratedIdAndRefreshTokens() {
        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .authorizationGrantType(
                                new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                        .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                        .scope("openid")
                        .scope("offline_access")
                        .build();
        CibaAuthenticationRequestEntity request =
                new CibaAuthenticationRequestEntity(
                        "request",
                        client.getId(),
                        "admin",
                        "openid offline_access",
                        null,
                        Instant.now(),
                        Instant.now().plusSeconds(60),
                        5);
        when(cibaService.poll("request", client.getId())).thenReturn(request);
        when(users.loadUserByUsername("admin"))
                .thenReturn(User.withUsername("admin").password("unused").roles("USER").build());
        OAuth2AccessToken access =
                new OAuth2AccessToken(
                        OAuth2AccessToken.TokenType.BEARER,
                        "access",
                        Instant.now(),
                        Instant.now().plusSeconds(300));
        when(tokenGenerator.generate(any()))
                .thenAnswer(
                        invocation -> {
                            var context =
                                    invocation
                                            .<org.springframework.security.oauth2.server
                                                            .authorization.token.OAuth2TokenContext>
                                                    getArgument(0);
                            if (context == null) {
                                return access;
                            }
                            return OidcParameterNames.ID_TOKEN.equals(
                                            context.getTokenType().getValue())
                                    ? access
                                    : access;
                        });
        AuthorizationServerContextHolder.setContext(mock(AuthorizationServerContext.class));
        OAuth2ClientAuthenticationToken principal =
                new OAuth2ClientAuthenticationToken(
                        client, ClientAuthenticationMethod.CLIENT_SECRET_BASIC, "secret");
        CibaAuthenticationGrantAuthenticationToken grant =
                new CibaAuthenticationGrantAuthenticationToken("request", principal, Map.of());
        assertThatThrownBy(() -> provider.authenticate(grant))
                .isInstanceOf(OAuth2AuthenticationException.class);

        when(tokenGenerator.generate(any()))
                .thenAnswer(
                        invocation -> {
                            var context =
                                    invocation
                                            .<org.springframework.security.oauth2.server
                                                            .authorization.token.OAuth2TokenContext>
                                                    getArgument(0);
                            if (context == null) {
                                return access;
                            }
                            if (OidcParameterNames.ID_TOKEN.equals(
                                    context.getTokenType().getValue())) {
                                return Jwt.withTokenValue("id")
                                        .header("alg", "RS256")
                                        .subject("admin")
                                        .issuedAt(Instant.now())
                                        .expiresAt(Instant.now().plusSeconds(300))
                                        .build();
                            }
                            return access;
                        });
        assertThatThrownBy(() -> provider.authenticate(grant))
                .isInstanceOf(OAuth2AuthenticationException.class);
    }

    private static RegisteredClient client() {
        return RegisteredClient.withId("id")
                .clientId("client")
                .clientSecret("secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(new AuthorizationGrantType(AuthorizationGrantTypes.CIBA))
                .scope("openid")
                .scope("profile")
                .build();
    }

    private record AuthenticationResult(
            org.springframework.security.core.Authentication authentication) {
        OAuth2AccessToken token() {
            return ((OAuth2AccessTokenAuthenticationToken) authentication).getAccessToken();
        }
    }
}
