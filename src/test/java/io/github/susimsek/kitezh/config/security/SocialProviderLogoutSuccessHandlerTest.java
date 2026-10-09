package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.util.ReflectionTestUtils.invokeMethod;

import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.service.SocialProviderSettingsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
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
    void githubLogoutEndsLocalSessionWithoutOpeningGlobalProviderLogoutPage() throws Exception {
        SocialProviderSettingsService settings = mock(SocialProviderSettingsService.class);
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpSession session = new MockHttpSession();
        request.setSession(session);
        session.setAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER, "github");
        Authentication principal =
                UsernamePasswordAuthenticationToken.authenticated("ada", null, java.util.List.of());
        OidcIdToken idToken =
                new OidcIdToken(
                        "test-hint",
                        java.time.Instant.now(),
                        java.time.Instant.now().plusSeconds(60),
                        java.util.Map.of("sub", "test-user"));
        final OidcLogoutAuthenticationToken logout =
                new OidcLogoutAuthenticationToken(
                        idToken,
                        principal,
                        session.getId(),
                        "desktop-account-console",
                        "http://localhost:9090/account/",
                        null);
        when(settings.provider("github"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "github", "client", "secret"));

        SecurityContextHolder.getContext().setAuthentication(principal);
        try {
            new SocialProviderLogoutSuccessHandler(settings)
                    .onAuthenticationSuccess(request, response, logout);

            assertThat(response.getRedirectedUrl()).isEqualTo("http://localhost:9090/account/");
            assertThat(session.isInvalid()).isTrue();
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void linkedInLogoutEndsLocalSessionWithoutOpeningProviderPage() throws Exception {
        SocialProviderSettingsService settings = mock(SocialProviderSettingsService.class);
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpSession session = new MockHttpSession();
        request.setSession(session);
        session.setAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER, "linkedin");
        Authentication principal =
                UsernamePasswordAuthenticationToken.authenticated("ada", null, java.util.List.of());
        OidcIdToken idToken =
                new OidcIdToken(
                        "test-hint",
                        java.time.Instant.now(),
                        java.time.Instant.now().plusSeconds(60),
                        java.util.Map.of("sub", "test-user"));
        OidcLogoutAuthenticationToken logout =
                new OidcLogoutAuthenticationToken(
                        idToken,
                        principal,
                        session.getId(),
                        "desktop-account-console",
                        "kitezh://logout/callback",
                        null);
        when(settings.provider("linkedin"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "linkedin", "client", "secret"));

        SecurityContextHolder.getContext().setAuthentication(principal);
        try {
            new SocialProviderLogoutSuccessHandler(settings)
                    .onAuthenticationSuccess(request, response, logout);

            assertThat(response.getRedirectedUrl()).isEqualTo("kitezh://logout/callback");
            assertThat(response.getRedirectedUrl()).doesNotContain("linkedin.com");
            assertThat(session.isInvalid()).isTrue();
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"kitezh://logout/callback", "http://localhost:9090/account/"})
    void googleLogoutClearsLocalSessionAndUsesValidatedClientCallback(String callback)
            throws Exception {
        SocialProviderSettingsService settings = mock(SocialProviderSettingsService.class);
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpSession session = new MockHttpSession();
        request.setSession(session);
        session.setAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER, "google");
        Authentication principal =
                UsernamePasswordAuthenticationToken.authenticated("ada", null, java.util.List.of());
        OidcIdToken idToken =
                new OidcIdToken(
                        "test-hint",
                        java.time.Instant.now(),
                        java.time.Instant.now().plusSeconds(60),
                        java.util.Map.of("sub", "test-user"));
        OidcLogoutAuthenticationToken logout =
                new OidcLogoutAuthenticationToken(
                        idToken,
                        principal,
                        session.getId(),
                        "desktop-account-console",
                        callback,
                        null);
        when(settings.provider("google"))
                .thenReturn(
                        new SocialProviderSettingsService.ProviderCredentials(
                                "google", "id", "secret"));

        SecurityContextHolder.getContext().setAuthentication(principal);
        try {
            new SocialProviderLogoutSuccessHandler(settings)
                    .onAuthenticationSuccess(request, response, logout);

            assertThat(response.getRedirectedUrl()).isEqualTo(callback);
            assertThat(session.isInvalid()).isTrue();
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        } finally {
            SecurityContextHolder.clearContext();
        }
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
