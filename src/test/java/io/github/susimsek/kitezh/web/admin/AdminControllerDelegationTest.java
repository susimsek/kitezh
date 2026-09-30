package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminAvatarDTO;
import io.github.susimsek.kitezh.dto.admin.AdminConsentDTO;
import io.github.susimsek.kitezh.dto.admin.AdminDashboardDTO;
import io.github.susimsek.kitezh.dto.admin.AdminEventDTO;
import io.github.susimsek.kitezh.dto.admin.AdminEventSettingsDTO;
import io.github.susimsek.kitezh.dto.admin.AdminEventSettingsRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminKeyDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRoleDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRoleRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminSessionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminUserDTO;
import io.github.susimsek.kitezh.dto.admin.AdminUserEnabledRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminUserRequestDTO;
import io.github.susimsek.kitezh.service.UserProfileService;
import io.github.susimsek.kitezh.service.account.WebAuthnService;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.AdminAvatarService;
import io.github.susimsek.kitezh.service.admin.AdminConsentService;
import io.github.susimsek.kitezh.service.admin.AdminDashboardService;
import io.github.susimsek.kitezh.service.admin.AdminEventSettingsService;
import io.github.susimsek.kitezh.service.admin.AdminRoleService;
import io.github.susimsek.kitezh.service.admin.AdminServerInfoService;
import io.github.susimsek.kitezh.service.admin.AdminSessionService;
import io.github.susimsek.kitezh.service.admin.AdminUserService;
import io.github.susimsek.kitezh.service.admin.KeyManagementService;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

class AdminControllerDelegationTest {

    private final AdminUserService userService = mock(AdminUserService.class);
    private final AdminAuditEventService eventService = mock(AdminAuditEventService.class);
    private final AdminEventSettingsService eventSettingsService =
            mock(AdminEventSettingsService.class);
    private final AdminAvatarService avatarService = mock(AdminAvatarService.class);
    private final UserProfileService userProfileService = mock(UserProfileService.class);
    private final WebAuthnService webAuthnService = mock(WebAuthnService.class);
    private final AdminSessionService sessionService = mock(AdminSessionService.class);
    private final AdminServerInfoService serverInfoService = mock(AdminServerInfoService.class);
    private final AdminConsentService consentService = mock(AdminConsentService.class);
    private final AdminDashboardService dashboardService = mock(AdminDashboardService.class);
    private final KeyManagementService keyService = mock(KeyManagementService.class);
    private final AdminRoleService roleService = mock(AdminRoleService.class);

    @Test
    void delegatesDashboardRoleAndEventEndpoints() {
        var dashboardController = new AdminDashboardController(dashboardService, serverInfoService);
        var roleController = new AdminRoleController(roleService);
        var eventController =
                new AdminEventController(eventService, userService, eventSettingsService);
        var dashboard = new AdminDashboardDTO(4, 5, 6, 7);
        var pageable = PageRequest.of(0, 20);
        var roles = new PageImpl<>(List.of(new AdminRoleDTO("ROLE_ADMIN")));
        var events = new PageImpl<AdminEventDTO>(List.of());
        when(dashboardService.dashboard()).thenReturn(dashboard);
        when(roleService.roles("", pageable)).thenReturn(roles);
        when(roleService.createRole("ROLE_AUDITOR")).thenReturn(new AdminRoleDTO("ROLE_AUDITOR"));
        when(eventService.events("", "", "", "", "", "", "", null, null, pageable))
                .thenReturn(events);

        assertThat(dashboardController.dashboard()).isSameAs(dashboard);
        assertThat(roleController.roles("", pageable)).isSameAs(roles);
        assertThat(
                        roleController
                                .createRole(new AdminRoleRequestDTO("ROLE_AUDITOR"))
                                .getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        assertThat(roleController.deleteRole("ROLE_AUDITOR").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(eventController.events("", "", "", "", null, null, pageable)).isSameAs(events);
        var settings = new AdminEventSettingsDTO(true, true, true, 30);
        when(eventSettingsService.get()).thenReturn(settings);
        when(eventSettingsService.update(new AdminEventSettingsRequestDTO(true, true, true, 30)))
                .thenReturn(settings);
        assertThat(eventController.eventSettings()).isSameAs(settings);
        assertThat(
                        eventController.updateEventSettings(
                                new AdminEventSettingsRequestDTO(true, true, true, 30)))
                .isSameAs(settings);
        assertThat(eventController.deleteAllEvents().getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        verify(roleService).deleteRole("ROLE_AUDITOR");
        verify(eventService).deleteAll();
    }

    @Test
    void delegatesUserAndAvatarEndpoints() {
        var controller =
                new AdminUserController(
                        userService, avatarService, userProfileService, webAuthnService);
        var authentication = authentication();
        var pageable = PageRequest.of(0, 20);
        var page = new PageImpl<>(List.of(userView()));
        var request = new AdminUserRequestDTO("alice", "password123", true, Set.of("ROLE_USER"));
        var file = new MockMultipartFile("file", "avatar.png", "image/png", new byte[] {1});
        var avatar = new AdminAvatarDTO("/avatars/test?v=1");
        when(userService.users("ali", true, pageable)).thenReturn(page);
        when(userService.user(1L, "admin")).thenReturn(userView());
        when(userService.createUser("alice", "password123", true, Set.of("ROLE_USER"), "admin"))
                .thenReturn(userView());
        when(avatarService.updateAvatar(1L, file, "admin")).thenReturn(avatar);

        assertThat(controller.users("ali", true, pageable)).isSameAs(page);
        assertThat(controller.user(1L, authentication)).isEqualTo(userView());
        assertThat(controller.createUser(request, authentication).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        assertThat(controller.updateAvatar(1L, file, authentication)).isSameAs(avatar);
        assertThat(controller.changePassword(1L, request, authentication).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.resetTotp(1L, authentication).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.deleteUser(1L, authentication).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(
                        controller
                                .setUserEnabled(
                                        1L, new AdminUserEnabledRequestDTO(false), authentication)
                                .getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        verify(userService).changePassword(1L, "password123", "admin");
        verify(userService).resetTotp(1L, "admin");
        verify(userService).deleteUser(1L, "admin");
        verify(userService).setUserEnabled(1L, false, "admin");
    }

    @Test
    void delegatesSessionConsentAndKeyEndpoints() {
        var sessionController = new AdminSessionController(sessionService);
        var consentController = new AdminConsentController(consentService);
        var keyController = new AdminKeyController(keyService);
        var authentication = authentication();
        var pageable = PageRequest.of(0, 20);
        var sessions = new PageImpl<>(List.of(sessionView()));
        var consents = new PageImpl<>(List.of(consentView()));
        var keys = new PageImpl<>(List.of(keyView()));
        when(sessionService.sessions("adm", "", "active", pageable)).thenReturn(sessions);
        when(consentService.consents("ali", "", "", "", pageable)).thenReturn(consents);
        when(keyService.keys("kid", true, pageable)).thenReturn(keys);
        when(keyService.rotateKey()).thenReturn(keyView());

        assertThat(sessionController.sessions("adm", "", "active", pageable)).isSameAs(sessions);
        assertThat(sessionController.deleteSession("sess-1", authentication).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(consentController.consents("ali", "", "", "", pageable)).isSameAs(consents);
        assertThat(
                        consentController
                                .revokeConsent("client-1", "alice", authentication)
                                .getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(keyController.keys("kid", true, pageable)).isSameAs(keys);
        assertThat(keyController.rotateKey()).isEqualTo(keyView());
        verify(sessionService).deleteSession("sess-1", "admin");
        verify(consentService).revokeConsent("client-1", "alice", "admin");
    }

    private static UsernamePasswordAuthenticationToken authentication() {
        return UsernamePasswordAuthenticationToken.authenticated("admin", "ignored", List.of());
    }

    private static AdminUserDTO userView() {
        Instant now = Instant.parse("2026-08-21T00:00:00Z");
        return new AdminUserDTO(1L, "alice", true, "/avatars/a?v=1", Set.of("ROLE_USER"), now, now);
    }

    private static AdminSessionDTO sessionView() {
        Instant now = Instant.parse("2026-08-21T00:00:00Z");
        return new AdminSessionDTO("sess-1", "alice", now, now, now, 2);
    }

    private static AdminConsentDTO consentView() {
        Instant now = Instant.parse("2026-08-21T00:00:00Z");
        return new AdminConsentDTO(
                "client-1", "Client One", "alice", 1L, Set.of("openid"), now, now);
    }

    private static AdminKeyDTO keyView() {
        return new AdminKeyDTO(
                "key-1",
                "kid-1",
                "RSA",
                "RS256",
                "sig",
                true,
                Instant.parse("2026-08-21T00:00:00Z"));
    }
}
