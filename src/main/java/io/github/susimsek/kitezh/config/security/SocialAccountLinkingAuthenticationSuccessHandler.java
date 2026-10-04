package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.service.SocialLoginService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;

/** Completes a pending broker link after the user re-authenticates locally. */
@RequiredArgsConstructor
public final class SocialAccountLinkingAuthenticationSuccessHandler
        implements AuthenticationSuccessHandler {

    private final SocialLoginService socialLoginService;
    private final AuthenticationSuccessHandler delegate;
    private final AuthenticationFailureHandler failureHandler =
            new SimpleUrlAuthenticationFailureHandler("/login?error");

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException, ServletException {
        if (request.getSession(false) == null) {
            delegate.onAuthenticationSuccess(request, response, authentication);
            return;
        }
        request.getSession(false).removeAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER);
        Object pending =
                request.getSession(false).getAttribute(SocialLoginService.PENDING_SOCIAL_LINK);
        if (!(pending instanceof Map<?, ?> pendingLink)) {
            delegate.onAuthenticationSuccess(request, response, authentication);
            return;
        }
        try {
            socialLoginService.linkPending(authentication.getName(), pendingLink);
            request.getSession(false).removeAttribute(SocialLoginService.PENDING_SOCIAL_LINK);
            delegate.onAuthenticationSuccess(request, response, authentication);
        } catch (RuntimeException exception) {
            request.getSession(false).removeAttribute(SocialLoginService.PENDING_SOCIAL_LINK);
            failureHandler.onAuthenticationFailure(
                    request,
                    response,
                    exception instanceof AuthenticationException authenticationException
                            ? authenticationException
                            : new AuthenticationServiceException(
                                    "Social account linking could not be completed", exception));
        }
    }
}
