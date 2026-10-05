package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.security.RegistrationCaptchaService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Verifies the login CAPTCHA before Spring Security authenticates the credentials. */
@Component
@RequiredArgsConstructor
public class LoginCaptchaFilter extends OncePerRequestFilter {

    private final RegistrationCaptchaService captchaService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (!"POST".equalsIgnoreCase(request.getMethod())
                || !"/login".equals(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }
        try {
            captchaService.verifyLoginOrThrow(request.getParameter("captchaToken"), request);
            filterChain.doFilter(request, response);
        } catch (ApiException _) {
            response.sendRedirect(request.getContextPath() + "/login?error&captcha=failed");
        }
    }
}
