package io.github.susimsek.kitezh.config.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collection;
import java.util.List;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

/** Restricts MCP audience tokens to the explicitly allowed Admin API routes used by MCP tools. */
final class McpAdminApiAccessFilter extends OncePerRequestFilter {

    private static final String MCP_READ_SCOPE = "mcp.read";
    private static final String MCP_WRITE_SCOPE = "mcp.write";
    private static final String ADMIN_API_AUDIENCE = "admin-api";
    private static final AntPathMatcher PATH_MATCHER = new AntPathMatcher();
    private static final List<String> READ_ONLY_PATHS =
            List.of(
                    "/api/admin/whoami",
                    "/api/admin/dashboard",
                    "/api/admin/users",
                    "/api/admin/users/*",
                    "/api/admin/users/*/groups",
                    "/api/admin/users/*/consents",
                    "/api/admin/groups",
                    "/api/admin/groups/*",
                    "/api/admin/groups/*/users",
                    "/api/admin/groups/*/permissions",
                    "/api/admin/clients",
                    "/api/admin/clients/*",
                    "/api/admin/clients/*/mappers",
                    "/api/admin/clients/*/service-account",
                    "/api/admin/clients/*/scope-assignments",
                    "/api/admin/clients/*/scope-evaluation",
                    "/api/admin/clients/*/roles",
                    "/api/admin/clients/*/roles/*",
                    "/api/admin/client-scopes",
                    "/api/admin/client-scopes/*",
                    "/api/admin/client-scopes/*/mappers",
                    "/api/admin/roles",
                    "/api/admin/roles/*",
                    "/api/admin/sessions",
                    "/api/admin/sessions/*",
                    "/api/admin/events",
                    "/api/admin/consents",
                    "/api/admin/consents/*",
                    "/api/admin/consents/*/*",
                    "/api/admin/required-actions/users/*",
                    "/api/admin/offline-sessions",
                    "/api/admin/organizations",
                    "/api/admin/organizations/*",
                    "/api/admin/organizations/*/members",
                    "/api/admin/organizations/*/groups",
                    "/api/admin/organizations/*/groups/*/members",
                    "/api/admin/organizations/*/invitations",
                    "/api/admin/organizations/*/domains",
                    "/api/admin/organizations/*/identity-providers",
                    "/api/admin/organizations/*/claims",
                    "/api/admin/keys",
                    "/api/admin/notifications");
    private static final List<String> WRITE_PATHS =
            List.of(
                    "/api/admin/users/*/enabled",
                    "/api/admin/groups/*/users",
                    "/api/admin/groups/*/users/*",
                    "/api/admin/sessions/*");

    private final String mcpResourceAudience;

    McpAdminApiAccessFilter(String mcpResourceAudience) {
        this.mcpResourceAudience = mcpResourceAudience;
    }

    static boolean isMcpPurposeToken(Jwt jwt, String mcpResourceAudience) {
        List<String> audiences = jwt.getAudience();
        return audiences != null
                && audiences.contains(mcpResourceAudience)
                && audiences.contains(ADMIN_API_AUDIENCE)
                && (hasScope(jwt, MCP_READ_SCOPE) || hasScope(jwt, MCP_WRITE_SCOPE));
    }

    private static boolean hasScope(Jwt jwt, String requiredScope) {
        Object scopeClaim = jwt.getClaims().get("scope");
        if (scopeClaim instanceof String scope) {
            return List.of(scope.split("\\s+")).contains(requiredScope);
        }
        return scopeClaim instanceof Collection<?> scopes && scopes.contains(requiredScope);
    }

    static boolean isAllowedReadOnlyRequest(String method, String path) {
        return HttpMethod.GET.matches(method)
                && READ_ONLY_PATHS.stream().anyMatch(pattern -> PATH_MATCHER.match(pattern, path));
    }

    static boolean isAllowedWriteRequest(String method, String path) {
        return WRITE_METHODS.stream().anyMatch(allowedMethod -> allowedMethod.matches(method))
                && WRITE_PATHS.stream().anyMatch(pattern -> PATH_MATCHER.match(pattern, path))
                && matchesMethodForPath(method, path);
    }

    private static final List<HttpMethod> WRITE_METHODS =
            List.of(HttpMethod.PUT, HttpMethod.POST, HttpMethod.DELETE);

    private static boolean matchesMethodForPath(String method, String path) {
        return (HttpMethod.PUT.matches(method) && path.matches("/api/admin/users/[^/]+/enabled"))
                || (HttpMethod.POST.matches(method)
                        && path.matches("/api/admin/groups/[^/]+/users"))
                || (HttpMethod.DELETE.matches(method)
                        && (path.matches("/api/admin/groups/[^/]+/users/[^/]+")
                                || path.matches("/api/admin/sessions/[^/]+")));
    }

    static boolean isAllowedMcpRequest(String method, String path, Jwt jwt) {
        if (isAllowedReadOnlyRequest(method, path)) {
            return hasScope(jwt, MCP_READ_SCOPE) || hasScope(jwt, MCP_WRITE_SCOPE);
        }
        return isAllowedWriteRequest(method, path) && hasScope(jwt, MCP_WRITE_SCOPE);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwtAuthentication
                && hasAudience(jwtAuthentication.getToken(), mcpResourceAudience)) {
            boolean purposeToken =
                    isMcpPurposeToken(jwtAuthentication.getToken(), mcpResourceAudience);
            boolean allowlistedRequest =
                    isAllowedMcpRequest(
                            request.getMethod(),
                            getApplicationPath(request),
                            jwtAuthentication.getToken());
            if (!purposeToken || !allowlistedRequest) {
                response.sendError(HttpServletResponse.SC_FORBIDDEN);
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private static boolean hasAudience(Jwt jwt, String audience) {
        List<String> audiences = jwt.getAudience();
        return audiences != null && audiences.contains(audience);
    }

    private static String getApplicationPath(HttpServletRequest request) {
        String requestUri = request.getRequestURI();
        String contextPath = request.getContextPath();
        return contextPath.isEmpty() ? requestUri : requestUri.substring(contextPath.length());
    }
}
