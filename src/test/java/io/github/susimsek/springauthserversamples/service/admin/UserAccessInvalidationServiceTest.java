package io.github.susimsek.springauthserversamples.service.admin;

import static org.mockito.Mockito.verify;

import io.github.susimsek.springauthserversamples.service.SessionInvalidationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@ExtendWith(MockitoExtension.class)
class UserAccessInvalidationServiceTest {

    @Mock private SessionInvalidationService sessionInvalidationService;

    @AfterEach
    void clearRequestAndSecurityContext() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void invalidateDeletesBrowserSessionsAndOAuth2Authorizations() {
        new UserAccessInvalidationService(sessionInvalidationService).invalidate("alice");

        verify(sessionInvalidationService).invalidatePrincipal("alice");
    }

    @Test
    void invalidateOtherSessionsPreservesCurrentBrowserSession() {
        new UserAccessInvalidationService(sessionInvalidationService)
                .invalidateOtherSessions("alice", "current-session");

        verify(sessionInvalidationService)
                .invalidatePrincipalExceptSession("alice", "current-session");
    }

    @Test
    void invalidateForCurrentPrincipalFallsBackToAllStateWithoutARequest() {
        new UserAccessInvalidationService(sessionInvalidationService)
                .invalidateForCurrentPrincipal("alice");

        verify(sessionInvalidationService).invalidatePrincipal("alice");
    }

    @Test
    void invalidateForCurrentPrincipalPreservesCurrentSession() {
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken("alice", "password"));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSession(new MockHttpSession(null, "current-session"));
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        new UserAccessInvalidationService(sessionInvalidationService)
                .invalidateForCurrentPrincipal("alice");

        verify(sessionInvalidationService)
                .invalidatePrincipalExceptSession("alice", "current-session");
    }

    @Test
    void invalidateForDifferentPrincipalInvalidatesAllState() {
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken("bob", "password"));

        new UserAccessInvalidationService(sessionInvalidationService)
                .invalidateForCurrentPrincipal("alice");

        verify(sessionInvalidationService).invalidatePrincipal("alice");
    }

    @Test
    void invalidateOtherSessionsFallsBackToAllStateWithoutSessionId() {
        new UserAccessInvalidationService(sessionInvalidationService)
                .invalidateOtherSessions("alice", null);

        verify(sessionInvalidationService).invalidatePrincipal("alice");
    }
}
