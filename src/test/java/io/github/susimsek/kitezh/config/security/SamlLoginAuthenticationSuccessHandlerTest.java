package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.account.MfaStatusDTO;
import io.github.susimsek.kitezh.service.SamlLoginService;
import io.github.susimsek.kitezh.service.SocialAccountLinkRequiredException;
import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.service.account.MfaService;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.saml2.provider.service.authentication.Saml2AssertionAuthentication;
import org.springframework.security.saml2.provider.service.authentication.Saml2AuthenticatedPrincipal;
import org.springframework.security.saml2.provider.service.authentication.Saml2Authentication;
import org.springframework.security.saml2.provider.service.authentication.Saml2ResponseAssertion;
import org.springframework.security.web.context.SecurityContextRepository;

class SamlLoginAuthenticationSuccessHandlerTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void establishesLocalSessionAndPreservesSamlFactor() throws Exception {
        SamlLoginService service = mock(SamlLoginService.class);
        UserDetailsService users = mock(UserDetailsService.class);
        final SecurityContextRepository contexts = mock(SecurityContextRepository.class);
        Saml2Authentication authentication = authentication();
        UserDetails user = User.withUsername("saml-user").password("encoded").roles("USER").build();
        when(service.findOrCreate("saml-e2e", authentication)).thenReturn("saml-user");
        when(users.loadUserByUsername("saml-user")).thenReturn(user);
        when(service.providerRequiresMfa("saml-e2e")).thenReturn(false);

        MockHttpServletRequest request = request();
        MockHttpServletResponse response = new MockHttpServletResponse();
        new SamlLoginAuthenticationSuccessHandler(service, users, contexts, null)
                .onAuthenticationSuccess(request, response, authentication);

        Authentication local = SecurityContextHolder.getContext().getAuthentication();
        assertThat(local.getName()).isEqualTo("saml-user");
        assertThat(local.getAuthorities())
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_USER"));
        assertThat(request.getSession().getAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER))
                .isEqualTo("saml-e2e");
        verify(contexts).saveContext(any(), any(), any());
    }

    @Test
    void redirectsDisabledAccountsToLoginAndClearsPreviouslySavedSamlContext() throws Exception {
        SamlLoginService service = mock(SamlLoginService.class);
        UserDetailsService users = mock(UserDetailsService.class);
        final SecurityContextRepository contexts = mock(SecurityContextRepository.class);
        Saml2Authentication authentication = authentication();
        when(service.findOrCreate("saml-e2e", authentication)).thenReturn("disabled");
        when(users.loadUserByUsername("disabled"))
                .thenReturn(
                        User.withUsername("disabled").password("encoded").disabled(true).build());

        MockHttpServletResponse response = new MockHttpServletResponse();
        SecurityContextHolder.getContext().setAuthentication(authentication);
        new SamlLoginAuthenticationSuccessHandler(service, users, contexts, null)
                .onAuthenticationSuccess(request(), response, authentication);

        assertThat(response.getRedirectedUrl()).isEqualTo("/login?error");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(contexts)
                .saveContext(argThat(context -> context.getAuthentication() == null), any(), any());
    }

    @Test
    void storesPendingLinkAndRedirectsWhenEmailAlreadyExists() throws Exception {
        SamlLoginService service = mock(SamlLoginService.class);
        UserDetailsService users = mock(UserDetailsService.class);
        final SecurityContextRepository contexts = mock(SecurityContextRepository.class);
        Saml2Authentication authentication = authentication();
        SocialAccountLinkRequiredException exception =
                new SocialAccountLinkRequiredException(
                        "saml-e2e",
                        "subject-1",
                        "ada@example.test",
                        java.util.Map.of("email", "ada@example.test"));
        when(service.findOrCreate("saml-e2e", authentication)).thenThrow(exception);

        MockHttpServletRequest request = request();
        MockHttpServletResponse response = new MockHttpServletResponse();
        new SamlLoginAuthenticationSuccessHandler(service, users, contexts, null)
                .onAuthenticationSuccess(request, response, authentication);

        assertThat(response.getRedirectedUrl()).isEqualTo("/login?account_link_required");
        assertThat(request.getSession().getAttribute(SocialLoginService.PENDING_SOCIAL_LINK))
                .isEqualTo(exception.pendingLink());
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(contexts)
                .saveContext(argThat(context -> context.getAuthentication() == null), any(), any());
    }

    @Test
    void rejectsProviderLoginWhenMfaIsRequiredButNotEnrolled() throws Exception {
        SamlLoginService service = mock(SamlLoginService.class);
        UserDetailsService users = mock(UserDetailsService.class);
        MfaService mfa = mock(MfaService.class);
        Saml2Authentication authentication = authentication();
        when(service.findOrCreate("saml-e2e", authentication)).thenReturn("saml-user");
        when(users.loadUserByUsername("saml-user"))
                .thenReturn(
                        User.withUsername("saml-user").password("encoded").roles("USER").build());
        when(service.providerRequiresMfa("saml-e2e")).thenReturn(true);
        when(mfa.status("saml-user"))
                .thenReturn(new MfaStatusDTO(false, true, false, "issuer", "SHA1", 6, 30));

        MockHttpServletResponse response = new MockHttpServletResponse();
        SecurityContextRepository contexts = mock(SecurityContextRepository.class);
        new SamlLoginAuthenticationSuccessHandler(service, users, contexts, mfa)
                .onAuthenticationSuccess(request(), response, authentication);

        assertThat(response.getRedirectedUrl()).isEqualTo("/login?error");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(contexts)
                .saveContext(argThat(context -> context.getAuthentication() == null), any(), any());
    }

    @Test
    void acceptsEnrolledProviderMfaWithoutTreatingEnrollmentAsVerification() throws Exception {
        SamlLoginService service = mock(SamlLoginService.class);
        UserDetailsService users = mock(UserDetailsService.class);
        MfaService mfa = mock(MfaService.class);
        Saml2Authentication authentication = authentication();
        when(service.findOrCreate("saml-e2e", authentication)).thenReturn("saml-user");
        when(users.loadUserByUsername("saml-user"))
                .thenReturn(
                        User.withUsername("saml-user").password("encoded").roles("USER").build());
        when(service.providerRequiresMfa("saml-e2e")).thenReturn(true);
        when(mfa.status("saml-user"))
                .thenReturn(new MfaStatusDTO(true, true, false, "issuer", "SHA1", 6, 30));
        MockHttpServletRequest request = request();
        SecurityContextRepository contexts = mock(SecurityContextRepository.class);

        new SamlLoginAuthenticationSuccessHandler(service, users, contexts, mfa)
                .onAuthenticationSuccess(request, new MockHttpServletResponse(), authentication);

        assertThat(
                        request.getSession()
                                .getAttribute(MfaAuthorizationFilter.MFA_CREDENTIAL_VERIFIED))
                .isNull();
        verify(contexts).saveContext(any(), any(), any());
    }

    @Test
    void linksPendingAccountAfterMatchingSamlProvider() throws Exception {
        SamlLoginService service = mock(SamlLoginService.class);
        UserDetailsService users = mock(UserDetailsService.class);
        SecurityContextRepository contexts = mock(SecurityContextRepository.class);
        Saml2Authentication authentication = authentication();
        when(users.loadUserByUsername("ada"))
                .thenReturn(User.withUsername("ada").password("encoded").roles("USER").build());
        MockHttpServletRequest request = request();
        request.getSession(true)
                .setAttribute(
                        SocialLoginService.PENDING_SOCIAL_LINK_TARGET,
                        java.util.Map.of("provider", "saml-e2e", "username", "ada"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        new SamlLoginAuthenticationSuccessHandler(service, users, contexts, null)
                .onAuthenticationSuccess(request, response, authentication);

        verify(service).linkExisting("ada", "saml-e2e", authentication);
        assertThat(response.getRedirectedUrl()).isEqualTo("/account/security?social_linked=1");
        assertThat(request.getSession().getAttribute(SocialLoginService.PENDING_SOCIAL_LINK_TARGET))
                .isNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication().getName())
                .isEqualTo("ada");
    }

    @Test
    void rejectsPendingLinkForAnotherSamlProvider() throws Exception {
        SamlLoginService service = mock(SamlLoginService.class);
        UserDetailsService users = mock(UserDetailsService.class);
        SecurityContextRepository contexts = mock(SecurityContextRepository.class);
        MockHttpServletRequest request = request();
        request.getSession(true)
                .setAttribute(
                        SocialLoginService.PENDING_SOCIAL_LINK_TARGET,
                        java.util.Map.of("provider", "another-provider", "username", "ada"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        new SamlLoginAuthenticationSuccessHandler(service, users, contexts, null)
                .onAuthenticationSuccess(request, response, authentication());

        assertThat(response.getRedirectedUrl()).isEqualTo("/login?error");
        verify(service, never()).linkExisting(any(), any(), any());
    }

    @Test
    void rejectsInvalidRegistrationAndLockedLocalAccounts() throws Exception {
        SamlLoginService service = mock(SamlLoginService.class);
        UserDetailsService users = mock(UserDetailsService.class);
        SecurityContextRepository contexts = mock(SecurityContextRepository.class);
        Saml2Authentication authentication = authentication();
        MockHttpServletResponse invalidResponse = new MockHttpServletResponse();
        MockHttpServletRequest invalidRequest = new MockHttpServletRequest();
        invalidRequest.setRequestURI("/not-a-saml-callback");

        new SamlLoginAuthenticationSuccessHandler(service, users, contexts, null)
                .onAuthenticationSuccess(invalidRequest, invalidResponse, authentication);
        assertThat(invalidResponse.getRedirectedUrl()).isEqualTo("/login?error");

        invalidRequest.setRequestURI("/login/saml2/sso/SAML");
        MockHttpServletResponse malformedResponse = new MockHttpServletResponse();
        new SamlLoginAuthenticationSuccessHandler(service, users, contexts, null)
                .onAuthenticationSuccess(invalidRequest, malformedResponse, authentication);
        assertThat(malformedResponse.getRedirectedUrl()).isEqualTo("/login?error");

        when(service.findOrCreate("saml-e2e", authentication)).thenReturn("locked");
        when(users.loadUserByUsername("locked"))
                .thenReturn(
                        User.withUsername("locked")
                                .password("encoded")
                                .accountLocked(true)
                                .build());
        MockHttpServletResponse lockedResponse = new MockHttpServletResponse();
        new SamlLoginAuthenticationSuccessHandler(service, users, contexts, null)
                .onAuthenticationSuccess(request(), lockedResponse, authentication);
        assertThat(lockedResponse.getRedirectedUrl()).isEqualTo("/login?error");
    }

    @Test
    void preservesCompactSamlAssertionForSessionLogout() throws Exception {
        Saml2AssertionAuthentication authentication = assertionAuthentication();
        UserDetails user = User.withUsername("saml-user").password("encoded").roles("USER").build();
        Method method =
                SamlLoginAuthenticationSuccessHandler.class.getDeclaredMethod(
                        "localAuthentication",
                        UserDetails.class,
                        Set.class,
                        Saml2Authentication.class,
                        String.class);
        method.setAccessible(true);
        Saml2AssertionAuthentication local =
                (Saml2AssertionAuthentication)
                        method.invoke(
                                null,
                                user,
                                Set.of(new SimpleGrantedAuthority("ROLE_USER")),
                                authentication,
                                "saml-e2e");
        assertThat(local).isInstanceOf(Saml2AssertionAuthentication.class);
        assertThat(local.getCredentials().getNameId()).isEqualTo("name-id");
        assertThat(local.getCredentials().getSessionIndexes()).containsExactly("session-1");
    }

    private static MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/login/saml2/sso/saml-e2e");
        return request;
    }

    private static Saml2Authentication authentication() {
        Saml2AuthenticatedPrincipal principal = mock(Saml2AuthenticatedPrincipal.class);
        when(principal.getName()).thenReturn("subject-1");
        when(principal.getAttributes()).thenReturn(java.util.Map.of());
        return new Saml2Authentication(principal, "saml-response", List.of());
    }

    private static Saml2AssertionAuthentication assertionAuthentication() {
        Saml2AuthenticatedPrincipal principal = mock(Saml2AuthenticatedPrincipal.class);
        when(principal.getName()).thenReturn("subject-1");
        when(principal.getAttributes()).thenReturn(java.util.Map.of());
        Saml2ResponseAssertion assertion =
                Saml2ResponseAssertion.withResponseValue("")
                        .nameId("name-id")
                        .sessionIndexes(new java.util.ArrayList<>(List.of("session-1")))
                        .attributes(new java.util.HashMap<>())
                        .build();
        return new Saml2AssertionAuthentication(
                User.withUsername("saml-user")
                        .password("encoded")
                        .authorities(new SimpleGrantedAuthority("ROLE_USER"))
                        .build(),
                assertion,
                List.of(new SimpleGrantedAuthority("ROLE_USER")),
                "saml-e2e");
    }
}
