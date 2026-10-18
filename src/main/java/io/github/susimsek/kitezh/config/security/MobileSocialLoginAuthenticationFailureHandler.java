package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.service.MobileSocialLoginTransactionService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;

/** Returns a generic provider failure to the registered mobile callback without leaking details. */
final class MobileSocialLoginAuthenticationFailureHandler implements AuthenticationFailureHandler {

    private final MobileSocialLoginTransactionService transactionService;
    private final AuthenticationFailureHandler delegate;

    MobileSocialLoginAuthenticationFailureHandler(
            MobileSocialLoginTransactionService transactionService,
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
        String callback = transactionService.failureRedirect(request.getSession(false));
        if (callback == null) {
            delegate.onAuthenticationFailure(request, response, exception);
            return;
        }
        response.sendRedirect(callback);
    }
}
