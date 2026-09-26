package io.github.susimsek.springauthserversamples.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.security.ClientSecuritySettings;
import io.github.susimsek.springauthserversamples.service.admin.ClientScopeSettings;
import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Field;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientCredentialsAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;

class DefaultClientScopesClientCredentialsConverterTest {

    @Test
    void addsConfiguredDefaultScopesToClientCredentialsAuthentication() throws Exception {
        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .clientSettings(
                                ClientScopeSettings.withAssignments(
                                        ClientSettings.builder().build(),
                                        Set.of("openid", "email"),
                                        Set.of()))
                        .build();
        OAuth2ClientAuthenticationToken principal = mock(OAuth2ClientAuthenticationToken.class);
        when(principal.getRegisteredClient()).thenReturn(client);
        OAuth2ClientCredentialsAuthenticationToken token =
                mock(OAuth2ClientCredentialsAuthenticationToken.class);
        when(token.getPrincipal()).thenReturn(principal);
        when(token.getScopes()).thenReturn(Set.of("openid"));
        when(token.getAdditionalParameters())
                .thenReturn(Map.of("grant_type", "client_credentials"));
        org.springframework.security.oauth2.server.authorization.web.authentication
                        .OAuth2ClientCredentialsAuthenticationConverter
                delegate =
                        mock(
                                org.springframework.security.oauth2.server.authorization.web
                                        .authentication
                                        .OAuth2ClientCredentialsAuthenticationConverter.class);
        when(delegate.convert(org.mockito.ArgumentMatchers.any())).thenReturn(token);
        DefaultClientScopesClientCredentialsConverter converter =
                new DefaultClientScopesClientCredentialsConverter();
        Field field =
                DefaultClientScopesClientCredentialsConverter.class.getDeclaredField("delegate");
        field.setAccessible(true);
        field.set(converter, delegate);

        Authentication converted = converter.convert(mock(HttpServletRequest.class));

        assertThat(converted).isInstanceOf(OAuth2ClientCredentialsAuthenticationToken.class);
        assertThat(((OAuth2ClientCredentialsAuthenticationToken) converted).getScopes())
                .containsExactlyInAnyOrder("openid", "email");
    }

    @Test
    void rejectsTokenRequestsWithoutDpopProofWhenClientRequiresIt() {
        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .clientSettings(
                                ClientSettings.withSettings(
                                                Map.of(
                                                        ClientSecuritySettings.REQUIRE_DPOP_PROOF,
                                                        true))
                                        .build())
                        .build();
        OAuth2ClientAuthenticationToken authentication =
                mock(OAuth2ClientAuthenticationToken.class);
        when(authentication.getRegisteredClient()).thenReturn(client);
        SecurityContextHolder.getContext().setAuthentication(authentication);
        try {
            HttpServletRequest request = mock(HttpServletRequest.class);

            assertThatThrownBy(
                            () ->
                                    new DefaultClientScopesClientCredentialsConverter()
                                            .convert(request))
                    .isInstanceOf(
                            org.springframework.security.oauth2.core.OAuth2AuthenticationException
                                    .class)
                    .hasMessageContaining("DPoP proof is required");
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void requiresDpopForRefreshOnlyPolicy() {
        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                        .clientSettings(
                                ClientSettings.withSettings(
                                                Map.of(
                                                        ClientSecuritySettings
                                                                .DPOP_REFRESH_TOKEN_ONLY,
                                                        true))
                                        .build())
                        .build();
        OAuth2ClientAuthenticationToken authentication =
                mock(OAuth2ClientAuthenticationToken.class);
        when(authentication.getRegisteredClient()).thenReturn(client);
        SecurityContextHolder.getContext().setAuthentication(authentication);
        try {
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getParameter("grant_type")).thenReturn("refresh_token");

            assertThatThrownBy(
                            () ->
                                    new DefaultClientScopesClientCredentialsConverter()
                                            .convert(request))
                    .isInstanceOf(
                            org.springframework.security.oauth2.core.OAuth2AuthenticationException
                                    .class)
                    .hasMessageContaining("DPoP proof is required");
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void rejectsDpopProofWithDisallowedSigningAlgorithm() {
        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                        .clientSettings(
                                ClientSettings.withSettings(
                                                Map.of(
                                                        ClientSecuritySettings
                                                                .DPOP_SIGNING_ALGORITHMS,
                                                        Set.of("ES256")))
                                        .build())
                        .build();
        OAuth2ClientAuthenticationToken authentication =
                mock(OAuth2ClientAuthenticationToken.class);
        when(authentication.getRegisteredClient()).thenReturn(client);
        SecurityContextHolder.getContext().setAuthentication(authentication);
        try {
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getHeader("DPoP")).thenReturn("eyJhbGciOiJSUzI1NiJ9.e30.c2ln");

            assertThatThrownBy(
                            () ->
                                    new DefaultClientScopesClientCredentialsConverter()
                                            .convert(request))
                    .isInstanceOf(
                            org.springframework.security.oauth2.core.OAuth2AuthenticationException
                                    .class)
                    .hasMessageContaining("disallowed signature algorithm");
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
