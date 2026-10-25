package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.service.DesktopSocialLinkTransactionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;

@ExtendWith(MockitoExtension.class)
class DesktopSocialLinkAuthenticationFailureHandlerTest {

    @Mock private DesktopSocialLinkTransactionService transactionService;
    @Mock private AuthenticationFailureHandler delegate;
    @Mock private AuthenticationException exception;

    @Test
    void delegatesWhenThereIsNoPendingDesktopTransaction() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler().onAuthenticationFailure(request, response, exception);

        verify(delegate).onAuthenticationFailure(request, response, exception);
        verify(transactionService, never()).failureFromBrowser("", "authorization_failed");
        assertThat(response.getRedirectedUrl()).isNull();
    }

    @Test
    void returnsSanitizedFailureToDesktopAndRemovesPendingTransaction() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(
                DesktopSocialLinkTransactionService.PENDING_SESSION_ATTRIBUTE,
                "opaque-transaction");
        request.setSession(session);
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(transactionService.failureFromBrowser("opaque-transaction", "authorization_failed"))
                .thenReturn(
                        new DesktopSocialLinkTransactionService.DesktopSocialLinkFailure(
                                "state-value", "authorization_failed"));
        when(transactionService.callbackUrl("state-value", null, "authorization_failed"))
                .thenReturn("kitezh://oauth/social-link?error=authorization_failed");

        handler().onAuthenticationFailure(request, response, exception);

        assertThat(response.getRedirectedUrl())
                .isEqualTo("kitezh://oauth/social-link?error=authorization_failed");
        assertThat(
                        session.getAttribute(
                                DesktopSocialLinkTransactionService.PENDING_SESSION_ATTRIBUTE))
                .isNull();
        verify(delegate, never()).onAuthenticationFailure(request, response, exception);
    }

    @Test
    void delegatesWhenPendingTransactionCannotBeResolved() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(
                DesktopSocialLinkTransactionService.PENDING_SESSION_ATTRIBUTE,
                "invalid-transaction");
        request.setSession(session);
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(transactionService.failureFromBrowser("invalid-transaction", "authorization_failed"))
                .thenThrow(new IllegalStateException("transaction expired"));

        handler().onAuthenticationFailure(request, response, exception);

        verify(delegate).onAuthenticationFailure(request, response, exception);
        assertThat(response.getRedirectedUrl()).isNull();
    }

    private DesktopSocialLinkAuthenticationFailureHandler handler() {
        return new DesktopSocialLinkAuthenticationFailureHandler(transactionService, delegate);
    }
}
