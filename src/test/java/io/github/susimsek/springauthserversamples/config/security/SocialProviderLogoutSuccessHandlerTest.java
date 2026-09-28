package io.github.susimsek.springauthserversamples.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.util.ReflectionTestUtils.invokeMethod;

import io.github.susimsek.springauthserversamples.service.SocialLoginService;
import io.github.susimsek.springauthserversamples.service.SocialProviderSettingsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.authorization.oidc.authentication.OidcLogoutAuthenticationToken;

class SocialProviderLogoutSuccessHandlerTest {

    @Test
    void delegatesNonOidcLogoutAuthentication() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        Authentication authentication = mock(Authentication.class);

        assertThatThrownBy(
                        () ->
                                new SocialProviderLogoutSuccessHandler(
                                                mock(SocialProviderSettingsService.class))
                                        .onAuthenticationSuccess(request, response, authentication))
                .isInstanceOf(
                        org.springframework.security.oauth2.core.OAuth2AuthenticationException
                                .class);
    }

    @Test
    void delegatesWhenNoProviderCredentialsAreStored() throws Exception {
        SocialProviderSettingsService settings = mock(SocialProviderSettingsService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(settings.provider(null)).thenReturn(null);
        when(request.getSession(false)).thenReturn(null);

        OidcLogoutAuthenticationToken logout =
                new OidcLogoutAuthenticationToken(
                        "hint",
                        UsernamePasswordAuthenticationToken.authenticated(
                                "ada", null, java.util.List.of()),
                        "account-console",
                        null,
                        "/account",
                        null);

        new SocialProviderLogoutSuccessHandler(settings)
                .onAuthenticationSuccess(request, response, logout);

        verify(response).sendRedirect((String) null);
    }

    @Test
    void startsMicrosoftLogoutWithTheRegisteredPostLogoutUri() throws Exception {
        SocialProviderSettingsService settings = mock(SocialProviderSettingsService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        final HttpServletResponse response = mock(HttpServletResponse.class);
        HttpSession session = mock(HttpSession.class);
        Authentication principal =
                UsernamePasswordAuthenticationToken.authenticated("ada", null, java.util.List.of());
        final OidcLogoutAuthenticationToken logout =
                new OidcLogoutAuthenticationToken(
                        "id-token-hint",
                        principal,
                        "account-console",
                        null,
                        "http://localhost:9090/account/",
                        null);
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER))
                .thenReturn("microsoft");
        when(settings.provider("microsoft"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "microsoft", "client", "secret"));

        new SocialProviderLogoutSuccessHandler(settings)
                .onAuthenticationSuccess(request, response, logout);

        verify(response)
                .sendRedirect(
                        "https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A9090%2Faccount%2F&id_token_hint=id-token-hint");
        verify(session).removeAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER);
    }

    @Test
    void startsGitHubLogoutWithReturnToUri() throws Exception {
        SocialProviderSettingsService settings = mock(SocialProviderSettingsService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        final HttpServletResponse response = mock(HttpServletResponse.class);
        HttpSession session = mock(HttpSession.class);
        Authentication principal =
                UsernamePasswordAuthenticationToken.authenticated("ada", null, java.util.List.of());
        final OidcLogoutAuthenticationToken logout =
                new OidcLogoutAuthenticationToken(
                        "id-token-hint",
                        principal,
                        "account-console",
                        (String) null,
                        "http://localhost:9090/account/",
                        null);
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER)).thenReturn("github");
        when(settings.provider("github"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "github", "client", "secret"));

        new SocialProviderLogoutSuccessHandler(settings)
                .onAuthenticationSuccess(request, response, logout);

        verify(response)
                .sendRedirect(
                        "https://github.com/logout?return_to=http%3A%2F%2Flocalhost%3A9090%2Faccount%2F");
    }

    @Test
    void startsLinkedInLogoutWithRedirectUri() throws Exception {
        SocialProviderSettingsService settings = mock(SocialProviderSettingsService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        final HttpServletResponse response = mock(HttpServletResponse.class);
        HttpSession session = mock(HttpSession.class);
        Authentication principal =
                UsernamePasswordAuthenticationToken.authenticated("ada", null, java.util.List.of());
        final OidcLogoutAuthenticationToken logout =
                new OidcLogoutAuthenticationToken(
                        "id-token-hint",
                        principal,
                        "account-console",
                        null,
                        "http://localhost:9090/account/",
                        null);
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER)).thenReturn("linkedin");
        when(settings.provider("linkedin"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "linkedin", "client", "secret"));

        new SocialProviderLogoutSuccessHandler(settings)
                .onAuthenticationSuccess(request, response, logout);

        verify(response)
                .sendRedirect(
                        "https://www.linkedin.com/m/logout?redirect_uri=http%3A%2F%2Flocalhost%3A9090%2Faccount%2F");
    }

    @Test
    void startsGoogleLogoutWithContinueParameterWhenNoIssuerIsConfigured() throws Exception {
        SocialProviderSettingsService settings = mock(SocialProviderSettingsService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        final HttpServletResponse response = mock(HttpServletResponse.class);
        HttpSession session = mock(HttpSession.class);
        Authentication principal =
                UsernamePasswordAuthenticationToken.authenticated("ada", null, java.util.List.of());
        final OidcLogoutAuthenticationToken logout =
                new OidcLogoutAuthenticationToken(
                        "hint", principal, "account-console", null, "/account", null);
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER)).thenReturn("google");
        when(settings.provider("google"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "google", "id", "secret"));

        new SocialProviderLogoutSuccessHandler(settings)
                .onAuthenticationSuccess(request, response, logout);

        verify(response).sendRedirect("https://accounts.google.com/Logout?continue=%2Faccount");
    }

    @Test
    void returnsNoUpstreamLogoutWhenProviderEndpointIsUnavailable() {
        SocialProviderSettingsService.ProviderCredentials credentials =
                new SocialProviderSettingsService.ProviderCredentials(
                        "unknown", "client", "secret");
        OidcLogoutAuthenticationToken logout =
                new OidcLogoutAuthenticationToken(
                        "hint",
                        UsernamePasswordAuthenticationToken.authenticated(
                                "ada", null, java.util.List.of()),
                        "account-console",
                        null,
                        " ",
                        null);
        SocialProviderLogoutEndpointResolver resolver =
                mock(SocialProviderLogoutEndpointResolver.class);
        when(resolver.resolve(credentials)).thenReturn(null);
        SocialProviderLogoutSuccessHandler handler =
                new SocialProviderLogoutSuccessHandler(
                        mock(SocialProviderSettingsService.class), resolver);

        assertThat((String) invokeMethod(handler, "upstreamLogout", credentials, logout)).isNull();
    }

    @Test
    void buildsGenericUpstreamLogoutWithExistingQueryAndDefaultRedirect() {
        SocialProviderSettingsService.ProviderCredentials credentials =
                new SocialProviderSettingsService.ProviderCredentials("oidc", "client", "secret");
        OidcLogoutAuthenticationToken logout =
                new OidcLogoutAuthenticationToken(
                        "hint",
                        UsernamePasswordAuthenticationToken.authenticated(
                                "ada", null, java.util.List.of()),
                        "account-console",
                        null,
                        " ",
                        null);
        SocialProviderLogoutEndpointResolver resolver =
                mock(SocialProviderLogoutEndpointResolver.class);
        when(resolver.resolve(credentials)).thenReturn("https://issuer.example/logout?existing=1");
        SocialProviderLogoutSuccessHandler handler =
                new SocialProviderLogoutSuccessHandler(
                        mock(SocialProviderSettingsService.class), resolver);

        assertThat((String) invokeMethod(handler, "upstreamLogout", credentials, logout))
                .isEqualTo(
                        "https://issuer.example/logout?existing=1&post_logout_redirect_uri=%2F&id_token_hint=hint");
        assertThat(
                        (String)
                                invokeMethod(
                                        handler,
                                        "appendParameter",
                                        "https://issuer.example/logout?existing=1",
                                        "state",
                                        "a value"))
                .isEqualTo("https://issuer.example/logout?existing=1&state=a+value");
    }
}
