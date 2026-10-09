package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.account.RequiredActionDTO;
import io.github.susimsek.kitezh.service.requiredaction.RequiredActionService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

class RequiredActionAuthorizationFilterTest {

    private final RequiredActionService requiredActionService = mock(RequiredActionService.class);
    private final jakarta.servlet.FilterChain filterChain = mock(jakarta.servlet.FilterChain.class);
    private final RequiredActionAuthorizationFilter filter =
            new RequiredActionAuthorizationFilter(requiredActionService);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void redirectsAuthenticatedUsersWithPendingActionsAndPreservesQueryString() throws Exception {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(
                                "alice",
                                "password",
                                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        when(requiredActionService.pendingIfUserExists("alice"))
                .thenReturn(
                        Optional.of(
                                List.of(
                                        new RequiredActionDTO(
                                                "UPDATE_PASSWORD", "Update", "Update", 1))));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorize");
        request.setQueryString("client_id=console&state=state");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertThat(response.getRedirectedUrl())
                .isEqualTo(
                        "/required-actions?return_to=%2Foauth2%2Fauthorize%3Fclient_id%3Dconsole%26state%3Dstate");
        assertThat(request.getSession().getAttribute(MfaAuthorizationFilter.MFA_PENDING_REQUEST))
                .isEqualTo("/oauth2/authorize?client_id=console&state=state");
        verifyNoInteractions(filterChain);
    }

    @Test
    void passesThroughWhenPathIsNotAuthorizationOrNoActionsArePending() throws Exception {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(
                                "alice",
                                "password",
                                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        when(requiredActionService.pendingIfUserExists("alice")).thenReturn(Optional.of(List.of()));
        MockHttpServletRequest authorization =
                new MockHttpServletRequest("GET", "/oauth2/authorize");
        MockHttpServletResponse authorizationResponse = new MockHttpServletResponse();
        filter.doFilter(authorization, authorizationResponse, filterChain);

        MockHttpServletRequest other = new MockHttpServletRequest("GET", "/login");
        MockHttpServletResponse otherResponse = new MockHttpServletResponse();
        filter.doFilter(other, otherResponse, filterChain);

        verify(filterChain).doFilter(authorization, authorizationResponse);
        verify(filterChain).doFilter(other, otherResponse);
    }

    @Test
    void invalidatesSessionAndContinuesAnonymouslyWhenAuthenticatedUserIsMissing()
            throws Exception {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(
                                "deleted-user",
                                "password",
                                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        when(requiredActionService.pendingIfUserExists("deleted-user"))
                .thenReturn(Optional.empty());
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorize");
        request.setQueryString("client_id=console&state=state");
        MockHttpSession session = (MockHttpSession) request.getSession(true);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertThat(session.isInvalid()).isTrue();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(request.getSession(false)).isNull();
        verify(filterChain).doFilter(request, response);
    }
}
