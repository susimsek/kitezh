package io.github.susimsek.springauthserversamples.config.security;

import io.github.susimsek.springauthserversamples.service.LoginSettingsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.concurrent.atomic.AtomicReference;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.RememberMeServices;
import org.springframework.security.web.authentication.rememberme.TokenBasedRememberMeServices;
import org.springframework.stereotype.Component;

/** Enables remember-me only while the application setting is enabled. */
@Component
@RequiredArgsConstructor
public class DynamicRememberMeServices implements RememberMeServices {

    private final LoginSettingsService loginSettingsService;
    private final UserDetailsService userDetailsService;
    private final AtomicReference<TokenBasedRememberMeServices> delegate = new AtomicReference<>();

    private TokenBasedRememberMeServices delegate() {
        return delegate.updateAndGet(
                current -> {
                    if (current != null) {
                        return current;
                    }
                    TokenBasedRememberMeServices created =
                            new TokenBasedRememberMeServices("kitezh", userDetailsService);
                    created.setTokenValiditySeconds(14 * 24 * 60 * 60);
                    return created;
                });
    }

    @Override
    public Authentication autoLogin(HttpServletRequest request, HttpServletResponse response) {
        return loginSettingsService.isRememberMeEnabled()
                ? delegate().autoLogin(request, response)
                : null;
    }

    @Override
    public void loginFail(HttpServletRequest request, HttpServletResponse response) {
        if (loginSettingsService.isRememberMeEnabled()) {
            delegate().loginFail(request, response);
        }
    }

    @Override
    public void loginSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication successfulAuthentication) {
        if (loginSettingsService.isRememberMeEnabled()) {
            delegate().loginSuccess(request, response, successfulAuthentication);
        }
    }
}
