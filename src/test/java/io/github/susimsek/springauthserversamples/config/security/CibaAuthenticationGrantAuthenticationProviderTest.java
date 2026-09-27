package io.github.susimsek.springauthserversamples.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestEntity;
import io.github.susimsek.springauthserversamples.security.AuthorizationGrantTypes;
import io.github.susimsek.springauthserversamples.service.ciba.CibaAuthenticationService;
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
                        "openid profile",
                        null,
                        Instant.now(),
                        Instant.now().plusSeconds(60),
                        5);
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
        OAuth2ClientAuthenticationToken principal =
                new OAuth2ClientAuthenticationToken(
                        client, ClientAuthenticationMethod.CLIENT_SECRET_BASIC, "secret");
        CibaAuthenticationGrantAuthenticationToken grant =
                new CibaAuthenticationGrantAuthenticationToken("id", principal, Map.of());
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
