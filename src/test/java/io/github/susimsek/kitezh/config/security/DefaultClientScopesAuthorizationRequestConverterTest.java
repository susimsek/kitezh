package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.security.ClientSecuritySettings;
import io.github.susimsek.kitezh.service.admin.ClientScopeSettings;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2PushedAuthorizationRequestAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContext;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContextHolder;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;

class DefaultClientScopesAuthorizationRequestConverterTest {

    @BeforeEach
    void setAuthorizationServerContext() {
        AuthorizationServerContext context = mock(AuthorizationServerContext.class);
        when(context.getAuthorizationServerSettings())
                .thenReturn(AuthorizationServerSettings.builder().build());
        AuthorizationServerContextHolder.setContext(context);
    }

    @AfterEach
    void resetAuthorizationServerContext() {
        AuthorizationServerContextHolder.resetContext();
    }

    @Test
    void addsConfiguredDefaultScopesToAuthorizationRequest() {
        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .redirectUri("https://client.example/callback")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .scope("openid")
                        .scope("profile")
                        .clientSettings(
                                ClientScopeSettings.withAssignments(
                                        org.springframework.security.oauth2.server.authorization
                                                .settings.ClientSettings.builder()
                                                .build(),
                                        java.util.Set.of("openid", "email"),
                                        java.util.Set.of()))
                        .build();
        RegisteredClientRepository repository = mock(RegisteredClientRepository.class);
        when(repository.findByClientId("client")).thenReturn(client);
        DefaultClientScopesAuthorizationRequestConverter converter =
                new DefaultClientScopesAuthorizationRequestConverter(repository);

        AuthenticationRequest request = new AuthenticationRequest();
        var authentication = converter.convert(request);

        assertThat(authentication)
                .isInstanceOf(OAuth2AuthorizationCodeRequestAuthenticationToken.class);
        assertThat(((OAuth2AuthorizationCodeRequestAuthenticationToken) authentication).getScopes())
                .containsExactly("openid", "email");
    }

    @Test
    void leavesRequestsWithoutARegisteredClientOrWithoutNewScopesUntouched() {
        RegisteredClientRepository repository = mock(RegisteredClientRepository.class);
        when(repository.findByClientId("missing")).thenReturn(null);
        DefaultClientScopesAuthorizationRequestConverter converter =
                new DefaultClientScopesAuthorizationRequestConverter(repository);

        MockHttpServletRequest missing = request("missing", "openid");
        var missingResult = converter.convert(missing);
        assertThat(missingResult)
                .isInstanceOf(OAuth2AuthorizationCodeRequestAuthenticationToken.class);

        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .redirectUri("https://client.example/callback")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .scope("openid")
                        .build();
        when(repository.findByClientId("client")).thenReturn(client);
        var unchanged = converter.convert(request("client", "openid"));
        assertThat(unchanged).isInstanceOf(OAuth2AuthorizationCodeRequestAuthenticationToken.class);
        assertThat(((OAuth2AuthorizationCodeRequestAuthenticationToken) unchanged).getScopes())
                .containsExactly("openid");

        assertThat(converter.convert(new MockHttpServletRequest())).isNull();
    }

    @Test
    void requiresValidDpopJktWhenClientPolicyIsEnabled() {
        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .redirectUri("https://client.example/callback")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .scope("openid")
                        .clientSettings(
                                ClientSettings.withSettings(
                                                java.util.Map.of(
                                                        ClientSecuritySettings.REQUIRE_DPOP_JKT,
                                                        true))
                                        .build())
                        .build();
        RegisteredClientRepository repository = mock(RegisteredClientRepository.class);
        when(repository.findByClientId("client")).thenReturn(client);
        DefaultClientScopesAuthorizationRequestConverter converter =
                new DefaultClientScopesAuthorizationRequestConverter(repository);

        MockHttpServletRequest request = request("client", "openid");
        String dpopJkt = validDpopJkt();
        request.addParameter("dpop_jkt", dpopJkt);
        request.setQueryString(request.getQueryString() + "&dpop_jkt=" + dpopJkt);

        assertThat(converter.convert(request))
                .isInstanceOf(OAuth2AuthorizationCodeRequestAuthenticationToken.class);

        MockHttpServletRequest missing = request("client", "openid");
        assertThatThrownBy(() -> converter.convert(missing))
                .isInstanceOf(
                        org.springframework.security.oauth2.server.authorization.authentication
                                .OAuth2AuthorizationCodeRequestAuthenticationException.class);

        MockHttpServletRequest malformed = request("client", "openid");
        malformed.addParameter("dpop_jkt", "not-base64");
        malformed.setQueryString(malformed.getQueryString() + "&dpop_jkt=not-base64");
        assertThatThrownBy(() -> converter.convert(malformed))
                .isInstanceOf(
                        org.springframework.security.oauth2.server.authorization.authentication
                                .OAuth2AuthorizationCodeRequestAuthenticationException.class);
    }

    @Test
    void addsConfiguredDefaultScopesToPushedAuthorizationRequests() {
        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .redirectUri("https://client.example/callback")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .scope("openid")
                        .clientSettings(
                                ClientScopeSettings.withAssignments(
                                        ClientSettings.builder().build(),
                                        java.util.Set.of("openid", "email"),
                                        java.util.Set.of()))
                        .build();
        RegisteredClientRepository repository = mock(RegisteredClientRepository.class);
        when(repository.findByClientId("client")).thenReturn(client);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/oauth2/par");
        request.addParameter(OAuth2ParameterNames.CLIENT_ID, "client");
        request.addParameter(OAuth2ParameterNames.RESPONSE_TYPE, "code");
        request.addParameter(OAuth2ParameterNames.REDIRECT_URI, "https://client.example/callback");
        request.addParameter(OAuth2ParameterNames.SCOPE, "openid");
        request.addParameter("dpop_jkt", validDpopJkt());

        Authentication authentication =
                new DefaultClientScopesAuthorizationRequestConverter(repository).convert(request);

        assertThat(authentication)
                .isInstanceOf(OAuth2PushedAuthorizationRequestAuthenticationToken.class);
        assertThat(
                        ((OAuth2PushedAuthorizationRequestAuthenticationToken) authentication)
                                .getScopes())
                .containsExactlyInAnyOrder("openid", "email");
    }

    @Test
    void leavesPushedRequestsWithoutARegisteredClientUntouched() {
        RegisteredClientRepository repository = mock(RegisteredClientRepository.class);
        when(repository.findByClientId("missing")).thenReturn(null);
        MockHttpServletRequest request = pushedRequest("missing", "openid");

        Authentication authentication =
                new DefaultClientScopesAuthorizationRequestConverter(repository).convert(request);

        assertThat(authentication)
                .isInstanceOf(OAuth2PushedAuthorizationRequestAuthenticationToken.class);
    }

    @Test
    void leavesPushedRequestsWithoutNewScopesUntouched() {
        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .redirectUri("https://client.example/callback")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .scope("openid")
                        .build();
        RegisteredClientRepository repository = mock(RegisteredClientRepository.class);
        when(repository.findByClientId("client")).thenReturn(client);

        Authentication authentication =
                new DefaultClientScopesAuthorizationRequestConverter(repository)
                        .convert(pushedRequest("client", "openid"));

        assertThat(authentication)
                .isInstanceOf(OAuth2PushedAuthorizationRequestAuthenticationToken.class);
        assertThat(
                        ((OAuth2PushedAuthorizationRequestAuthenticationToken) authentication)
                                .getScopes())
                .containsExactly("openid");
    }

    @Test
    void requiresDpopJktOnPushedAuthorizationRequests() {
        RegisteredClient client =
                RegisteredClient.withId("id")
                        .clientId("client")
                        .redirectUri("https://client.example/callback")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .scope("openid")
                        .clientSettings(
                                ClientSettings.withSettings(
                                                java.util.Map.of(
                                                        ClientSecuritySettings.REQUIRE_DPOP_JKT,
                                                        true))
                                        .build())
                        .build();
        RegisteredClientRepository repository = mock(RegisteredClientRepository.class);
        when(repository.findByClientId("client")).thenReturn(client);

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/oauth2/par");
        request.addParameter(OAuth2ParameterNames.CLIENT_ID, "client");
        request.addParameter(OAuth2ParameterNames.RESPONSE_TYPE, "code");
        request.addParameter(OAuth2ParameterNames.REDIRECT_URI, "https://client.example/callback");
        request.addParameter(OAuth2ParameterNames.SCOPE, "openid");

        DefaultClientScopesAuthorizationRequestConverter converter =
                new DefaultClientScopesAuthorizationRequestConverter(repository);
        assertThatThrownBy(() -> converter.convert(request))
                .isInstanceOf(
                        org.springframework.security.oauth2.server.authorization.authentication
                                .OAuth2AuthorizationCodeRequestAuthenticationException.class);
    }

    private static String validDpopJkt() {
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);
    }

    private static MockHttpServletRequest request(String clientId, String scope) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorize");
        request.addParameter(OAuth2ParameterNames.CLIENT_ID, clientId);
        request.addParameter(OAuth2ParameterNames.RESPONSE_TYPE, "code");
        request.addParameter(OAuth2ParameterNames.REDIRECT_URI, "https://client.example/callback");
        request.addParameter(OAuth2ParameterNames.SCOPE, scope);
        request.addParameter(OAuth2ParameterNames.STATE, "state");
        request.setQueryString(
                "client_id="
                        + clientId
                        + "&response_type=code&redirect_uri=https://client.example/callback&scope="
                        + scope
                        + "&state=state");
        return request;
    }

    private static MockHttpServletRequest pushedRequest(String clientId, String scope) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/oauth2/par");
        request.addParameter(OAuth2ParameterNames.CLIENT_ID, clientId);
        request.addParameter(OAuth2ParameterNames.RESPONSE_TYPE, "code");
        request.addParameter(OAuth2ParameterNames.REDIRECT_URI, "https://client.example/callback");
        request.addParameter(OAuth2ParameterNames.SCOPE, scope);
        return request;
    }

    private static final class AuthenticationRequest extends MockHttpServletRequest {
        AuthenticationRequest() {
            super("GET", "/oauth2/authorize");
            addParameter(OAuth2ParameterNames.CLIENT_ID, "client");
            addParameter(OAuth2ParameterNames.RESPONSE_TYPE, "code");
            addParameter(OAuth2ParameterNames.REDIRECT_URI, "https://client.example/callback");
            addParameter(OAuth2ParameterNames.SCOPE, "openid");
            addParameter(OAuth2ParameterNames.STATE, "state");
            setQueryString(
                    "client_id=client&response_type=code&redirect_uri=https://client.example/callback"
                        + "&scope=openid&state=state");
        }
    }
}
