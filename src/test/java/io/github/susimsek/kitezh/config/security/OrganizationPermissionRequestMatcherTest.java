package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.service.admin.OrganizationPermissionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class OrganizationPermissionRequestMatcherTest {

    private final OrganizationPermissionService permissionService =
            mock(OrganizationPermissionService.class);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void grantsResourcePermissionsAndKeepsPermissionEndpointAdminOnly() {
        when(permissionService.canView(8L, "manager")).thenReturn(true);
        authenticate("manager", "ROLE_USER");
        OrganizationPermissionRequestMatcher matcher =
                new OrganizationPermissionRequestMatcher(permissionService);

        assertThat(matcher.matches(request("GET", "/api/admin/organizations/8"))).isTrue();
        assertThat(matcher.matches(request("POST", "/api/admin/organizations/8"))).isFalse();
        assertThat(matcher.matches(request("GET", "/api/admin/organizations/8/permissions")))
                .isFalse();
    }

    @Test
    void grantsGlobalRolesAndCollectionAccessByOperation() {
        OrganizationPermissionRequestMatcher matcher =
                new OrganizationPermissionRequestMatcher(permissionService);

        authenticate("viewer", "ROLE_ORGANIZATION_VIEWER");
        assertThat(matcher.matches(request("GET", "/api/admin/organizations"))).isTrue();
        assertThat(matcher.matches(request("POST", "/api/admin/organizations"))).isFalse();

        authenticate("manager", "ROLE_ORGANIZATION_MANAGER");
        assertThat(matcher.matches(request("POST", "/api/admin/organizations"))).isTrue();

        authenticate("admin", "ROLE_ADMIN");
        assertThat(matcher.matches(request("DELETE", "/api/admin/organizations/8"))).isTrue();
    }

    @Test
    void rejectsAnonymousAndMalformedResourcePaths() {
        OrganizationPermissionRequestMatcher matcher =
                new OrganizationPermissionRequestMatcher(permissionService);
        assertThat(matcher.matches(request("GET", "/api/admin/organizations/8"))).isFalse();

        authenticate("user", "ROLE_USER");
        assertThat(matcher.matches(request("GET", "/api/admin/organizations/not-a-number")))
                .isFalse();
        assertThat(matcher.matches(request("GET", "/api/admin/users/8"))).isFalse();
    }

    private static void authenticate(String username, String authority) {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken(username, "password", authority);
        authentication.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private static MockHttpServletRequest request(String method, String uri) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setRequestURI(uri);
        return request;
    }
}
