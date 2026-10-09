package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.service.DesktopSocialLinkTransactionService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;

/** Returns provider failures to the native app without exposing provider or token details. */
public final class DesktopSocialLinkAuthenticationFailureHandler
        implements AuthenticationFailureHandler {

    private final DesktopSocialLinkTransactionService transactionService;
    private final AuthenticationFailureHandler delegate;

    public DesktopSocialLinkAuthenticationFailureHandler(
            DesktopSocialLinkTransactionService transactionService,
            AuthenticationFailureHandler delegate) {
        this.transactionService = transactionService;
        this.delegate = delegate;
    }

    @Override
    public void onAuthenticationFailure(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception)
            throws IOException, ServletException {
        Object pending =
                request.getSession(false) == null
                        ? null
                        : request.getSession(false)
                                .getAttribute(
                                        DesktopSocialLinkTransactionService
                                                .PENDING_SESSION_ATTRIBUTE);
        if (!(pending instanceof String token)) {
            delegate.onAuthenticationFailure(request, response, exception);
            return;
        }
        try {
            DesktopSocialLinkTransactionService.DesktopSocialLinkFailure failure =
                    transactionService.failureFromBrowser(token, "authorization_failed");
            request.getSession(false)
                    .removeAttribute(DesktopSocialLinkTransactionService.PENDING_SESSION_ATTRIBUTE);
            response.sendRedirect(
                    transactionService.callbackUrl(failure.state(), null, failure.error()));
        } catch (RuntimeException ignored) {
            delegate.onAuthenticationFailure(request, response, exception);
        }
    }
}
