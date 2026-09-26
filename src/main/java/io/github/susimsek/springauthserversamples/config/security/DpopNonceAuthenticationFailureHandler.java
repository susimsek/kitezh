package io.github.susimsek.springauthserversamples.config.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.server.resource.web.DPoPAuthenticationEntryPoint;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.authentication.AuthenticationEntryPointFailureHandler;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;

/** Returns a DPoP nonce challenge when a resource proof is rejected. */
public final class DpopNonceAuthenticationFailureHandler implements AuthenticationFailureHandler {

    private final DpopNonceService nonceService;
    private final AuthenticationFailureHandler delegate =
            new AuthenticationEntryPointFailureHandler(
                    (AuthenticationEntryPoint) new DPoPAuthenticationEntryPoint());

    public DpopNonceAuthenticationFailureHandler(DpopNonceService nonceService) {
        this.nonceService = nonceService;
    }

    @Override
    public void onAuthenticationFailure(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception)
            throws IOException, ServletException {
        if (this.nonceService.isRequired()) {
            response.setHeader(
                    "DPoP-Nonce", this.nonceService.issue(request.getHeader("Authorization")));
        }
        this.delegate.onAuthenticationFailure(request, response, exception);
    }
}
