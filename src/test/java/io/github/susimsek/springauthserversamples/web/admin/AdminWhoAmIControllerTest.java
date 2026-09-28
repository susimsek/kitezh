package io.github.susimsek.springauthserversamples.web.admin;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

class AdminWhoAmIControllerTest {

    private final AdminWhoAmIController controller = new AdminWhoAmIController();

    @Test
    void returnsCurrentAdminIdentityAndAccess() {
        var authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        "admin", "ignored", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

        var response = controller.whoAmI(authentication);

        assertThat(response.username()).isEqualTo("admin");
        assertThat(response.authorities()).containsExactly("ROLE_ADMIN");
        assertThat(response.access())
                .containsEntry("queryClients", true)
                .containsEntry("viewClients", true)
                .containsEntry("manageClients", true)
                .containsEntry("queryUsers", true)
                .containsEntry("viewUsers", true)
                .containsEntry("manageUsers", true)
                .containsEntry("queryGroups", true)
                .containsEntry("viewGroups", true)
                .containsEntry("manageGroups", true)
                .containsEntry("impersonateUsers", true)
                .containsEntry("viewSessions", true)
                .containsEntry("manageSessions", true)
                .containsEntry("viewConsents", true)
                .containsEntry("manageConsents", true)
                .containsEntry("viewEvents", true)
                .containsEntry("manageEvents", true)
                .containsEntry("viewKeys", true)
                .containsEntry("manageKeys", true);
    }

    @Test
    void derivesGranularAccessFromAuthorities() {
        var authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        "viewer",
                        "ignored",
                        List.of(new SimpleGrantedAuthority("ROLE_CLIENT_VIEWER")));

        var response = controller.whoAmI(authentication);

        assertThat(response.access())
                .containsEntry("queryClients", false)
                .containsEntry("viewClients", true)
                .containsEntry("manageClients", false)
                .containsEntry("queryUsers", false)
                .containsEntry("viewUsers", false)
                .containsEntry("manageUsers", false)
                .containsEntry("queryGroups", false)
                .containsEntry("viewGroups", false)
                .containsEntry("manageGroups", false)
                .containsEntry("impersonateUsers", false)
                .containsEntry("viewSessions", false)
                .containsEntry("manageSessions", false)
                .containsEntry("viewConsents", false)
                .containsEntry("manageConsents", false)
                .containsEntry("viewEvents", false)
                .containsEntry("manageEvents", false)
                .containsEntry("viewKeys", false)
                .containsEntry("manageKeys", false);
    }

    @Test
    void exposesDiscoveryAccessSeparatelyFromResourceViewAccess() {
        var authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        "query-user",
                        "ignored",
                        List.of(
                                new SimpleGrantedAuthority("ROLE_USER_QUERY"),
                                new SimpleGrantedAuthority("ROLE_GROUP_QUERY"),
                                new SimpleGrantedAuthority("ROLE_CLIENT_QUERY")));

        var response = controller.whoAmI(authentication);

        assertThat(response.access())
                .containsEntry("queryUsers", true)
                .containsEntry("viewUsers", false)
                .containsEntry("queryGroups", true)
                .containsEntry("viewGroups", false)
                .containsEntry("queryClients", true)
                .containsEntry("viewClients", false);
    }

    @Test
    void derivesEventAccessFromEventAuthorities() {
        var authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        "auditor",
                        "ignored",
                        List.of(new SimpleGrantedAuthority("ROLE_EVENT_VIEWER")));

        var response = controller.whoAmI(authentication);

        assertThat(response.access())
                .containsEntry("viewEvents", true)
                .containsEntry("manageEvents", false);

        authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        "event-manager",
                        "ignored",
                        List.of(new SimpleGrantedAuthority("ROLE_EVENT_MANAGER")));

        response = controller.whoAmI(authentication);

        assertThat(response.access())
                .containsEntry("viewEvents", true)
                .containsEntry("manageEvents", true);
    }

    @Test
    void exposesImpersonationAccessSeparatelyFromUserManagement() {
        var authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        "operator",
                        "ignored",
                        List.of(new SimpleGrantedAuthority("ROLE_USER_IMPERSONATOR")));

        var response = controller.whoAmI(authentication);

        assertThat(response.access())
                .containsEntry("impersonateUsers", true)
                .containsEntry("manageUsers", false);
    }
}
