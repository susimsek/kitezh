package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.account.MfaStatusDTO;
import io.github.susimsek.kitezh.service.SocialAccountLinkRequiredException;
import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.service.SocialTokenService;
import io.github.susimsek.kitezh.service.account.MfaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.FactorGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.web.context.SecurityContextRepository;

class SocialLoginAuthenticationSuccessHandlerTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void addsAuthenticationFactorForOidcTokenGeneration() throws Exception {
        SocialLoginService socialLoginService = mock(SocialLoginService.class);
        UserDetailsService userDetailsService = mock(UserDetailsService.class);
        final SecurityContextRepository securityContextRepository =
                mock(SecurityContextRepository.class);
        OAuth2AuthenticationToken oauth2Authentication = mock(OAuth2AuthenticationToken.class);
        UserDetails user =
                User.withUsername("social_user").password("encoded").roles("USER").build();
        when(socialLoginService.findOrCreate(oauth2Authentication)).thenReturn("social_user");
        when(userDetailsService.loadUserByUsername("social_user")).thenReturn(user);

        SocialLoginAuthenticationSuccessHandler handler =
                new SocialLoginAuthenticationSuccessHandler(
                        socialLoginService, userDetailsService, securityContextRepository);
        HttpServletRequest request = new MockHttpServletRequest();
        HttpServletResponse response = new MockHttpServletResponse();

        handler.onAuthenticationSuccess(request, response, oauth2Authentication);

        Authentication localAuthentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(localAuthentication.getAuthorities())
                .anyMatch(
                        authority ->
                                authority instanceof FactorGrantedAuthority factor
                                        && factor.getAuthority()
                                                .equals(
                                                        FactorGrantedAuthority
                                                                .AUTHORIZATION_CODE_AUTHORITY)
                                        && factor.getIssuedAt() != null);
        verify(securityContextRepository).saveContext(any(), any(), any());
    }

    @Test
    void rejectsDisabledLocalAccountAfterSocialAuthentication() throws Exception {
        SocialLoginService socialLoginService = mock(SocialLoginService.class);
        UserDetailsService userDetailsService = mock(UserDetailsService.class);
        SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
        OAuth2AuthenticationToken oauth2Authentication = mock(OAuth2AuthenticationToken.class);
        UserDetails disabled =
                User.withUsername("disabled").password("encoded").disabled(true).build();
        when(socialLoginService.findOrCreate(oauth2Authentication)).thenReturn("disabled");
        when(userDetailsService.loadUserByUsername("disabled")).thenReturn(disabled);

        SocialLoginAuthenticationSuccessHandler handler =
                new SocialLoginAuthenticationSuccessHandler(
                        socialLoginService, userDetailsService, securityContextRepository);
        HttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.onAuthenticationSuccess(request, response, oauth2Authentication);

        assertThat(response.getRedirectedUrl()).isEqualTo("/login?error");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(securityContextRepository, never()).saveContext(any(), any(), any());
    }

    @Test
    void storesAuthorizedClientAndCompletesPendingAccountLink() throws Exception {
        SocialLoginService socialLoginService = mock(SocialLoginService.class);
        UserDetailsService userDetailsService = mock(UserDetailsService.class);
        SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
        OAuth2AuthorizedClientRepository authorizedClients =
                mock(OAuth2AuthorizedClientRepository.class);
        SocialTokenService tokenService = mock(SocialTokenService.class);
        OAuth2AuthenticationToken authentication = mock(OAuth2AuthenticationToken.class);
        UserDetails user = User.withUsername("alice").password("encoded").roles("USER").build();
        when(authentication.getAuthorizedClientRegistrationId()).thenReturn("google");
        when(socialLoginService.linkExisting(any(), any(), any())).thenReturn("alice");
        when(userDetailsService.loadUserByUsername("alice")).thenReturn(user);
        when(authorizedClients.loadAuthorizedClient("google", authentication, null))
                .thenReturn(null);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.getSession(true)
                .setAttribute(
                        SocialLoginService.PENDING_SOCIAL_LINK_TARGET,
                        java.util.Map.of("username", "alice", "provider", "google"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        SocialLoginAuthenticationSuccessHandler handler =
                new SocialLoginAuthenticationSuccessHandler(
                        socialLoginService,
                        userDetailsService,
                        securityContextRepository,
                        authorizedClients,
                        tokenService);

        handler.onAuthenticationSuccess(request, response, authentication);

        assertThat(response.getRedirectedUrl()).isEqualTo("/account/security?social_linked=1");
        assertThat(request.getSession().getAttribute(SocialLoginService.PENDING_SOCIAL_LINK_TARGET))
                .isNull();
        verify(tokenService).store("alice", "google", null);
        verify(socialLoginService).linkExisting("alice", "google", authentication);
    }

    @Test
    void redirectsToMfaWhenProviderRequiresAnEnrolledFactor() throws Exception {
        SocialLoginService socialLoginService = mock(SocialLoginService.class);
        UserDetailsService userDetailsService = mock(UserDetailsService.class);
        final SecurityContextRepository securityContextRepository =
                mock(SecurityContextRepository.class);
        final MfaService mfaService = mock(MfaService.class);
        OAuth2AuthenticationToken authentication = mock(OAuth2AuthenticationToken.class);
        UserDetails user = User.withUsername("alice").password("encoded").roles("USER").build();
        when(authentication.getAuthorizedClientRegistrationId()).thenReturn("google");
        when(socialLoginService.findOrCreate(authentication)).thenReturn("alice");
        when(userDetailsService.loadUserByUsername("alice")).thenReturn(user);
        when(socialLoginService.providerRequiresMfa("google")).thenReturn(true);
        when(mfaService.status("alice"))
                .thenReturn(new MfaStatusDTO(true, true, false, "issuer", "SHA1", 6, 30));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        new SocialLoginAuthenticationSuccessHandler(
                        socialLoginService,
                        userDetailsService,
                        securityContextRepository,
                        null,
                        null,
                        mfaService)
                .onAuthenticationSuccess(request, response, authentication);

        assertThat(response.getRedirectedUrl()).isEqualTo("/mfa?return_to=%2Fadmin");
        assertThat(request.getSession().getAttribute(MfaAuthorizationFilter.MFA_PENDING_REQUEST))
                .isEqualTo("/admin");
    }

    @Test
    void sendsFailureRedirectForLockedAccountAndMissingProviderMfa() throws Exception {
        SocialLoginService socialLoginService = mock(SocialLoginService.class);
        UserDetailsService userDetailsService = mock(UserDetailsService.class);
        final SecurityContextRepository securityContextRepository =
                mock(SecurityContextRepository.class);
        final MfaService mfaService = mock(MfaService.class);
        OAuth2AuthenticationToken authentication = mock(OAuth2AuthenticationToken.class);
        when(authentication.getAuthorizedClientRegistrationId()).thenReturn("google");
        when(socialLoginService.findOrCreate(authentication)).thenReturn("alice");
        when(socialLoginService.providerRequiresMfa("google")).thenReturn(true);
        when(userDetailsService.loadUserByUsername("alice"))
                .thenReturn(
                        User.withUsername("alice").password("encoded").accountLocked(true).build());

        MockHttpServletResponse lockedResponse = new MockHttpServletResponse();
        new SocialLoginAuthenticationSuccessHandler(
                        socialLoginService, userDetailsService, securityContextRepository)
                .onAuthenticationSuccess(
                        new MockHttpServletRequest(), lockedResponse, authentication);
        assertThat(lockedResponse.getRedirectedUrl()).isEqualTo("/login?error");

        when(userDetailsService.loadUserByUsername("alice"))
                .thenReturn(User.withUsername("alice").password("encoded").build());
        when(mfaService.status("alice"))
                .thenReturn(new MfaStatusDTO(false, true, false, "issuer", "SHA1", 6, 30));
        MockHttpServletResponse mfaResponse = new MockHttpServletResponse();
        new SocialLoginAuthenticationSuccessHandler(
                        socialLoginService,
                        userDetailsService,
                        securityContextRepository,
                        null,
                        null,
                        mfaService)
                .onAuthenticationSuccess(new MockHttpServletRequest(), mfaResponse, authentication);
        assertThat(mfaResponse.getRedirectedUrl()).isEqualTo("/login?error");
    }

    @Test
    void storesPendingLinkAndRejectsNonOAuthAuthentication() throws Exception {
        SocialLoginService socialLoginService = mock(SocialLoginService.class);
        UserDetailsService userDetailsService = mock(UserDetailsService.class);
        SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
        SocialAccountLinkRequiredException exception =
                new SocialAccountLinkRequiredException(
                        "google",
                        "subject",
                        "alice@example.test",
                        java.util.Map.of("name", "Alice"));
        when(socialLoginService.findOrCreate(any())).thenThrow(exception);
        SocialLoginAuthenticationSuccessHandler handler =
                new SocialLoginAuthenticationSuccessHandler(
                        socialLoginService, userDetailsService, securityContextRepository);
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.onAuthenticationSuccess(request, response, mock(Authentication.class));
        assertThat(response.getRedirectedUrl()).isEqualTo("/login?error");

        OAuth2AuthenticationToken authentication = mock(OAuth2AuthenticationToken.class);
        MockHttpServletResponse linkResponse = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(request, linkResponse, authentication);
        assertThat(linkResponse.getRedirectedUrl()).isEqualTo("/login?account_link_required");
        assertThat(request.getSession().getAttribute(SocialLoginService.PENDING_SOCIAL_LINK))
                .isEqualTo(exception.pendingLink());
    }
}
