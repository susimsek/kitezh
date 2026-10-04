package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.account.MfaStatusDTO;
import io.github.susimsek.kitezh.dto.account.RequiredActionDTO;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import io.github.susimsek.kitezh.service.account.MfaService;
import io.github.susimsek.kitezh.service.requiredaction.RequiredActionService;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

class MfaAuthorizationFilterTest {

    private final MfaService mfaService = mock(MfaService.class);
    private final RequiredActionService requiredActionService = mock(RequiredActionService.class);
    private final jakarta.servlet.FilterChain filterChain = mock(jakarta.servlet.FilterChain.class);
    private final MfaAuthorizationFilter filter =
            new MfaAuthorizationFilter(mfaService, requiredActionService);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void redirectsAnEnabledUserWhoseCurrentSessionIsNotVerified() throws Exception {
        authenticate("alice");
        when(requiredActionService.pending("alice")).thenReturn(List.of());
        when(mfaService.status("alice")).thenReturn(status(true, true));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorize");
        request.setQueryString("client_id=account-console&state=request-state");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertThat(response.getRedirectedUrl())
                .isEqualTo(
                        "/mfa?return_to=%2Foauth2%2Fauthorize%3Fclient_id%3Daccount-console%26state%3Drequest-state");
        verifyNoInteractions(filterChain);
    }

    @Test
    void permitsAuthorizationAfterTheCurrentSessionHasVerifiedMfa() throws Exception {
        authenticate("alice");
        when(requiredActionService.pending("alice")).thenReturn(List.of());
        when(mfaService.status("alice")).thenReturn(status(true, true));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorize");
        request.setQueryString("client_id=account-console&state=request-state");
        request.getSession()
                .setAttribute(
                        MfaAuthorizationFilter.MFA_PENDING_REQUEST,
                        "/oauth2/authorize?client_id=account-console&state=request-state");
        MfaAuthorizationFilter.markVerified(request.getSession());
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void redirectsWhenVerificationExpiredOrBoundToAnotherRequest() throws Exception {
        authenticate("alice");
        when(requiredActionService.pending("alice")).thenReturn(List.of());
        when(mfaService.status("alice")).thenReturn(status(true, true));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorize");
        request.setQueryString("client_id=account-console&state=new-state");
        request.getSession().setAttribute(MfaAuthorizationFilter.MFA_VERIFIED, true);
        request.getSession()
                .setAttribute(
                        MfaAuthorizationFilter.MFA_VERIFIED_AT,
                        Instant.now().minus(Duration.ofMinutes(6)).toEpochMilli());
        request.getSession()
                .setAttribute(
                        MfaAuthorizationFilter.MFA_VERIFIED_REQUEST,
                        "/oauth2/authorize?client_id=account-console&state=old-state");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertThat(response.getRedirectedUrl())
                .isEqualTo(
                        "/mfa?return_to=%2Foauth2%2Fauthorize%3Fclient_id%3Daccount-console%26state%3Dnew-state");
        verifyNoInteractions(filterChain);
    }

    @Test
    void permitsAuthorizationWhenMfaIsUnavailableOrNotEnabledForTheUser() throws Exception {
        authenticate("alice");
        when(requiredActionService.pending("alice")).thenReturn(List.of());
        when(mfaService.status("alice")).thenReturn(status(false, true), status(true, false));
        MockHttpServletRequest firstRequest =
                new MockHttpServletRequest("GET", "/oauth2/authorize");
        MockHttpServletRequest secondRequest =
                new MockHttpServletRequest("GET", "/oauth2/authorize");
        MockHttpServletResponse firstResponse = new MockHttpServletResponse();
        MockHttpServletResponse secondResponse = new MockHttpServletResponse();

        filter.doFilter(firstRequest, firstResponse, filterChain);
        filter.doFilter(secondRequest, secondResponse, filterChain);

        verify(filterChain).doFilter(firstRequest, firstResponse);
        verify(filterChain).doFilter(secondRequest, secondResponse);
    }

    @Test
    void bypassesNonAuthorizationUnauthenticatedAnonymousAndPendingRequests() throws Exception {
        MockHttpServletRequest otherRequest = new MockHttpServletRequest("GET", "/home");
        MockHttpServletResponse otherResponse = new MockHttpServletResponse();
        filter.doFilter(otherRequest, otherResponse, filterChain);

        SecurityContextHolder.getContext()
                .setAuthentication(
                        UsernamePasswordAuthenticationToken.unauthenticated("alice", "password"));
        MockHttpServletRequest unauthenticatedRequest =
                new MockHttpServletRequest("GET", "/oauth2/authorize");
        MockHttpServletResponse unauthenticatedResponse = new MockHttpServletResponse();
        filter.doFilter(unauthenticatedRequest, unauthenticatedResponse, filterChain);

        SecurityContextHolder.getContext()
                .setAuthentication(
                        new AnonymousAuthenticationToken(
                                "key",
                                "anonymous",
                                List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));
        MockHttpServletRequest anonymousRequest =
                new MockHttpServletRequest("GET", "/oauth2/authorize");
        MockHttpServletResponse anonymousResponse = new MockHttpServletResponse();
        filter.doFilter(anonymousRequest, anonymousResponse, filterChain);

        authenticate("alice");
        when(requiredActionService.pending("alice"))
                .thenReturn(List.of(new RequiredActionDTO("TERMS", "Terms", "Terms", 1L)));
        MockHttpServletRequest pendingRequest =
                new MockHttpServletRequest("GET", "/oauth2/authorize");
        MockHttpServletResponse pendingResponse = new MockHttpServletResponse();
        filter.doFilter(pendingRequest, pendingResponse, filterChain);

        verify(filterChain).doFilter(otherRequest, otherResponse);
        verify(filterChain).doFilter(unauthenticatedRequest, unauthenticatedResponse);
        verify(filterChain).doFilter(anonymousRequest, anonymousResponse);
        verify(filterChain).doFilter(pendingRequest, pendingResponse);
        verifyNoInteractions(mfaService);
    }

    @Test
    void rejectsMalformedAndFutureVerificationTimestamps() throws Exception {
        authenticate("alice");
        when(requiredActionService.pending("alice")).thenReturn(List.of());
        when(mfaService.status("alice")).thenReturn(status(true, true));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorize");
        request.getSession().setAttribute(MfaAuthorizationFilter.MFA_VERIFIED, true);
        request.getSession().setAttribute(MfaAuthorizationFilter.MFA_VERIFIED_AT, "not-a-number");
        request.getSession()
                .setAttribute(MfaAuthorizationFilter.MFA_VERIFIED_REQUEST, "/oauth2/authorize");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);
        assertThat(response.getRedirectedUrl()).startsWith("/mfa?return_to=");

        request.getSession()
                .setAttribute(
                        MfaAuthorizationFilter.MFA_VERIFIED_AT,
                        Instant.now().plusSeconds(60).toEpochMilli());
        MockHttpServletResponse futureResponse = new MockHttpServletResponse();
        filter.doFilter(request, futureResponse, filterChain);
        assertThat(futureResponse.getRedirectedUrl()).startsWith("/mfa?return_to=");
    }

    @Test
    void usesConfiguredVerificationTimeout() throws Exception {
        LoginSettingsService settings = mock(LoginSettingsService.class);
        when(settings.mfaVerificationTimeout()).thenReturn(Duration.ofMinutes(10));
        final MfaAuthorizationFilter settingsAwareFilter =
                new MfaAuthorizationFilter(mfaService, requiredActionService, settings);
        authenticate("alice");
        when(requiredActionService.pending("alice")).thenReturn(List.of());
        when(mfaService.status("alice")).thenReturn(status(true, true));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorize");
        request.getSession().setAttribute(MfaAuthorizationFilter.MFA_VERIFIED, true);
        request.getSession()
                .setAttribute(
                        MfaAuthorizationFilter.MFA_VERIFIED_AT,
                        Instant.now().minus(Duration.ofMinutes(6)).toEpochMilli());
        request.getSession()
                .setAttribute(MfaAuthorizationFilter.MFA_VERIFIED_REQUEST, "/oauth2/authorize");
        MockHttpServletResponse response = new MockHttpServletResponse();

        settingsAwareFilter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void marksAndClearsCredentialAndPendingVerificationState() {
        MfaAuthorizationFilter.markVerified(null);
        MfaAuthorizationFilter.markCredentialVerified(null);

        MockHttpServletRequest request = new MockHttpServletRequest();
        jakarta.servlet.http.HttpSession session = request.getSession();
        session.setAttribute(
                MfaAuthorizationFilter.MFA_PENDING_REQUEST, "/oauth2/authorize?state=1");

        MfaAuthorizationFilter.markVerified(session);

        assertThat(session.getAttribute(MfaAuthorizationFilter.MFA_VERIFIED)).isEqualTo(true);
        assertThat(session.getAttribute(MfaAuthorizationFilter.MFA_VERIFIED_REQUEST))
                .isEqualTo("/oauth2/authorize?state=1");
        assertThat(session.getAttribute(MfaAuthorizationFilter.MFA_PENDING_REQUEST)).isNull();

        MfaAuthorizationFilter.markCredentialVerified(session);
        assertThat(session.getAttribute(MfaAuthorizationFilter.MFA_CREDENTIAL_VERIFIED))
                .isEqualTo(true);
    }

    @Test
    void marksVerificationWithoutStringPendingRequestAndUsesCredentialFactor() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorize");
        request.getSession().setAttribute(MfaAuthorizationFilter.MFA_PENDING_REQUEST, 42);
        MfaAuthorizationFilter.markVerified(request.getSession());
        assertThat(request.getSession().getAttribute(MfaAuthorizationFilter.MFA_VERIFIED_REQUEST))
                .isNull();

        authenticate("alice");
        when(requiredActionService.pending("alice")).thenReturn(List.of());
        when(mfaService.status("alice")).thenReturn(status(true, true));
        request.setQueryString("state=credential");
        MfaAuthorizationFilter.markCredentialVerified(request.getSession());
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertThat(
                        request.getSession()
                                .getAttribute(MfaAuthorizationFilter.MFA_CREDENTIAL_VERIFIED))
                .isNull();
    }

    @Test
    void supportsTheSettingsAwareConstructor() {
        assertThat(
                        new MfaAuthorizationFilter(
                                mfaService,
                                requiredActionService,
                                mock(LoginSettingsService.class)))
                .isNotNull();
    }

    private static MfaStatusDTO status(boolean available, boolean enabled) {
        return new MfaStatusDTO(enabled, available, false, "Issuer", "SHA1", 6, 30);
    }

    private static void authenticate(String username) {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(
                                username,
                                "password",
                                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
}
