package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.security.AuthoritiesConstants;
import io.github.susimsek.kitezh.service.admin.OrganizationPermissionService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.util.matcher.RequestMatcher;

/** Matches organization resource requests granted by a resource-scoped permission. */
@RequiredArgsConstructor
final class OrganizationPermissionRequestMatcher implements RequestMatcher {

    private static final String PREFIX = "/api/admin/organizations/";

    private final OrganizationPermissionService permissionService;

    @Override
    public boolean matches(HttpServletRequest request) {
        if (!request.getRequestURI().equals("/api/admin/organizations")
                        && !request.getRequestURI().startsWith(PREFIX)
                || request.getRequestURI().contains("/permissions")) {
            return false;
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        boolean readOnly = HttpMethod.GET.matches(request.getMethod());
        if (hasAuthority(authentication, AuthoritiesConstants.ADMIN)) {
            return true;
        }
        Long organizationId = organizationId(request.getRequestURI());
        if (organizationId == null) {
            return readOnly
                    ? hasAuthority(authentication, AuthoritiesConstants.ORGANIZATION_VIEWER)
                            || hasAuthority(
                                    authentication, AuthoritiesConstants.ORGANIZATION_MANAGER)
                    : hasAuthority(authentication, AuthoritiesConstants.ORGANIZATION_MANAGER);
        }
        return readOnly
                ? hasAuthority(authentication, AuthoritiesConstants.ORGANIZATION_VIEWER)
                        || hasAuthority(authentication, AuthoritiesConstants.ORGANIZATION_MANAGER)
                        || permissionService != null
                                && permissionService.canView(
                                        organizationId, authentication.getName())
                : hasAuthority(authentication, AuthoritiesConstants.ORGANIZATION_MANAGER)
                        || permissionService != null
                                && permissionService.canManage(
                                        organizationId, authentication.getName());
    }

    private static Long organizationId(String path) {
        if (path.equals("/api/admin/organizations")) {
            return null;
        }
        String remainder = path.substring(PREFIX.length());
        int separator = remainder.indexOf('/');
        String value = separator < 0 ? remainder : remainder.substring(0, separator);
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private static boolean hasAuthority(Authentication authentication, String authority) {
        return authentication.getAuthorities().stream()
                .anyMatch(grantedAuthority -> authority.equals(grantedAuthority.getAuthority()));
    }
}
