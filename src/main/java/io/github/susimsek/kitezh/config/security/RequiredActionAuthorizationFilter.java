package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.service.requiredaction.RequiredActionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Prevents OAuth authorization until the authenticated user completes required actions. */
@Component
@RequiredArgsConstructor
public class RequiredActionAuthorizationFilter extends OncePerRequestFilter {

    private final RequiredActionService requiredActionService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if ("/oauth2/authorize".equals(request.getRequestURI())
                && authentication != null
                && authentication.isAuthenticated()
                && !authentication.getClass().getName().contains("Anonymous")) {
            String current = request.getRequestURI();
            if (request.getQueryString() != null) {
                current += "?" + request.getQueryString();
            }
            var pendingActions =
                    requiredActionService.pendingIfUserExists(authentication.getName());
            if (pendingActions.isEmpty()) {
                invalidateStaleAuthentication(request);
                filterChain.doFilter(request, response);
                return;
            }
            if (pendingActions.get().isEmpty()) {
                filterChain.doFilter(request, response);
                return;
            }
            request.getSession(true)
                    .setAttribute(MfaAuthorizationFilter.MFA_PENDING_REQUEST, current);
            response.sendRedirect(
                    "/required-actions?return_to="
                            + URLEncoder.encode(current, StandardCharsets.UTF_8));
            return;
        }
        filterChain.doFilter(request, response);
    }

    private static void invalidateStaleAuthentication(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
    }
}
