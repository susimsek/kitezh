package io.github.susimsek.kitezh.web.filter;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class SpaFilter extends OncePerRequestFilter {

    private static final Set<String> PUBLIC_PAGES =
            Set.of(
                    "/",
                    "/download",
                    "/login",
                    "/register",
                    "/consent",
                    "/auth-error",
                    "/forgot-password",
                    "/reset-password",
                    "/verify-email",
                    "/confirm-email",
                    "/required-actions",
                    "/mfa");
    private static final Set<String> BACKEND_ROOTS =
            Set.of(
                    "/api",
                    "/oauth2",
                    "/account/social-links",
                    "/.well-known",
                    "/actuator",
                    "/_next",
                    "/avatars",
                    "/oidc",
                    "/v3",
                    "/swagger-ui",
                    "/h2-console",
                    "/error",
                    "/logout");

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        String accept = request.getHeader(HttpHeaders.ACCEPT);
        boolean navigation =
                request.getDispatcherType() == DispatcherType.REQUEST
                        && ("GET".equals(request.getMethod()) || "HEAD".equals(request.getMethod()))
                        && accept != null
                        && accept.contains("text/html");
        if (!navigation
                || path.contains(".")
                || path.contains("\\")
                || BACKEND_ROOTS.stream().anyMatch(root -> beneath(path, root))
                || beneath(path, "/account/avatar")) {
            filterChain.doFilter(request, response);
            return;
        }

        String page =
                path.length() > 1 && path.endsWith("/")
                        ? path.substring(0, path.length() - 1)
                        : path;
        if ("/admin/callback".equals(page) || "/account/callback".equals(page)) {
            // Callback entries are exported explicitly; protocol endpoints never use this fallback.
            request.getRequestDispatcher(page + "/index.html").forward(request, response);
        } else if (PUBLIC_PAGES.contains(page)
                || beneath(page, "/admin")
                || beneath(page, "/account")) {
            // JHipster-style single entry: React Router owns every entity path and parameter.
            request.getRequestDispatcher("/index.html").forward(request, response);
        } else {
            filterChain.doFilter(request, response);
        }
    }

    private static boolean beneath(String path, String root) {
        return path.equals(root) || path.startsWith(root + "/");
    }
}
