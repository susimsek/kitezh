package io.github.susimsek.kitezh.service.security;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.event.AbstractAuthenticationFailureEvent;
import org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.core.Authentication;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

class AuthenticationSecurityEventsTest {

    private final AccountLockService accountLockService = mock(AccountLockService.class);
    private final LoginRateLimitService loginRateLimitService = mock(LoginRateLimitService.class);
    private final AuthenticationSecurityEvents events =
            new AuthenticationSecurityEvents(accountLockService, loginRateLimitService);

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void recordsSuccessWithStringPrincipalAndRequestAddress() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("192.0.2.10");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        Authentication authentication =
                UsernamePasswordAuthenticationToken.authenticated("alice", "", java.util.List.of());

        events.onSuccess(new AuthenticationSuccessEvent(authentication));

        verify(accountLockService).recordSuccess("alice");
        verify(loginRateLimitService).clear("alice", "192.0.2.10");
    }

    @Test
    void recordsFailuresForNamedPrincipalsWithoutARequest() {
        Authentication authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        new Object() {
                            @Override
                            public String toString() {
                                return "principal";
                            }
                        },
                        "",
                        java.util.List.of());
        AbstractAuthenticationFailureEvent failure =
                new AuthenticationFailureBadCredentialsEvent(
                        authentication, new BadCredentialsException("bad credentials"));

        events.onFailure(failure);

        verify(accountLockService).recordFailure(authentication.getName(), "unknown");
    }
}
